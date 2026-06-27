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
<<<<<<< HEAD
@Table(schema = "core", name = "activity_logs")
=======
@Table(name = "activity_logs")
>>>>>>> cedad45d504a3d9629903eb97f921e8b7b986e07
public class ActivityLog {

    public enum Action {
        UPLOAD_DOCUMENT,
        DELETE_DOCUMENT,
        RESTORE_DOCUMENT,
        PREVIEW_DOCUMENT,
        CREATE_SUB_ADMIN
    }

    public enum TargetType {
        DOCUMENT,
        FOLDER,
        USER
    }

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 100)
    private Action action;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 50)
    private TargetType targetType;

    @Column(name = "target_id")
    private UUID targetId;

<<<<<<< HEAD
    @Column(name = "description", columnDefinition = "TEXT")
=======

>>>>>>> cedad45d504a3d9629903eb97f921e8b7b986e07
    private String description;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
