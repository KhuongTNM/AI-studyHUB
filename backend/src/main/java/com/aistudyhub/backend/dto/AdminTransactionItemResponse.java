package com.aistudyhub.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * TXN-201/202 (Admin/Sub-Admin) — 1 dòng trong danh sách Lịch sử Giao dịch toàn hệ thống.
 * Field "userDisplayName" (KHÔNG dùng "displayName") để tránh nhầm với
 * SubscriptionPurchase.displayName hiện có (đang lưu TÊN GÓI, không phải tên User).
 */
public class AdminTransactionItemResponse {

    private final String orderId;
    private final String userDisplayName;
    private final String planName;
    private final BigDecimal amount;
    private final LocalDateTime paidAt;

    public AdminTransactionItemResponse(String orderId, String userDisplayName, String planName,
                                         BigDecimal amount, LocalDateTime paidAt) {
        this.orderId = orderId;
        this.userDisplayName = userDisplayName;
        this.planName = planName;
        this.amount = amount;
        this.paidAt = paidAt;
    }

    public String getOrderId() {
        return orderId;
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
}
