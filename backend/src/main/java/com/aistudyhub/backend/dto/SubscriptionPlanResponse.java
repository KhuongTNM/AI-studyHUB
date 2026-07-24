package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.SubscriptionPlan;
import java.math.BigDecimal;

public class SubscriptionPlanResponse {

    private Integer id;
    private String name;
    private BigDecimal price;
    private short maxRoomMembers;
    private long defaultStorageBytes;
    private int createGroupLimit;
    private int joinGroupLimit;
    private int dailyAiChatLimit;
    private int maxFlashcards;

    public static SubscriptionPlanResponse from(SubscriptionPlan plan) {
        SubscriptionPlanResponse response = new SubscriptionPlanResponse();
        response.id = plan.getId();
        response.name = plan.getName();
        response.price = plan.getPrice();
        response.maxRoomMembers = plan.getMaxRoomMembers();
        response.defaultStorageBytes = plan.getDefaultStorageBytes();
        response.createGroupLimit = plan.getCreateGroupLimit();
        response.joinGroupLimit = plan.getJoinGroupLimit();
        response.dailyAiChatLimit = plan.getDailyAiChatLimit();
        response.maxFlashcards = plan.getMaxFlashcards();
        return response;
    }

    public Integer getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public short getMaxRoomMembers() {
        return maxRoomMembers;
    }

    public long getDefaultStorageBytes() {
        return defaultStorageBytes;
    }

    public int getCreateGroupLimit() {
        return createGroupLimit;
    }

    public int getJoinGroupLimit() {
        return joinGroupLimit;
    }

    public int getDailyAiChatLimit() {
        return dailyAiChatLimit;
    }

    public int getMaxFlashcards() {
        return maxFlashcards;
    }
}
