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
<<<<<<< HEAD
@Table(schema = "payment", name = "subscription_plans")
=======
@Table(name = "subscription_plans")
>>>>>>> cedad45d504a3d9629903eb97f921e8b7b986e07
public class SubscriptionPlan {

    public static final String FREE_PLAN_NAME = "free";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", nullable = false, unique = true, length = 20)
    private String name;

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
}
