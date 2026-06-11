package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateSubscriptionPurchaseRequest;
import com.aistudyhub.backend.dto.SubscriptionPurchaseResponse;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.dto.VietQrTransactionSyncRequest;
import com.aistudyhub.backend.dto.VietQrTransactionSyncResponse;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubscriptionPurchaseService {

    private static final int SUBSCRIPTION_DAYS = 30;
    private static final long PLAN_2_4_STORAGE_BYTES = 1024L * 1024L * 1024L;
    private static final long PLAN_5_PLUS_STORAGE_BYTES = 5L * 1024L * 1024L * 1024L;
    private static final String PAID = "PAID";
    private static final String PENDING = "PENDING";
    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserRepository userRepository;
    private final Map<String, PendingSubscriptionPurchase> pendingPurchases = new ConcurrentHashMap<>();
    private final String bankCode;
    private final String bankAccount;
    private final String accountName;

    public SubscriptionPurchaseService(
            SubscriptionPlanRepository subscriptionPlanRepository,
            UserRepository userRepository,
            @Value("${app.vietqr.bank-code:MB}") String bankCode,
            @Value("${app.vietqr.bank-account:0000000000}") String bankAccount,
            @Value("${app.vietqr.account-name:AI STUDY HUB}") String accountName) {
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.userRepository = userRepository;
        this.bankCode = bankCode;
        this.bankAccount = bankAccount;
        this.accountName = accountName;
    }

    @Transactional(readOnly = true)
    public SubscriptionPurchaseResponse createPurchase(CreateSubscriptionPurchaseRequest request) {
        User user = getCurrentUser();
        if (user.getRole() != User.Role.user) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài khoản Admin/Sub-admin không cần mua gói.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findByName(request.getPlanName())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));
        if (SubscriptionPlan.FREE_PLAN_NAME.equals(plan.getName())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Gói Free không cần thanh toán.");
        }
        if (plan.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giá gói chưa được cấu hình.");
        }

        String orderId = nextOrderId();
        String content = orderId;
        PendingSubscriptionPurchase purchase = new PendingSubscriptionPurchase(
                orderId,
                user.getId().toString(),
                plan.getId(),
                plan.getName(),
                plan.getDisplayName(),
                plan.getPrice().setScale(0, RoundingMode.HALF_UP),
                storageLimitBytesFor(plan.getName()),
                content,
                PENDING);
        pendingPurchases.put(orderId, purchase);
        return toResponse(purchase, null);
    }

    public Optional<SubscriptionPurchaseResponse> getPurchase(String orderId) {
        PendingSubscriptionPurchase purchase = pendingPurchases.get(orderId);
        return purchase == null ? Optional.empty() : Optional.of(toResponse(purchase, null));
    }

    @Transactional
    public SubscriptionPurchaseResponse completePurchaseForDev(String orderId) {
        PendingSubscriptionPurchase purchase = pendingPurchases.get(orderId);
        if (purchase == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn thanh toán.");
        }
        User updatedUser = completePurchase(purchase);
        return toResponse(pendingPurchases.get(orderId), UserResponse.from(updatedUser));
    }

    @Transactional
    public VietQrTransactionSyncResponse syncVietQrTransaction(VietQrTransactionSyncRequest request) {
        String orderId = request.getOrderId() != null && !request.getOrderId().isBlank()
                ? request.getOrderId()
                : request.getContent();
        PendingSubscriptionPurchase purchase = pendingPurchases.get(orderId);
        if (purchase == null) {
            return new VietQrTransactionSyncResponse(true, "ORDER_NOT_FOUND", "Không tìm thấy đơn thanh toán.", request.getTransactionid());
        }
        if (!"C".equalsIgnoreCase(request.getTransType())) {
            return new VietQrTransactionSyncResponse(true, "INVALID_TRANS_TYPE", "Chỉ chấp nhận giao dịch ghi có.", request.getTransactionid());
        }
        if (request.getAmount() == null || request.getAmount().compareTo(purchase.amount()) != 0) {
            return new VietQrTransactionSyncResponse(true, "INVALID_AMOUNT", "Số tiền không khớp.", request.getTransactionid());
        }
        String callbackBankAccount = request.getBankaccount() != null ? request.getBankaccount() : request.getBankAccount();
        if (callbackBankAccount != null && !callbackBankAccount.isBlank()
                && !callbackBankAccount.equals(bankAccount)) {
            return new VietQrTransactionSyncResponse(true, "INVALID_BANK_ACCOUNT", "Tài khoản nhận tiền không khớp.", request.getTransactionid());
        }

        completePurchase(purchase);
        return new VietQrTransactionSyncResponse(false, "", "Đã cập nhật gói dịch vụ.", request.getTransactionid());
    }

    private User completePurchase(PendingSubscriptionPurchase purchase) {
        if (PAID.equals(purchase.status())) {
            return userRepository.findById(java.util.UUID.fromString(purchase.userId()))
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));
        }

        User user = userRepository.findById(java.util.UUID.fromString(purchase.userId()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime currentExpiry = user.getSubscriptionExpiresAt();
        LocalDateTime startDate = currentExpiry != null && currentExpiry.isAfter(now) ? currentExpiry : now;
        user.setSubscriptionPlanId(purchase.planId());
        user.setSubscriptionExpiresAt(startDate.plusDays(SUBSCRIPTION_DAYS));
        user.setStorageLimitBytes(purchase.storageLimitBytes());
        user.setUpdatedAt(now);
        User savedUser = userRepository.save(user);
        pendingPurchases.put(purchase.orderId(), purchase.withStatus(PAID));
        return savedUser;
    }

    private long storageLimitBytesFor(String planName) {
        return switch (planName) {
            case "plan_2_4" -> PLAN_2_4_STORAGE_BYTES;
            case "plan_5_plus" -> PLAN_5_PLUS_STORAGE_BYTES;
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "Gói không hỗ trợ mua subscription.");
        };
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
    }

    private SubscriptionPurchaseResponse toResponse(PendingSubscriptionPurchase purchase, UserResponse user) {
        String qrImageUrl = "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%s&addInfo=%s&accountName=%s"
                .formatted(
                        url(bankCode),
                        url(bankAccount),
                        purchase.amount().toPlainString(),
                        url(purchase.content()),
                        url(accountName));
        return new SubscriptionPurchaseResponse(
                purchase.orderId(),
                purchase.status(),
                purchase.planName(),
                purchase.displayName(),
                purchase.amount(),
                purchase.content(),
                bankCode,
                bankAccount,
                accountName,
                qrImageUrl,
                null,
                qrImageUrl,
                user);
    }

    private String nextOrderId() {
        String orderId;
        do {
            StringBuilder suffix = new StringBuilder();
            for (int i = 0; i < 10; i++) {
                suffix.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
            }
            orderId = "ASH" + suffix;
        } while (pendingPurchases.containsKey(orderId));
        return orderId;
    }

    private String url(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private record PendingSubscriptionPurchase(
            String orderId,
            String userId,
            Integer planId,
            String planName,
            String displayName,
            BigDecimal amount,
            long storageLimitBytes,
            String content,
            String status) {

        private PendingSubscriptionPurchase withStatus(String nextStatus) {
            return new PendingSubscriptionPurchase(
                    orderId,
                    userId,
                    planId,
                    planName,
                    displayName,
                    amount,
                    storageLimitBytes,
                    content,
                    nextStatus);
        }
    }
}
