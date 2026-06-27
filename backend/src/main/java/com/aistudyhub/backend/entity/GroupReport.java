package com.aistudyhub.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
<<<<<<< HEAD
@Table(schema = "group_chat", name = "group_reports")
=======
@Table(name = "group_reports")
>>>>>>> cedad45d504a3d9629903eb97f921e8b7b986e07
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GroupReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @Column(name = "reporter_id", nullable = false)
    private UUID reporterId;

    @Column(name = "reason", length = 500, nullable = false)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
