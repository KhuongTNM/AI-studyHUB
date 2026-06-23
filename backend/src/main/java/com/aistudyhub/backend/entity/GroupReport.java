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
@Table(name = "group_reports")
@Getter
@Setter
@NoArgsConstructor
public class GroupReport {

    @Id
    private UUID id;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @Column(name = "reporter_id", nullable = false)
    private UUID reporterId;

    @Column(name = "reason", nullable = false, length = 500, columnDefinition = "NVARCHAR(500)")
    private String reason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
