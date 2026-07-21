package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(schema = "core", name = "activity_logs")
public class ActivityLog {

    public enum Action {
        UPLOAD_DOCUMENT,
        DELETE_DOCUMENT,
        RESTORE_DOCUMENT,
        PREVIEW_DOCUMENT,
        CREATE_SUB_ADMIN,
        UPDATE_UPLOAD_SETTINGS
    }

    public enum TargetType {
        DOCUMENT,
        FOLDER,
        USER
    }

    @Id
    private UUID id;

    /** Khớp với cột actor_id trong Supabase (schema dùng actor_id, không phải user_id). */
    @Column(name = "actor_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 100)
    private Action action;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 50)
    private TargetType targetType;

    /** Cột target_id trong Supabase là VARCHAR(255), không phải UUID. */
    @Column(name = "target_id", length = 255)
    private String targetId;

    /** Cột details trong Supabase là JSONB — lưu dưới dạng String TEXT từ phía Java. */
    @Column(name = "details", columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** Helper — đặt target_id từ UUID (tự convert sang String). */
    public void setTargetId(UUID uuid) {
        this.targetId = uuid != null ? uuid.toString() : null;
    }
}
