package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.Flashcard;
import java.time.LocalDateTime;
import java.util.UUID;

public class FlashcardResponse {

    private UUID id;
    private UUID userId;
    private UUID documentId;
    private String question;
    private String answer;
    private String status;
    private boolean aiGenerated;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static FlashcardResponse from(Flashcard flashcard) {
        FlashcardResponse r = new FlashcardResponse();
        r.id = flashcard.getId();
        r.userId = flashcard.getUserId();
        r.documentId = flashcard.getDocumentId();
        r.question = flashcard.getQuestion();
        r.answer = flashcard.getAnswer();
        r.status = flashcard.getStatus().name().toLowerCase();
        r.aiGenerated = flashcard.isAiGenerated();
        r.createdAt = flashcard.getCreatedAt();
        r.updatedAt = flashcard.getUpdatedAt();
        return r;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public UUID getDocumentId() { return documentId; }
    public String getQuestion() { return question; }
    public String getAnswer() { return answer; }
    public String getStatus() { return status; }
    public boolean isAiGenerated() { return aiGenerated; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
