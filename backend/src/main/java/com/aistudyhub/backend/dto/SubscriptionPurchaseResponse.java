package com.aistudyhub.backend.dto;

import java.math.BigDecimal;

public class SubscriptionPurchaseResponse {

    private String orderId;
    private String status;
    private String planName;
    private String displayName;
    private BigDecimal amount;
    private String content;
    private String bankCode;
    private String bankAccount;
    private String accountName;
    private String qrImageUrl;
    private String qrCode;
    private String qrLink;
    private UserResponse user;

    public SubscriptionPurchaseResponse(
            String orderId,
            String status,
            String planName,
            String displayName,
            BigDecimal amount,
            String content,
            String bankCode,
            String bankAccount,
            String accountName,
            String qrImageUrl,
            String qrCode,
            String qrLink,
            UserResponse user) {
        this.orderId = orderId;
        this.status = status;
        this.planName = planName;
        this.displayName = displayName;
        this.amount = amount;
        this.content = content;
        this.bankCode = bankCode;
        this.bankAccount = bankAccount;
        this.accountName = accountName;
        this.qrImageUrl = qrImageUrl;
        this.qrCode = qrCode;
        this.qrLink = qrLink;
        this.user = user;
    }

    public String getOrderId() {
        return orderId;
    }

    public String getStatus() {
        return status;
    }

    public String getPlanName() {
        return planName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getContent() {
        return content;
    }

    public String getBankCode() {
        return bankCode;
    }

    public String getBankAccount() {
        return bankAccount;
    }

    public String getAccountName() {
        return accountName;
    }

    public String getQrImageUrl() {
        return qrImageUrl;
    }

    public String getQrCode() {
        return qrCode;
    }

    public String getQrLink() {
        return qrLink;
    }

    public UserResponse getUser() {
        return user;
    }
}
