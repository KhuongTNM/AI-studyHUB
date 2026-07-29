package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.SubscriptionPurchase;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * TXN-103/203 — Popup chi tiết 1 giao dịch, dùng chung cho phía User và Admin/Sub-Admin.
 * Field "activationStatus" (KHÔNG dùng "status") để tránh trùng tên với
 * SubscriptionPurchase.status hiện có (trạng thái THANH TOÁN, khác khái niệm).
 */
public class TransactionDetailResponse {

    /** GAP-1 (đã chốt Option 1): chỉ còn 2 giá trị, đã bỏ hẳn PENDING_ACTIVATION. */
    public enum ActivationStatus {
        ACTIVE,
        EXPIRED
    }

    private final String userDisplayName;
    private final String planName;
    private final BigDecimal amount;
    private final LocalDateTime paidAt;
    private final ActivationStatus activationStatus;
    private final Long orderCode;

    public TransactionDetailResponse(String userDisplayName, String planName, BigDecimal amount,
                                      LocalDateTime paidAt, ActivationStatus activationStatus, Long orderCode) {
        this.userDisplayName = userDisplayName;
        this.planName = planName;
        this.amount = amount;
        this.paidAt = paidAt;
        this.activationStatus = activationStatus;
        this.orderCode = orderCode;
    }

    public static TransactionDetailResponse from(SubscriptionPurchase purchase, String userDisplayName) {
        return new TransactionDetailResponse(
                userDisplayName,
                purchase.getPlanName(),
                purchase.getAmount(),
                purchase.getPaidAt(),
                resolveActivationStatus(purchase.getEndDate()),
                purchase.getOrderCode());
    }

    // Mục 0.3 Business Logic doc: ACTIVE khi startDate <= now <= endDate, EXPIRED khi now > endDate.
    // startDate luôn <= now (kích hoạt ngay lập tức - Option 1) nên chỉ cần so sánh với endDate.
    // endDate NULL ứng với giao dịch PAID từ TRƯỚC khi có migration start_date/end_date -> coi
    // là EXPIRED (giao dịch cũ, phát sinh trước khi tính năng Lịch sử Giao dịch tồn tại).
    private static ActivationStatus resolveActivationStatus(LocalDateTime endDate) {
        if (endDate == null || LocalDateTime.now().isAfter(endDate)) {
            return ActivationStatus.EXPIRED;
        }
        return ActivationStatus.ACTIVE;
    }

    public String getUserDisplayName() {
        return userDisplayName;
    }

    public String getPlanName() {
        return planName;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public LocalDateTime getPaidAt() {
        return paidAt;
    }

    public ActivationStatus getActivationStatus() {
        return activationStatus;
    }

    public Long getOrderCode() {
        return orderCode;
    }
}
