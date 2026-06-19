package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.Document;
import java.time.LocalDateTime;
import java.util.UUID;

public class DocumentResponse {

    private UUID id;
    private UUID userId;
    private UUID folderId;   // FR-23: ID thư mục chứa tài liệu; null = root
    private String originalName;
    private String title;
    private String fileUrl;
    private long fileSizeBytes;
    private String fileType;
    private String subject;
    private String description;
    private String tags;
    private String status;
    private String visibility;
    private int downloadCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static DocumentResponse from(Document doc) {
        DocumentResponse r = new DocumentResponse();
        r.id = doc.getId();
        r.userId = doc.getUserId();
        r.folderId = doc.getFolderId();   // <-- thêm
        r.originalName = doc.getOriginalName();
        r.title = doc.getTitle();
        r.fileUrl = doc.getFileUrl();
        r.fileSizeBytes = doc.getFileSizeBytes();
        r.fileType = doc.getFileType();
        r.subject = doc.getSubject();
        r.description = doc.getDescription();
        r.tags = doc.getTags();
        r.status = doc.getStatus().name().toLowerCase();
        r.visibility = doc.getVisibility().name().toLowerCase();
        r.downloadCount = doc.getDownloadCount();
        r.createdAt = doc.getCreatedAt();
        r.updatedAt = doc.getUpdatedAt();
        return r;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public UUID getFolderId() { return folderId; }
    public String getOriginalName() { return originalName; }
    public String getTitle() { return title; }
    public String getFileUrl() { return fileUrl; }
    public long getFileSizeBytes() { return fileSizeBytes; }
    public String getFileType() { return fileType; }
    public String getSubject() { return subject; }
    public String getDescription() { return description; }
    public String getTags() { return tags; }
    public String getStatus() { return status; }
    public String getVisibility() { return visibility; }
    public int getDownloadCount() { return downloadCount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
