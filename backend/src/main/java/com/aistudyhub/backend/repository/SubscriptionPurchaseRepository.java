package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.dto.AdminTransactionItemResponse;
import com.aistudyhub.backend.dto.TransactionHistoryItemResponse;
import com.aistudyhub.backend.entity.SubscriptionPurchase;
import com.aistudyhub.backend.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SubscriptionPurchaseRepository extends JpaRepository<SubscriptionPurchase, Long> {

    Optional<SubscriptionPurchase> findByOrderId(String orderId);

    Optional<SubscriptionPurchase> findByOrderCode(Long orderCode);

    boolean existsByOrderId(String orderId);

    // ───────────────────────────────────────────────
    // TXN-101/102 (User) — GET /api/subscription-purchases/history
    // rangeStart/rangeEnd (theo paidAt) đến từ TransactionQueryValidation.resolveDateRange() —
    // LUÔN khác NULL (sentinel [1970,9999) khi không lọc theo thời gian). KHÔNG dùng pattern
    // "(:param IS NULL OR ...)": Postgres qua Hibernate không suy ra được kiểu dữ liệu cho 1 bare
    // "? IS NULL" (lỗi JDBC "could not determine data type of parameter"), xảy ra kể cả khi giá
    // trị bind KHÔNG null — đây là giới hạn chuẩn bị statement của JDBC driver, không phải lỗi do
    // giá trị null. Sort theo paidAt do Pageable (Sort) truyền vào áp đặt.
    // ───────────────────────────────────────────────
    @Query("SELECT new com.aistudyhub.backend.dto.TransactionHistoryItemResponse(" +
            "sp.orderId, sp.planName, sp.amount, sp.paidAt) " +
            "FROM SubscriptionPurchase sp " +
            "WHERE sp.userId = :userId AND sp.status = :status " +
            "AND sp.paidAt >= :rangeStart AND sp.paidAt < :rangeEnd")
    Page<TransactionHistoryItemResponse> findHistoryForUser(@Param("userId") UUID userId,
                                                             @Param("status") SubscriptionPurchase.Status status,
                                                             @Param("rangeStart") LocalDateTime rangeStart,
                                                             @Param("rangeEnd") LocalDateTime rangeEnd,
                                                             Pageable pageable);

    // ───────────────────────────────────────────────
    // TXN-201/202 (Admin/Sub-Admin) — GET /api/admin/transactions
    // JOIN sang core.users (đối tượng KHÔNG có quan hệ @ManyToOne, chỉ liên kết qua userId) để
    // lấy userDisplayName real-time + lọc keyword theo Name/Email (pattern DocumentRepository).
    // keyword đã chuẩn hoá qua TransactionQueryValidation.normalizeKeyword() — LUÔN là chuỗi
    // (rỗng "" khi bỏ qua GAP-5), KHÔNG bao giờ null: LIKE CONCAT('%','','%') = '%%' khớp mọi giá
    // trị, tránh được pattern "(:keyword IS NULL OR ...)" gây cùng lỗi suy kiểu tham số ở trên.
    // ───────────────────────────────────────────────
    @Query(value = "SELECT new com.aistudyhub.backend.dto.AdminTransactionItemResponse(" +
            "sp.orderId, u.displayName, sp.planName, sp.amount, sp.paidAt) " +
            "FROM SubscriptionPurchase sp JOIN User u ON u.id = sp.userId " +
            "WHERE sp.status = :status " +
            "AND sp.paidAt >= :rangeStart AND sp.paidAt < :rangeEnd " +
            "AND (LOWER(u.displayName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')))",
            countQuery = "SELECT COUNT(sp) " +
            "FROM SubscriptionPurchase sp JOIN User u ON u.id = sp.userId " +
            "WHERE sp.status = :status " +
            "AND sp.paidAt >= :rangeStart AND sp.paidAt < :rangeEnd " +
            "AND (LOWER(u.displayName) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
            "     OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<AdminTransactionItemResponse> searchAdminTransactions(@Param("status") SubscriptionPurchase.Status status,
                                                                @Param("rangeStart") LocalDateTime rangeStart,
                                                                @Param("rangeEnd") LocalDateTime rangeEnd,
                                                                @Param("keyword") String keyword,
                                                                Pageable pageable);

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