package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateChatMessageRequest {

    @NotBlank(message = "Vai trò tin nhắn không được để trống")
    @Pattern(regexp = "user|assistant", message = "role phải là 'user' hoặc 'assistant'")
    private String role;

    @NotBlank(message = "Nội dung tin nhắn không được để trống")
    private String content;
}
