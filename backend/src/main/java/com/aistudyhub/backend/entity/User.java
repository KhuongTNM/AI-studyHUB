package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(schema = "core", name = "users")
public class User {

    public enum Role {
        user,
        admin,
        sub_admin
    }

    public enum LanguagePreference {
        vi,
        en
    }

    public enum ThemePreference {
        light,
        dark
    }

    @Id
    private UUID id;

    @Email
    @NotBlank
    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @NotBlank
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @NotBlank
    @Size(max = 50)
    @Column(name = "display_name", nullable = false, length = 50)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 10)
    private Role role = Role.user;

    @Column(name = "is_locked", nullable = false)
    private boolean locked;

    @Column(name = "login_attempts", nullable = false)
    private short loginAttempts;

    @Column(name = "storage_limit_bytes", nullable = false)
    private long storageLimitBytes = 536870912L;

    @Column(name = "storage_used_bytes", nullable = false)
    private long storageUsedBytes;

    @Column(name = "subscription_plan_id")
    private Integer subscriptionPlanId;

    @Column(name = "subscription_expires_at")
    private LocalDateTime subscriptionExpiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "language_pref", nullable = false, length = 5)
    private LanguagePreference languagePreference = LanguagePreference.vi;

    @Enumerated(EnumType.STRING)
    @Column(name = "theme_pref", nullable = false, length = 10)
    private ThemePreference themePreference = ThemePreference.light;

    @Column(name = "created_by_admin_id")
    private UUID createdByAdminId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public boolean isLocked() {
        return locked;
    }

    public void setLocked(boolean locked) {
        this.locked = locked;
    }

    public short getLoginAttempts() {
        return loginAttempts;
    }

    public void setLoginAttempts(short loginAttempts) {
        this.loginAttempts = loginAttempts;
    }

    public long getStorageLimitBytes() {
        return storageLimitBytes;
    }

    public void setStorageLimitBytes(long storageLimitBytes) {
        this.storageLimitBytes = storageLimitBytes;
    }

    public long getStorageUsedBytes() {
        return storageUsedBytes;
    }

    public void setStorageUsedBytes(long storageUsedBytes) {
        this.storageUsedBytes = storageUsedBytes;
    }

    public Integer getSubscriptionPlanId() {
        return subscriptionPlanId;
    }

    public void setSubscriptionPlanId(Integer subscriptionPlanId) {
        this.subscriptionPlanId = subscriptionPlanId;
    }

    public LocalDateTime getSubscriptionExpiresAt() {
        return subscriptionExpiresAt;
    }

    public void setSubscriptionExpiresAt(LocalDateTime subscriptionExpiresAt) {
        this.subscriptionExpiresAt = subscriptionExpiresAt;
    }

    public LanguagePreference getLanguagePreference() {
        return languagePreference;
    }

    public void setLanguagePreference(LanguagePreference languagePreference) {
        this.languagePreference = languagePreference;
    }

    public ThemePreference getThemePreference() {
        return themePreference;
    }

    public void setThemePreference(ThemePreference themePreference) {
        this.themePreference = themePreference;
    }

    public UUID getCreatedByAdminId() {
        return createdByAdminId;
    }

    public void setCreatedByAdminId(UUID createdByAdminId) {
        this.createdByAdminId = createdByAdminId;
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

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(LocalDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }
}
