package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "groups")
@Getter
@Setter
@NoArgsConstructor
public class Group {

    @Id
    private UUID id;

    @Column(name = "group_code", nullable = false, unique = true, length = 32,
            columnDefinition = "NVARCHAR(32)")
    private String groupCode;

    @Column(name = "password_hash", nullable = false, length = 255,
            columnDefinition = "NVARCHAR(255)")
    private String passwordHash;

    @Column(name = "name", nullable = false, length = 120,
            columnDefinition = "NVARCHAR(120)")
    private String name;

    @Column(name = "description", length = 500,
            columnDefinition = "NVARCHAR(500)")
    private String description;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
