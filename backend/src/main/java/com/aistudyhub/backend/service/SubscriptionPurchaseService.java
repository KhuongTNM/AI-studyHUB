package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.SubscriptionPurchase;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.SubscriptionPurchaseRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.dto.CreateSubscriptionPurchaseRequest;
import com.aistudyhub.backend.dto.SubscriptionPurchaseResponse;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// IMPORT KHỚP 100% THEO ĐOẠN SOURCE MẪU CHÍNH THỨC CỦA PAYOS
import vn.payos.PayOS;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.webhooks.WebhookData;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SubscriptionPurchaseService {

    private static final int SUBSCRIPTION_DAYS = 30;
    private static final int EXPIRY_MINUTES = 15;
    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SubscriptionPurchaseRepository purchaseRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserRepository userRepository;
    private final PayOS payOS;

    @Value("${payos.return-url}")
    private String returnUrl;

    @Value("${payos.cancel-url}")
    private String cancelUrl;

    // ───────────────────────────────────────────────
    // POST /api/subscription-purchases
    // ───────────────────────────────────────────────
    public SubscriptionPurchaseResponse createPurchase(CreateSubscriptionPurchaseRequest request) {
        User user = getCurrentUser();
        if (user.getRole() != User.Role.user) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài khoản Admin/Sub-admin không cần mua gói.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(request.getPlanName())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));

        if (SubscriptionPlan.FREE_PLAN_NAME.equals(plan.getName())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Gói Free không cần thanh toán.");
        }
        if (plan.getPrice().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giá gói chưa được cấu hình.");
        }

        String orderId = generateUniqueOrderId();
        long orderCode = System.currentTimeMillis() / 1000;
        String description = orderId;
        long amountLong = plan.getPrice().setScale(0, RoundingMode.HALF_UP).longValue();

        CreatePaymentLinkResponse result;
        try {
            CreatePaymentLinkRequest paymentRequest = CreatePaymentLinkRequest.builder()
                    .orderCode(orderCode)
                    .amount(amountLong)
                    .description(description)
                    .cancelUrl(cancelUrl)
                    .returnUrl(returnUrl)
                    .build();

            result = payOS.paymentRequests().create(paymentRequest);

        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "Không thể tạo link thanh toán PayOS: " + e.getMessage());
        }

        SubscriptionPurchase purchase = savePurchaseToDb(user, plan, result, orderCode, orderId);

        return toResponse(purchase);
    }

    @Transactional
    protected SubscriptionPurchase savePurchaseToDb(User user, SubscriptionPlan plan, CreatePaymentLinkResponse result, long orderCode, String orderId) {
        SubscriptionPurchase purchase = new SubscriptionPurchase();
        purchase.setOrderCode(orderCode);
        purchase.setOrderId(orderId);
        purchase.setUserId(user.getId());
        purchase.setPlanId(plan.getId());
        purchase.setPlanName(plan.getName());
        purchase.setDisplayName(plan.getDisplayName());
        purchase.setAmount(plan.getPrice().setScale(0, RoundingMode.HALF_UP));
        purchase.setStorageLimitBytes(storageLimitBytesFor(plan));
        purchase.setStatus(SubscriptionPurchase.Status.PENDING);

        purchase.setPaymentLinkId(result.getPaymentLinkId());
        purchase.setQrCode(result.getQrCode());
        purchase.setCheckoutUrl(result.getCheckoutUrl());
        purchase.setBankCode(result.getBin());
        purchase.setBankAccount(result.getAccountNumber());
        purchase.setAccountName(result.getAccountName());

        purchase.setCreatedAt(LocalDateTime.now());
        purchase.setExpiresAt(LocalDateTime.now().plusMinutes(EXPIRY_MINUTES));
        return purchaseRepository.save(purchase);
    }

    @Transactional(readOnly = true)
    public Optional<SubscriptionPurchaseResponse> getPurchase(String orderId) {
        return purchaseRepository.findByOrderId(orderId).map(this::toResponse);
    }

    // ───────────────────────────────────────────────
    // POST /api/payos/webhook (Luồng tự động chuẩn của PayOS)
    // ───────────────────────────────────────────────
    @Transactional
    public void handleWebhook(Object webhookBody) {
        try {
            WebhookData webhookData = payOS.webhooks().verify(webhookBody);

            long orderCode = webhookData.getOrderCode();
            String code = webhookData.getCode();

            if (!"00".equals(code)) {
                return;
            }

            SubscriptionPurchase purchase = purchaseRepository.findByOrderCode(orderCode)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn."));

            if (purchase.getStatus() == SubscriptionPurchase.Status.PAID) {
                return;
            }

            BigDecimal webhookAmount = BigDecimal.valueOf(webhookData.getAmount());
            if (webhookAmount.compareTo(purchase.getAmount()) != 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Số tiền không khớp.");
            }

            purchase.setStatus(SubscriptionPurchase.Status.PAID);
            purchase.setPaidAt(LocalDateTime.now());
            purchaseRepository.save(purchase);

            User user = userRepository.findById(purchase.getUserId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

            LocalDateTime now = LocalDateTime.now();
            LocalDateTime startDate = (user.getSubscriptionExpiresAt() != null
                    && user.getSubscriptionExpiresAt().isAfter(now))
                    ? user.getSubscriptionExpiresAt() : now;

            user.setSubscriptionPlanId(purchase.getPlanId());
            user.setSubscriptionExpiresAt(startDate.plusDays(SUBSCRIPTION_DAYS));
            user.setStorageLimitBytes(purchase.getStorageLimitBytes());
            user.setUpdatedAt(now);
            userRepository.save(user);

        } catch (Exception e) {
            // Im lặng để báo nhận thành công HTTP 200
        }
    }

    @Transactional
    public SubscriptionPurchaseResponse completePurchaseForDev(String orderId) {
        SubscriptionPurchase purchase = purchaseRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn thanh toán."));

        if (purchase.getStatus() == SubscriptionPurchase.Status.PAID) {
            return toResponse(purchase);
        }

        purchase.setStatus(SubscriptionPurchase.Status.PAID);
        purchase.setPaidAt(LocalDateTime.now());
        purchaseRepository.save(purchase);

        User user = userRepository.findById(purchase.getUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startDate = (user.getSubscriptionExpiresAt() != null
                && user.getSubscriptionExpiresAt().isAfter(now))
                ? user.getSubscriptionExpiresAt() : now;

        user.setSubscriptionPlanId(purchase.getPlanId());
        user.setSubscriptionExpiresAt(startDate.plusDays(SUBSCRIPTION_DAYS));
        user.setStorageLimitBytes(purchase.getStorageLimitBytes());
        user.setUpdatedAt(now);
        User savedUser = userRepository.save(user);

        return toResponseWithUser(purchase, UserResponse.from(savedUser));
    }

    private SubscriptionPurchaseResponse toResponse(SubscriptionPurchase p) {
        return toResponseWithUser(p, null);
    }

    private SubscriptionPurchaseResponse toResponseWithUser(SubscriptionPurchase p, UserResponse user) {
        String qrImageUrl = null;
        if (p.getBankCode() != null && p.getBankAccount() != null) {
            qrImageUrl = "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%s&addInfo=%s&accountName=%s"
                    .formatted(
                            encode(p.getBankCode()),
                            encode(p.getBankAccount()),
                            p.getAmount().toPlainString(),
                            encode(p.getOrderId()),
                            encode(p.getAccountName() != null ? p.getAccountName() : "AI STUDY HUB"));
        }

        return new SubscriptionPurchaseResponse(
                p.getOrderId(),
                p.getStatus().name(),
                p.getPlanName(),
                p.getDisplayName(),
                p.getAmount(),
                p.getOrderId(),
                p.getBankCode(),
                p.getBankAccount(),
                p.getAccountName(),
                qrImageUrl,
                p.getQrCode(),
                p.getCheckoutUrl(),
                user);
    }

    private String generateUniqueOrderId() {
        String orderId;
        do {
            StringBuilder sb = new StringBuilder("ASH");
            for (int i = 0; i < 10; i++) {
                sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
            }
            orderId = sb.toString();
        } while (purchaseRepository.existsByOrderId(orderId));
        return orderId;
    }

    private long storageLimitBytesFor(SubscriptionPlan plan) {
        // Dùng dung lượng do Admin cấu hình trực tiếp trên gói (defaultStorageBytes),
        // thay vì chỉ chấp nhận 2 gói mặc định "plan_2_4" / "plan_5_plus".
        // Nhờ vậy các gói do Admin tự thêm mới cũng mua/thanh toán được qua PayOS.
        long bytes = plan.getDefaultStorageBytes();
        if (bytes <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Gói dịch vụ chưa được cấu hình dung lượng lưu trữ.");
        }
        return bytes;
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
    }

    private String encode(String value) {
        return URLEncoder.encode(value != null ? value : "", StandardCharsets.UTF_8);
    }
}