package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.Tag;
import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public class DocumentResponse {

    private UUID id;
    private UUID userId;
    private UUID folderId;
    private String originalName;
    private String title;
    private String fileUrl;
    private long fileSizeBytes;
    private String fileType;
    private String subject;
    private String description;
    private List<String> tags;
    private String status;
    private String visibility;
    private int downloadCount;
    private String embeddingStatus;

    // API Spec Mục 6 Quyết định #1: cố định 3 chữ số phần thập phân (yyyy-MM-dd'T'HH:mm:ss.SSS'Z'),
    // KHÔNG để Jackson tự serialize Instant theo full nanosecond precision mặc định.
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant createdAt;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private Instant updatedAt;

    public static DocumentResponse from(Document doc) {
        DocumentResponse r = new DocumentResponse();
        r.id = doc.getId();
        r.userId = doc.getUserId();
        r.folderId = doc.getFolderId();
        r.originalName = doc.getOriginalName();
        r.title = doc.getTitle();
        r.fileUrl = doc.getFileUrl();
        r.fileSizeBytes = doc.getFileSizeBytes();
        r.fileType = doc.getFileType();
        r.subject = doc.getSubject();
        r.description = doc.getDescription();
        r.tags = doc.getTags().stream()
                .map(Tag::getName)
                .collect(Collectors.toList());
        r.status = doc.getStatus().name().toLowerCase();
        r.visibility = doc.getVisibility().name().toLowerCase();
        r.downloadCount = doc.getDownloadCount();
        r.embeddingStatus = doc.getEmbeddingStatus();
        r.createdAt = toInstant(doc.getCreatedAt());
        r.updatedAt = toInstant(doc.getUpdatedAt());
        return r;
    }

    /**
     * API Spec Mục 6 Quyết định #1: mọi field thời gian trả về phải là Instant, serialize
     * ISO-8601 UTC có đuôi "Z". Entity vẫn lưu LocalDateTime (cột DB là TIMESTAMPTZ, Hibernate
     * tự quy đổi qua lại theo timezone mặc định của JVM) — dùng ZoneId.systemDefault() để quy
     * đổi ngược đúng về Instant gốc, KHÔNG giả định cứng server đang chạy ở UTC.
     */
    private static Instant toInstant(LocalDateTime dateTime) {
        return dateTime != null ? dateTime.atZone(ZoneId.systemDefault()).toInstant() : null;
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
    public List<String> getTags() { return tags; }
    public String getStatus() { return status; }
    public String getVisibility() { return visibility; }
    public int getDownloadCount() { return downloadCount; }
    public String getEmbeddingStatus() { return embeddingStatus; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}