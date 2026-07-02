package com.aistudyhub.backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(schema = "payment", name = "subscription_purchases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubscriptionPurchase {

    public enum Status { PENDING, PAID, CANCELLED, EXPIRED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_code", nullable = false, unique = true)
    private Long orderCode;  // ID số cho PayOS

    @Column(name = "order_id", nullable = false, unique = true, length = 20)
    private String orderId;  // "ASH" + random, hiển thị cho user

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
    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "payment_link_id", length = 100)
    private String paymentLinkId;

    @Column(name = "qr_code", columnDefinition = "TEXT")
    private String qrCode;

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

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;  // created_at + 15 phút

    @Column(name = "paid_at")
    private LocalDateTime paidAt;
}