package com.aistudyhub.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
<<<<<<< HEAD
@Table(schema = "group_chat", name = "group_messages")
=======
@Table(name = "group_messages")
>>>>>>> cedad45d504a3d9629903eb97f921e8b7b986e07
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

<<<<<<< HEAD
    @Column(name = "content", columnDefinition = "TEXT", nullable = false)
=======
    @Column(name = "content", columnDefinition = "NVARCHAR(MAX)", nullable = false)
>>>>>>> cedad45d504a3d9629903eb97f921e8b7b986e07
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
