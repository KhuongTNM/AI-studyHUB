package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(schema = "payment", name = "subscription_plans")
public class SubscriptionPlan {

    public static final String FREE_PLAN_NAME = "free";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "is_deleted", nullable = false)
    private boolean isDeleted = false;

    @Column(name = "display_name", nullable = false, length = 50)
    private String displayName;

    @Column(name = "price", nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "max_room_members", nullable = false)
    private short maxRoomMembers;

    @Column(name = "default_storage_bytes", nullable = false)
    private long defaultStorageBytes;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "create_group_limit", nullable = false)
    private int createGroupLimit = 0;

    @Column(name = "join_group_limit", nullable = false)
    private int joinGroupLimit = 5;

    @Column(name = "daily_ai_chat_limit", nullable = false)
    private int dailyAiChatLimit = 5;

    @Column(name = "max_flashcards", nullable = false)
    private int maxFlashcards = 5;

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

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public short getMaxRoomMembers() {
        return maxRoomMembers;
    }

    public void setMaxRoomMembers(short maxRoomMembers) {
        this.maxRoomMembers = maxRoomMembers;
    }

    public long getDefaultStorageBytes() {
        return defaultStorageBytes;
    }

    public void setDefaultStorageBytes(long defaultStorageBytes) {
        this.defaultStorageBytes = defaultStorageBytes;
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

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isDeleted() {
        return isDeleted;
    }

    public void setDeleted(boolean deleted) {
        isDeleted = deleted;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public int getCreateGroupLimit() {
        return createGroupLimit;
    }

    public void setCreateGroupLimit(int createGroupLimit) {
        this.createGroupLimit = createGroupLimit;
    }

    public int getJoinGroupLimit() {
        return joinGroupLimit;
    }

    public void setJoinGroupLimit(int joinGroupLimit) {
        this.joinGroupLimit = joinGroupLimit;
    }

    public int getDailyAiChatLimit() {
        return dailyAiChatLimit;
    }

    public void setDailyAiChatLimit(int dailyAiChatLimit) {
        this.dailyAiChatLimit = dailyAiChatLimit;
    }

    public int getMaxFlashcards() {
        return maxFlashcards;
    }

    public void setMaxFlashcards(int maxFlashcards) {
        this.maxFlashcards = maxFlashcards;
    }
}
