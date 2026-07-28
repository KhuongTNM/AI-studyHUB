package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.Subscription;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * GET /api/subscriptions/me — SUB-202. Trả về gói/hạn mức mà User thực sự đang được hưởng,
 * đọc từ snapshot đã chốt tại thời điểm kích hoạt (SUB-301) — không phụ thuộc vào việc gói gốc
 * còn tồn tại/còn tên cũ trong subscription_plans hay đã bị Admin xoá mềm.
 */
public class SubscriptionSnapshotResponse {

    private Integer planId;
    private String planName;
    private String status;
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private BigDecimal pricePaid;
    private int dailyAiChatLimit;
    private int maxFlashcards;
    private int createGroupLimit;
    private int joinGroupLimit;
    private short maxRoomMembers;
    private long storageBytes;

    public static SubscriptionSnapshotResponse from(Subscription sub) {
        SubscriptionSnapshotResponse response = new SubscriptionSnapshotResponse();
        response.planId = sub.getPlanId();
        response.planName = sub.getPlanNameSnapshot();
        response.status = sub.getStatus() != null ? sub.getStatus().name() : null;
        response.startDate = sub.getStartDate();
        response.endDate = sub.getEndDate();
        response.pricePaid = sub.getPricePaid();
        response.dailyAiChatLimit = sub.getDailyAiChatLimitSnapshot();
        response.maxFlashcards = sub.getMaxFlashcardsSnapshot();
        response.createGroupLimit = sub.getCreateGroupLimitSnapshot();
        response.joinGroupLimit = sub.getJoinGroupLimitSnapshot();
        response.maxRoomMembers = sub.getMaxRoomMembersSnapshot();
        response.storageBytes = sub.getStorageBytesSnapshot();
        return response;
    }

    public Integer getPlanId() {
        return planId;
    }

    public String getPlanName() {
        return planName;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getStartDate() {
        return startDate;
    }

    public LocalDateTime getEndDate() {
        return endDate;
    }

    public BigDecimal getPricePaid() {
        return pricePaid;
    }

    public int getDailyAiChatLimit() {
        return dailyAiChatLimit;
    }

    public int getMaxFlashcards() {
        return maxFlashcards;
    }

    public int getCreateGroupLimit() {
        return createGroupLimit;
    }

    public int getJoinGroupLimit() {
        return joinGroupLimit;
    }

    public short getMaxRoomMembers() {
        return maxRoomMembers;
    }

    public long getStorageBytes() {
        return storageBytes;
    }
}
