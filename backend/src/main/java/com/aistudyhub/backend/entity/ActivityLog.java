package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    /**
     * Khớp với cột actor_id trong Supabase.
     * (Schema DB dùng actor_id, không phải user_id)
     */
    @Column(name = "actor_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 100)
    private Action action;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 50)
    private TargetType targetType;

    /**
     * Cột target_id trong Supabase là VARCHAR(255), không phải UUID.
     */
    @Column(name = "target_id", length = 255)
    private String targetId;

    /**
     * Cột details trong Supabase là JSONB.
     * Dùng @JdbcTypeCode(SqlTypes.JSON) để Hibernate gửi đúng kiểu JSON
     * thay vì character varying — tránh lỗi:
     * "column details is of type jsonb but expression is of type character varying"
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "details")
    private String description;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /**
     * Helper — đặt target_id từ UUID (tự convert sang String).
     */
    public void setTargetId(UUID uuid) {
        this.targetId = uuid != null ? uuid.toString() : null;
    }
}
