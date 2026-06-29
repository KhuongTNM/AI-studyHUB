package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateSubscriptionPurchaseRequest;
import com.aistudyhub.backend.dto.SubscriptionPurchaseResponse;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.dto.VietQrTransactionSyncRequest;
import com.aistudyhub.backend.dto.VietQrTransactionSyncResponse;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.SubscriptionPurchase;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.SubscriptionPurchaseRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// ── PayOS SDK 1.0.3 — verified via `javap -p payos-java-1.0.3.jar` ──────────
//   PayOS.createPaymentLink(PaymentData)    → CheckoutResponseData
//   PayOS.verifyPaymentWebhookData(Webhook) → WebhookData  (NO String overload)
//   PaymentData.builder().items(List<ItemData>)             (NOT .item() singular)
// ─────────────────────────────────────────────────────────────────────────────
import vn.payos.PayOS;
import vn.payos.type.CheckoutResponseData;
import vn.payos.type.ItemData;
import vn.payos.type.PaymentData;
import vn.payos.type.Webhook;
import vn.payos.type.WebhookData;

@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionPurchaseService {

    private static final int    SUBSCRIPTION_DAYS = 30;
    private static final int    EXPIRY_MINUTES    = 15;
    private static final String ALPHANUMERIC      = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM      = new SecureRandom();

    // ObjectMapper is thread-safe — dùng chung để deserialize webhook body
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final SubscriptionPurchaseRepository purchaseRepository;
    private final SubscriptionPlanRepository     subscriptionPlanRepository;
    private final UserRepository                 userRepository;
    private final PayOS                          payOS;

    @Value("${payos.return-url}")
    private String returnUrl;

    @Value("${payos.cancel-url}")
    private String cancelUrl;

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/subscription-purchases
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
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

        String orderId    = generateUniqueOrderId();
        long   orderCode  = System.currentTimeMillis();
        String description = orderId; // PayOS giới hạn 25 ký tự; "ASHxxxxxxxxxx" = 13 ký tự OK
        int    amountInt  = plan.getPrice().setScale(0, RoundingMode.HALF_UP).intValue();

        // SDK 1.0.3: createPaymentLink(PaymentData) → CheckoutResponseData
        CheckoutResponseData result;
        try {
            ItemData item = ItemData.builder()
                    .name(plan.getDisplayName())
                    .quantity(1)
                    .price(amountInt)
                    .build();

            // SDK 1.0.3: field là items (List), KHÔNG có .item() singular
            PaymentData paymentData = PaymentData.builder()
                    .orderCode(orderCode)
                    .amount(amountInt)
                    .description(description)
                    .items(List.of(item))
                    .cancelUrl(cancelUrl)
                    .returnUrl(returnUrl)
                    .build();

            result = payOS.createPaymentLink(paymentData);
        } catch (Exception e) {
            log.error("Không thể tạo link thanh toán PayOS cho orderCode={}", orderCode, e);
            throw new ApiException(HttpStatus.BAD_GATEWAY,
                    "Không thể tạo link thanh toán PayOS: " + e.getMessage());
        }

        SubscriptionPurchase purchase = new SubscriptionPurchase();
        purchase.setOrderCode(orderCode);
        purchase.setOrderId(orderId);
        purchase.setUserId(user.getId());
        purchase.setPlanId(plan.getId());
        purchase.setPlanName(plan.getName());
        purchase.setDisplayName(plan.getDisplayName());
        purchase.setAmount(plan.getPrice().setScale(0, RoundingMode.HALF_UP));
        purchase.setStorageLimitBytes(storageLimitBytesFor(plan.getName()));
        purchase.setStatus(SubscriptionPurchase.Status.PENDING);
        purchase.setPaymentLinkId(result.getPaymentLinkId());
        purchase.setQrCode(result.getQrCode());
        purchase.setCheckoutUrl(result.getCheckoutUrl());
        purchase.setBankCode(result.getBin());
        purchase.setBankAccount(result.getAccountNumber());
        purchase.setAccountName(result.getAccountName());
        purchase.setCreatedAt(LocalDateTime.now());
        purchase.setExpiresAt(LocalDateTime.now().plusMinutes(EXPIRY_MINUTES));

        purchaseRepository.save(purchase);
        return toResponse(purchase);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/subscription-purchases/{orderId}
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public Optional<SubscriptionPurchaseResponse> getPurchase(String orderId) {
        return purchaseRepository.findByOrderId(orderId).map(this::toResponse);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payos/webhook — overload String
    //
    // SDK 1.0.3 chỉ có verifyPaymentWebhookData(Webhook), KHÔNG có String overload.
    // Overload String này nhận raw JSON body từ controller/test, deserialize thành
    // Webhook object rồi delegate xuống overload Webhook bên dưới.
    //
    // Controller dùng:
    //   @PostMapping("/webhook")
    //   public ResponseEntity<Void> webhook(@RequestBody String body) {
    //       service.handleWebhook(body);
    //       return ResponseEntity.ok().build();
    //   }
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    public void handleWebhook(String webhookBody) {
        try {
            Webhook webhook = OBJECT_MAPPER.readValue(webhookBody, Webhook.class);
            handleWebhook(webhook);
        } catch (Exception e) {
            // Không throw ra ngoài — PayOS cần HTTP 200 để không retry mãi
            log.error("Lỗi khi parse/xử lý PayOS webhook body", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payos/webhook — overload Webhook (core logic, dùng nội bộ & test)
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    public void handleWebhook(Webhook webhook) {
        try {
            // SDK 1.0.3: verifyPaymentWebhookData(Webhook) → WebhookData (top-level class)
            WebhookData webhookData = payOS.verifyPaymentWebhookData(webhook);

            long   orderCode = webhookData.getOrderCode();
            String code      = webhookData.getCode(); // "00" = thanh toán thành công

            if (!"00".equals(code)) {
                log.info("PayOS webhook orderCode={} code={} -> bỏ qua (thất bại/huỷ)",
                        orderCode, code);
                return;
            }

            SubscriptionPurchase purchase = purchaseRepository.findByOrderCode(orderCode)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đơn."));

            // Idempotent guard — webhook có thể được gọi nhiều lần
            if (purchase.getStatus() == SubscriptionPurchase.Status.PAID) {
                log.info("PayOS webhook orderCode={} đã PAID trước đó -> bỏ qua", orderCode);
                return;
            }

            // WebhookData.getAmount() → Integer (confirmed via javap)
            BigDecimal webhookAmount = BigDecimal.valueOf(webhookData.getAmount());
            if (webhookAmount.compareTo(purchase.getAmount()) != 0) {
                log.warn("PayOS webhook orderCode={} số tiền không khớp: webhook={} purchase={}",
                        orderCode, webhookAmount, purchase.getAmount());
                throw new ApiException(HttpStatus.BAD_REQUEST, "Số tiền không khớp.");
            }

            purchase.setStatus(SubscriptionPurchase.Status.PAID);
            purchase.setPaidAt(LocalDateTime.now());
            purchaseRepository.save(purchase);

            applySubscriptionToUser(purchase);

            log.info("PayOS webhook orderCode={} xử lý thành công, userId={}",
                    orderCode, purchase.getUserId());

        } catch (Exception e) {
            // Không throw ra ngoài — PayOS cần HTTP 200 để không retry mãi
            log.error("Lỗi khi xử lý PayOS webhook", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DEV ONLY: giả lập thanh toán thành công
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    public SubscriptionPurchaseResponse completePurchaseForDev(String orderId) {
        SubscriptionPurchase purchase = purchaseRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Không tìm thấy đơn thanh toán."));

        if (purchase.getStatus() == SubscriptionPurchase.Status.PAID) {
            return toResponse(purchase);
        }

        purchase.setStatus(SubscriptionPurchase.Status.PAID);
        purchase.setPaidAt(LocalDateTime.now());
        purchaseRepository.save(purchase);

        User savedUser = applySubscriptionToUser(purchase);
        return toResponseWithUser(purchase, UserResponse.from(savedUser));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /bank/api/transaction-sync  (VietQR callback)
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    public VietQrTransactionSyncResponse syncVietQrTransaction(VietQrTransactionSyncRequest request) {
        try {
            if (!"C".equals(request.getTransType())) {
                return new VietQrTransactionSyncResponse(
                        false, null, "Giao dich khong phai tien vao, bo qua.", request.getTransactionid());
            }
            String content = request.getContent();
            if (content == null || content.isBlank()) {
                return new VietQrTransactionSyncResponse(
                        true, "CONTENT_EMPTY", "Noi dung chuyen khoan trong.", null);
            }
            String matchedOrderId = extractOrderId(content);
            if (matchedOrderId == null) {
                return new VietQrTransactionSyncResponse(
                        true, "ORDER_NOT_FOUND_IN_CONTENT",
                        "Khong tim thay ma don hang trong noi dung chuyen khoan.", null);
            }
            SubscriptionPurchase purchase = purchaseRepository.findByOrderId(matchedOrderId).orElse(null);
            if (purchase == null) {
                return new VietQrTransactionSyncResponse(
                        true, "ORDER_NOT_FOUND", "Khong tim thay don hang: " + matchedOrderId, null);
            }
            if (purchase.getStatus() == SubscriptionPurchase.Status.PAID) {
                return new VietQrTransactionSyncResponse(
                        false, null, "Don hang da duoc thanh toan truoc do.", request.getTransactionid());
            }
            if (request.getAmount() == null || request.getAmount().compareTo(purchase.getAmount()) != 0) {
                log.warn("VietQR callback orderId={} so tien khong khop: callback={} purchase={}",
                        matchedOrderId, request.getAmount(), purchase.getAmount());
                return new VietQrTransactionSyncResponse(
                        true, "AMOUNT_MISMATCH", "So tien khong khop voi don hang.", null);
            }
            purchase.setStatus(SubscriptionPurchase.Status.PAID);
            purchase.setPaidAt(LocalDateTime.now());
            purchaseRepository.save(purchase);
            applySubscriptionToUser(purchase);
            log.info("VietQR callback orderId={} xu ly thanh cong, userId={}", matchedOrderId, purchase.getUserId());
            return new VietQrTransactionSyncResponse(false, null, "Thanh toan thanh cong.", request.getTransactionid());
        } catch (Exception e) {
            log.error("Loi khi xu ly VietQR transaction sync", e);
            return new VietQrTransactionSyncResponse(true, "INTERNAL_ERROR", "Loi he thong: " + e.getMessage(), null);
        }
    }

    private String extractOrderId(String content) {
        String upper = content.toUpperCase();
        for (String token : upper.split("[\\s\\-_./,;:]+")) {
            if (token.startsWith("ASH") && token.length() == 13 && token.matches("ASH[A-Z0-9]{10}")) {
                return token;
            }
        }
        int idx = upper.indexOf("ASH");
        while (idx != -1) {
            if (idx + 13 <= upper.length()) {
                String candidate = upper.substring(idx, idx + 13);
                if (candidate.matches("ASH[A-Z0-9]{10}")) {
                    return candidate;
                }
            }
            idx = upper.indexOf("ASH", idx + 1);
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private User applySubscriptionToUser(SubscriptionPurchase purchase) {
        User user = userRepository.findById(purchase.getUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND,
                        "Không tìm thấy người dùng."));

        LocalDateTime now           = LocalDateTime.now();
        LocalDateTime currentExpiry = user.getSubscriptionExpiresAt();
        // Nếu subscription chưa hết hạn → cộng thêm từ ngày hết hạn cũ
        LocalDateTime startDate     = (currentExpiry != null && currentExpiry.isAfter(now))
                ? currentExpiry : now;

        user.setSubscriptionPlanId(purchase.getPlanId());
        user.setSubscriptionExpiresAt(startDate.plusDays(SUBSCRIPTION_DAYS));
        user.setStorageLimitBytes(purchase.getStorageLimitBytes());
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private SubscriptionPurchaseResponse toResponse(SubscriptionPurchase p) {
        return toResponseWithUser(p, null);
    }

    private SubscriptionPurchaseResponse toResponseWithUser(SubscriptionPurchase p,
                                                            UserResponse user) {
        String qrImageUrl = null;
        if (p.getBankCode() != null && p.getBankAccount() != null) {
            qrImageUrl = ("https://img.vietqr.io/image/%s-%s-compact2.png"
                    + "?amount=%s&addInfo=%s&accountName=%s")
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
                p.getOrderId(),       // content = orderId (nội dung chuyển khoản)
                p.getBankCode(),
                p.getBankAccount(),
                p.getAccountName(),
                qrImageUrl,
                p.getQrCode(),        // EMVCo string từ PayOS
                p.getCheckoutUrl(),   // checkout link PayOS
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

    private long storageLimitBytesFor(String planName) {
        return switch (planName) {
            case "plan_2_4"    -> 1024L * 1024L * 1024L;
            case "plan_5_plus" -> 5L * 1024L * 1024L * 1024L;
            default -> throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Gói không hỗ trợ mua subscription.");
        };
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED,
                        "Người dùng không tồn tại."));
    }

    private String encode(String value) {
        return URLEncoder.encode(value != null ? value : "", StandardCharsets.UTF_8);
    }
}