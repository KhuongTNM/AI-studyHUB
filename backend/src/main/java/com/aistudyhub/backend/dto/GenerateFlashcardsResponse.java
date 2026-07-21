package com.aistudyhub.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * Response của POST /api/flashcards/generate theo cơ chế Batching (BR-100).
 * Thay thế mảng phẳng List&lt;FlashcardResponse&gt; cũ để phản ánh trạng thái
 * hoàn tất/một phần (BR-102, BR-104) — xem API Contract Mục 1, 4.1.
 */
public class GenerateFlashcardsResponse {

    private String status;
    private int requestedCount;
    private int createdCount;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String failureReason;

    private List<FlashcardResponse> flashcards;

    public static GenerateFlashcardsResponse completed(int requestedCount, int createdCount,
                                                        List<FlashcardResponse> flashcards) {
        return new GenerateFlashcardsResponse("COMPLETED", requestedCount, createdCount, null, flashcards);
    }

    public static GenerateFlashcardsResponse partial(int requestedCount, int createdCount, String failureReason,
                                                       List<FlashcardResponse> flashcards) {
        return new GenerateFlashcardsResponse("PARTIAL_SUCCESS", requestedCount, createdCount, failureReason, flashcards);
    }

    private GenerateFlashcardsResponse(String status, int requestedCount, int createdCount,
                                        String failureReason, List<FlashcardResponse> flashcards) {
        this.status = status;
        this.requestedCount = requestedCount;
        this.createdCount = createdCount;
        this.failureReason = failureReason;
        this.flashcards = flashcards;
    }

    public String getStatus() {
        return status;
    }

    public int getRequestedCount() {
        return requestedCount;
    }

    public int getCreatedCount() {
        return createdCount;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public List<FlashcardResponse> getFlashcards() {
        return flashcards;
    }
}
