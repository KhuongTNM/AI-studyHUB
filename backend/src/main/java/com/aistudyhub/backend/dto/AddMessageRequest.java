package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.ChatRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AddMessageRequest {
    @NotNull(message = "Role is required")
    private ChatRole role;

    @NotBlank(message = "Content cannot be blank")
    private String content;
}
