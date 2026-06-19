package com.aistudyhub.backend.dto;

import java.util.UUID;

public class DocumentRequest {

    private UUID folderId;
    private String title;
    private String subject;
    private String description;
    private String visibility;
    private String tags;

    public UUID getFolderId() { return folderId; }
    public void setFolderId(UUID folderId) { this.folderId = folderId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
}
