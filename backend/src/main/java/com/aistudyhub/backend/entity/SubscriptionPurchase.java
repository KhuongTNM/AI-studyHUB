package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Đơn mua subscription qua PayOS — persist vào DB (thay cho ConcurrentHashMap cũ).
 * Schema bắt buộc: payment (đồng bộ với payment.subscription_plans).
 */
@Entity
@Table(schema = "payment", name = "subscription_purchases")
public class SubscriptionPurchase {

    public enum Status {
        PENDING, PAID, CANCELLED, EXPIRED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID số dùng riêng cho PayOS (orderCode). */
    @Column(name = "order_code", nullable = false, unique = true)
    private Long orderCode;

    /** "ASH" + 10 ký tự, hiển thị cho user / dùng làm content chuyển khoản. */
    @Column(name = "order_id", nullable = false, unique = true, length = 20)
    private String orderId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "plan_id", nullable = false)
    private Integer planId;

    @Column(name = "plan_name", nullable = false, length = 20)
    private String planName;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "storage_limit_bytes", nullable = false)
    private long storageLimitBytes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "payment_link_id", length = 100)
    private String paymentLinkId;

    /** Chuỗi EMVCo từ PayOS — frontend tự render thành ảnh QR. */
    @Column(name = "qr_code", columnDefinition = "TEXT")
    private String qrCode;

    /** Link thanh toán PayOS — frontend dùng để redirect/mở web. */
    @Column(name = "checkout_url", columnDefinition = "TEXT")
    private String checkoutUrl;

    @Column(name = "bank_code", length = 20)
    private String bankCode;

    @Column(name = "bank_account", length = 50)
    private String bankAccount;

    @Column(name = "account_name", length = 100)
    private String accountName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** created_at + 15 phút — dùng để dọn dẹp đơn quá hạn (job riêng nếu cần). */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getOrderCode() { return orderCode; }
    public void setOrderCode(Long orderCode) { this.orderCode = orderCode; }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public Integer getPlanId() { return planId; }
    public void setPlanId(Integer planId) { this.planId = planId; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public long getStorageLimitBytes() { return storageLimitBytes; }
    public void setStorageLimitBytes(long storageLimitBytes) { this.storageLimitBytes = storageLimitBytes; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getPaymentLinkId() { return paymentLinkId; }
    public void setPaymentLinkId(String paymentLinkId) { this.paymentLinkId = paymentLinkId; }

    public String getQrCode() { return qrCode; }
    public void setQrCode(String qrCode) { this.qrCode = qrCode; }

    public String getCheckoutUrl() { return checkoutUrl; }
    public void setCheckoutUrl(String checkoutUrl) { this.checkoutUrl = checkoutUrl; }

    public String getBankCode() { return bankCode; }
    public void setBankCode(String bankCode) { this.bankCode = bankCode; }

    public String getBankAccount() { return bankAccount; }
    public void setBankAccount(String bankAccount) { this.bankAccount = bankAccount; }

    public String getAccountName() { return accountName; }
    public void setAccountName(String accountName) { this.accountName = accountName; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public LocalDateTime getPaidAt() { return paidAt; }
    public void setPaidAt(LocalDateTime paidAt) { this.paidAt = paidAt; }
}