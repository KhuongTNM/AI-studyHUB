package com.aistudyhub.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(schema = "group_chat", name = "group_messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GroupMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @Column(name = "sender_id", nullable = true)
    private UUID senderId;

    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "message_type", length = 20, nullable = false)
    private String messageType;

    @Column(name = "document_id", nullable = true)
    private UUID documentId;

    @Column(name = "image_url", length = 1000, nullable = true)
    private String imageUrl;

    @Column(name = "image_name", length = 255, nullable = true)
    private String imageName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
