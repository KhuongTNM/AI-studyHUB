package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.ChatRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageResponse {
    private UUID id;
    private ChatRole role;
    private String content;
    private LocalDateTime createdAt;
}
