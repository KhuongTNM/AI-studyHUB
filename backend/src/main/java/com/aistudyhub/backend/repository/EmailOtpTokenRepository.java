package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.EmailOtpToken;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface EmailOtpTokenRepository extends JpaRepository<EmailOtpToken, UUID> {

    /** BR-096: bản ghi OTP chưa dùng gần nhất của user, dùng để đối chiếu khi verify. */
    Optional<EmailOtpToken> findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(UUID userId);

    /** BR-098: bản ghi OTP gần nhất (kể cả đã dùng) của user, dùng để tính cooldown resend. */
    Optional<EmailOtpToken> findFirstByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * BR-100/BR-101: đếm số OTP đã sinh (đăng ký mới lẫn ghi đè) trong cửa sổ trượt 24 giờ
     * gần nhất của user - dùng chung cho cả luồng tạo mới (TH3) và ghi đè (TH2), không có
     * bộ đếm riêng cho từng luồng.
     */
    long countByUserIdAndCreatedAtAfter(UUID userId, LocalDateTime since);

    /**
     * BR-100/BR-101: bản ghi OTP cũ nhất còn nằm trong cửa sổ 24 giờ - dùng để tính
     * retryAfterSeconds (thời gian tới khi bản ghi này trượt ra khỏi cửa sổ) khi vượt giới hạn.
     */
    Optional<EmailOtpToken> findFirstByUserIdAndCreatedAtAfterOrderByCreatedAtAsc(UUID userId, LocalDateTime since);

    /**
     * BR-095: vô hiệu hoá mọi OTP còn hiệu lực của user trước khi sinh mã mới.
     * flushAutomatically=true: bắt buộc flush các thay đổi đang chờ (VD User vừa persist trong
     * register()) xuống DB TRƯỚC khi chạy UPDATE này, nếu không clearAutomatically sẽ xoá luôn
     * bản ghi User chưa kịp flush khỏi persistence context -> insert User bị mất -> lưu
     * EmailOtpToken tham chiếu tới user_id không tồn tại -> EntityNotFoundException.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE EmailOtpToken t SET t.used = true WHERE t.user.id = :userId AND t.used = false")
    void invalidateActiveTokens(@Param("userId") UUID userId);

    /**
     * BR-096: tăng attempt_count khi nhập sai OTP. Dùng REQUIRES_NEW để câu UPDATE này COMMIT
     * độc lập ngay lập tức, không bị cuốn theo rollback của transaction verifyOtp() (transaction
     * đó luôn rollback vì kết thúc bằng throw BusinessException(OTP_INVALID_CODE) — nếu không tách
     * transaction riêng, lượt thử sai sẽ không bao giờ được ghi nhận thật xuống DB).
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query("UPDATE EmailOtpToken t SET t.attemptCount = t.attemptCount + 1 WHERE t.id = :tokenId")
    void incrementAttemptCount(@Param("tokenId") UUID tokenId);

    /**
     * BR-096: đánh dấu used=true khi phát hiện OTP hết hạn ("dọn rác"). Cùng lý do REQUIRES_NEW
     * như incrementAttemptCount ở trên — nhánh này luôn kết thúc bằng throw OTP_EXPIRED.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @Query("UPDATE EmailOtpToken t SET t.used = true WHERE t.id = :tokenId")
    void markUsed(@Param("tokenId") UUID tokenId);
}