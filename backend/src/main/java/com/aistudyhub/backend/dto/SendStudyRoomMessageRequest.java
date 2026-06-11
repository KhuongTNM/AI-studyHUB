package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class SendStudyRoomMessageRequest {
    @NotBlank(message = "Nội dung tin nhắn không được để trống.")
    @Size(max = 2000, message = "Tin nhắn không được vượt quá 2000 ký tự.")
    private String content;

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
