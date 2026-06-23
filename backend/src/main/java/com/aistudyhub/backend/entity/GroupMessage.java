package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "group_messages")
@Getter
@Setter
@NoArgsConstructor
public class GroupMessage {

    @Id
    private UUID id;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", insertable = false, updatable = false)
    private Group group;

    @Column(name = "sender_id")
    private UUID senderId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", insertable = false, updatable = false)
    private User sender;

    @Column(name = "content", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String content;

    @Convert(converter = GroupMessageTypeConverter.class)
    @Column(name = "message_type", nullable = false, length = 20, columnDefinition = "NVARCHAR(20)")
    private GroupMessageType messageType;

    @Column(name = "document_id")
    private UUID documentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", insertable = false, updatable = false)
    private Document document;

    @Column(name = "image_url", length = 1000, columnDefinition = "NVARCHAR(1000)")
    private String imageUrl;

    @Column(name = "image_name", length = 255, columnDefinition = "NVARCHAR(255)")
    private String imageName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
