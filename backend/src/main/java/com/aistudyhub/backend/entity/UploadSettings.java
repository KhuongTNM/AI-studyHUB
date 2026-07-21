package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Cấu hình upload toàn hệ thống (KHÔNG gắn với SubscriptionPlan).
 * Bảng chỉ có 1 dòng duy nhất (id = 1) — singleton config, admin chỉnh trực tiếp.
 */
@Entity
@Table(schema = "core", name = "upload_settings")
public class UploadSettings {

    public static final short SINGLETON_ID = 1;

    @Id
    private Short id;

    @Column(name = "max_file_size_bytes", nullable = false)
    private long maxFileSizeBytes;

    @Column(name = "max_files_per_upload", nullable = false)
    private int maxFilesPerUpload;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "updated_by_admin_id")
    private UUID updatedByAdminId;

    public Short getId() {
        return id;
    }

    public void setId(Short id) {
        this.id = id;
    }

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public void setMaxFileSizeBytes(long maxFileSizeBytes) {
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    public int getMaxFilesPerUpload() {
        return maxFilesPerUpload;
    }

    public void setMaxFilesPerUpload(int maxFilesPerUpload) {
        this.maxFilesPerUpload = maxFilesPerUpload;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public UUID getUpdatedByAdminId() {
        return updatedByAdminId;
    }

    public void setUpdatedByAdminId(UUID updatedByAdminId) {
        this.updatedByAdminId = updatedByAdminId;
    }
}
