package com.aistudyhub.backend.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class StudyRoomMessageResponse {
    private UUID id;
    private UUID senderId;
    private String senderName;
    private String content;
    private String messageType;
    private UUID documentId;
    private String documentName;
    private String documentSubject;
    private String documentType;
    private String documentVisibility;
    private boolean documentDownloadable;
    private LocalDateTime createdAt;

    public StudyRoomMessageResponse(
            UUID id,
            UUID senderId,
            String senderName,
            String content,
            String messageType,
            UUID documentId,
            String documentName,
            String documentSubject,
            String documentType,
            String documentVisibility,
            boolean documentDownloadable,
            LocalDateTime createdAt) {
        this.id = id;
        this.senderId = senderId;
        this.senderName = senderName;
        this.content = content;
        this.messageType = messageType;
        this.documentId = documentId;
        this.documentName = documentName;
        this.documentSubject = documentSubject;
        this.documentType = documentType;
        this.documentVisibility = documentVisibility;
        this.documentDownloadable = documentDownloadable;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getSenderId() { return senderId; }
    public String getSenderName() { return senderName; }
    public String getContent() { return content; }
    public String getMessageType() { return messageType; }
    public UUID getDocumentId() { return documentId; }
    public String getDocumentName() { return documentName; }
    public String getDocumentSubject() { return documentSubject; }
    public String getDocumentType() { return documentType; }
    public String getDocumentVisibility() { return documentVisibility; }
    public boolean isDocumentDownloadable() { return documentDownloadable; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
