package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "flashcards")
public class Flashcard {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "question", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String question;

    @Column(name = "answer", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String answer;

    @Convert(converter = FlashcardStatusConverter.class)
    @Column(name = "status", nullable = false, length = 10)
    private FlashcardStatus status = FlashcardStatus.NEW;

    @Column(name = "is_ai_generated", nullable = false)
    private boolean isAiGenerated;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public FlashcardStatus getStatus() { return status; }
    public void setStatus(FlashcardStatus status) { this.status = status; }
    public boolean isAiGenerated() { return isAiGenerated; }
    public void setAiGenerated(boolean isAiGenerated) { this.isAiGenerated = isAiGenerated; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
