package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.SubscriptionPlan;
import java.math.BigDecimal;

public class SubscriptionPlanResponse {

    private Integer id;
    private String name;
    private String displayName;
    private BigDecimal price;
    private short maxRoomMembers;
    private long defaultStorageBytes;
    private int createGroupLimit;
    private int joinGroupLimit;

    public static SubscriptionPlanResponse from(SubscriptionPlan plan) {
        SubscriptionPlanResponse response = new SubscriptionPlanResponse();
        response.id = plan.getId();
        response.name = plan.getName();
        response.displayName = plan.getDisplayName();
        response.price = plan.getPrice();
        response.maxRoomMembers = plan.getMaxRoomMembers();
        response.defaultStorageBytes = plan.getDefaultStorageBytes();
        response.createGroupLimit = plan.getCreateGroupLimit();
        response.joinGroupLimit = plan.getJoinGroupLimit();
        return response;
    }

    public Integer getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDisplayName() {
        return displayName;
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
}
