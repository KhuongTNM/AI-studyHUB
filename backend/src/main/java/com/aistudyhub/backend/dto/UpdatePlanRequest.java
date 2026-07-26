package com.aistudyhub.backend.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdatePlanRequest {
    private String name;

    private BigDecimal price;

    private Short maxRoomMembers;

    private Long defaultStorageBytes;

    private Integer createGroupLimit; // maxGroups

    private Integer joinGroupLimit;

    private Integer dailyAiChatLimit;

    private Integer maxFlashcards;
}

