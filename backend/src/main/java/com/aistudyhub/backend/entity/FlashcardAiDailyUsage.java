package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * BR-110/BR-112: đếm số LƯỢT Flashcard đã sinh bằng AI trong một ngày (theo lịch
 * Asia/Ho_Chi_Minh) của một User. Bảng này chỉ TĂNG (increment-only) — xoá Flashcard
 * sau đó KHÔNG làm giảm count, theo đúng quyết định Gap 3 (đã chốt), khác với nguyên
 * tắc "đếm-theo-thực-tế" mà BR-103 cũ từng áp dụng cho quota tổng.
 */
@Entity
@Table(schema = "ai", name = "flashcard_ai_daily_usage")
@Getter
@Setter
public class FlashcardAiDailyUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "usage_date", nullable = false)
    private LocalDate usageDate;

    @Column(name = "count", nullable = false)
    private int count;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
