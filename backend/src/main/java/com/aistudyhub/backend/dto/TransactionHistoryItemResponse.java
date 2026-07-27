package com.aistudyhub.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** TXN-101/102 (User) — 1 dòng trong danh sách Lịch sử Giao dịch của chính User đang đăng nhập. */
public class TransactionHistoryItemResponse {

    private final String orderId;
    private final String planName;
    private final BigDecimal amount;
    private final LocalDateTime paidAt;

    public TransactionHistoryItemResponse(String orderId, String planName, BigDecimal amount, LocalDateTime paidAt) {
        this.orderId = orderId;
        this.planName = planName;
        this.amount = amount;
        this.paidAt = paidAt;
    }

    public String getOrderId() {
        return orderId;
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
