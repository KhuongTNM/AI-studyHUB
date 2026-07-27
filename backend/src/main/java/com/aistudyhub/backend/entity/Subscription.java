package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(schema = "payment", name = "subscriptions")
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "plan_id", nullable = false)
    private Integer planId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    private SubscriptionStatus status;

    @Column(name = "start_date", nullable = false)
    private LocalDateTime startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDateTime endDate;

    @Column(name = "price_paid", nullable = false, precision = 10, scale = 2)
    private BigDecimal pricePaid;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /** SUB-301: snapshot tên gói tại thời điểm kích hoạt — không đổi dù gói bị đổi tên/xoá sau đó. */
    @Column(name = "plan_name_snapshot")
    private String planNameSnapshot;

    @Column(name = "daily_ai_chat_limit_snapshot")
    private int dailyAiChatLimitSnapshot;

    @Column(name = "max_flashcards_snapshot")
    private int maxFlashcardsSnapshot;

    @Column(name = "create_group_limit_snapshot")
    private int createGroupLimitSnapshot;

    @Column(name = "join_group_limit_snapshot")
    private int joinGroupLimitSnapshot;

    @Column(name = "max_room_members_snapshot")
    private short maxRoomMembersSnapshot;

    @Column(name = "storage_bytes_snapshot")
    private long storageBytesSnapshot;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public Integer getPlanId() {
        return planId;
    }

    public void setPlanId(Integer planId) {
        this.planId = planId;
    }

    public SubscriptionStatus getStatus() {
        return status;
    }

    public void setStatus(SubscriptionStatus status) {
        this.status = status;
    }

    public LocalDateTime getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
    }

    public LocalDateTime getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDateTime endDate) {
        this.endDate = endDate;
    }

    public BigDecimal getPricePaid() {
        return pricePaid;
    }

    public void setPricePaid(BigDecimal pricePaid) {
        this.pricePaid = pricePaid;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getPlanNameSnapshot() {
        return planNameSnapshot;
    }

    public void setPlanNameSnapshot(String planNameSnapshot) {
        this.planNameSnapshot = planNameSnapshot;
    }

    public int getDailyAiChatLimitSnapshot() {
        return dailyAiChatLimitSnapshot;
    }

    public void setDailyAiChatLimitSnapshot(int dailyAiChatLimitSnapshot) {
        this.dailyAiChatLimitSnapshot = dailyAiChatLimitSnapshot;
    }

    public int getMaxFlashcardsSnapshot() {
        return maxFlashcardsSnapshot;
    }

    public void setMaxFlashcardsSnapshot(int maxFlashcardsSnapshot) {
        this.maxFlashcardsSnapshot = maxFlashcardsSnapshot;
    }

    public int getCreateGroupLimitSnapshot() {
        return createGroupLimitSnapshot;
    }

    public void setCreateGroupLimitSnapshot(int createGroupLimitSnapshot) {
        this.createGroupLimitSnapshot = createGroupLimitSnapshot;
    }

    public int getJoinGroupLimitSnapshot() {
        return joinGroupLimitSnapshot;
    }

    public void setJoinGroupLimitSnapshot(int joinGroupLimitSnapshot) {
        this.joinGroupLimitSnapshot = joinGroupLimitSnapshot;
    }

    public short getMaxRoomMembersSnapshot() {
        return maxRoomMembersSnapshot;
    }

    public void setMaxRoomMembersSnapshot(short maxRoomMembersSnapshot) {
        this.maxRoomMembersSnapshot = maxRoomMembersSnapshot;
    }

    public long getStorageBytesSnapshot() {
        return storageBytesSnapshot;
    }

    public void setStorageBytesSnapshot(long storageBytesSnapshot) {
        this.storageBytesSnapshot = storageBytesSnapshot;
    }
}
