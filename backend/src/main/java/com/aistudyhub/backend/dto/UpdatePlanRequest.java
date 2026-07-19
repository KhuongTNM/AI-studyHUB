package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdatePlanRequest {
    private String description;
    
    private BigDecimal price;
    
    private Integer createGroupLimit; // maxGroups

    private Integer dailyAiChatLimit;

    private Integer maxFlashcards;
    
    @NotBlank(message = "Mật khẩu Admin không được để trống.")
    private String adminPassword;
}
