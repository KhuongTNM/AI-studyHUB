package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class SendGroupMessageRequest {

    @NotBlank(message = "Nội dung tin nhắn không được để trống.")
    private String content;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
