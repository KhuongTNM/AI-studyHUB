package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateFlashcardStatusRequest {

    @NotBlank(message = "Trạng thái không được để trống.")
    private String status;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
