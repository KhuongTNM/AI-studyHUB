package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateFlashcardRequest {

    @NotBlank(message = "Câu hỏi không được để trống.")
    private String question;

    @NotBlank(message = "Câu trả lời không được để trống.")
    private String answer;

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
}
