package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public class CreateFlashcardRequest {

    @NotBlank(message = "Câu hỏi không được để trống.")
    private String question;

    @NotBlank(message = "Câu trả lời không được để trống.")
    private String answer;

    private UUID documentId;

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
}
