package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.SubscriptionPurchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface SubscriptionPurchaseRepository extends JpaRepository<SubscriptionPurchase, Long> {

    Optional<SubscriptionPurchase> findByOrderId(String orderId);

    Optional<SubscriptionPurchase> findByOrderCode(Long orderCode);

    boolean existsByOrderId(String orderId);

    // ───────────────────────────────────────────────
    // Dùng cho SubscriptionJobService: dọn dẹp các đơn EXPIRED đã quá hạn lưu trữ
    // ───────────────────────────────────────────────
    @Modifying
    @Transactional
    @Query("DELETE FROM SubscriptionPurchase sp " +
            "WHERE sp.status = :status AND sp.createdAt < :threshold")
    int deleteByStatusAndCreatedAtBefore(
            @Param("status") SubscriptionPurchase.Status status,
            @Param("threshold") LocalDateTime threshold
    );
}