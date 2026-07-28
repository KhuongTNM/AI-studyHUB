package com.aistudyhub.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** GET /api/flashcards/quota — BR-112: số lượt tạo Flashcard bằng AI còn lại trong ngày. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FlashcardQuotaResponse {
    private int limit;
    private long used;
    private Long remaining;
    private boolean unlimited;
}
