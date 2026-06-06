package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.User;
import java.time.LocalDateTime;
import java.util.UUID;

public class UserResponse {

    private UUID id;
    private String email;
    private String displayName;
    private String role;
    private boolean locked;
    private long storageUsedBytes;
    private long storageLimitBytes;
    private Integer subscriptionPlanId;
    private LocalDateTime subscriptionExpiresAt;
    private String languagePreference;
    private String themePreference;
    private LocalDateTime createdAt;

    public static UserResponse from(User user) {
        UserResponse response = new UserResponse();
        response.id = user.getId();
        response.email = user.getEmail();
        response.displayName = user.getDisplayName();
        response.role = mapRole(user.getRole());
        response.locked = user.isLocked();
        response.storageUsedBytes = user.getStorageUsedBytes();
        response.storageLimitBytes = user.getStorageLimitBytes();
        response.subscriptionPlanId = user.getSubscriptionPlanId();
        response.subscriptionExpiresAt = user.getSubscriptionExpiresAt();
        response.languagePreference = user.getLanguagePreference().name();
        response.themePreference = user.getThemePreference().name();
        response.createdAt = user.getCreatedAt();
        return response;
    }

    private static String mapRole(User.Role role) {
        if (role == User.Role.sub_admin) {
            return "sub-admin";
        }
        return role.name();
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getRole() {
        return role;
    }

    public boolean isLocked() {
        return locked;
    }

    public long getStorageUsedBytes() {
        return storageUsedBytes;
    }

    public long getStorageLimitBytes() {
        return storageLimitBytes;
    }

    public Integer getSubscriptionPlanId() {
        return subscriptionPlanId;
    }

    public LocalDateTime getSubscriptionExpiresAt() {
        return subscriptionExpiresAt;
    }

    public String getLanguagePreference() {
        return languagePreference;
    }

    public String getThemePreference() {
        return themePreference;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
