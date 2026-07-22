package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdatePlanRequest {
    private String name;

    private String displayName;

    private BigDecimal price;
    
    private Short maxRoomMembers;

    private Long defaultStorageBytes;

    private Integer createGroupLimit; // maxGroups

    private Integer joinGroupLimit;

    private Integer dailyAiChatLimit;

    private Integer maxFlashcards;
    
    @NotBlank(message = "Mật khẩu Admin không được để trống.")
    private String adminPassword;

    public String getEffectiveName() {
        return name != null && !name.isBlank() ? name : displayName;
    }
}

