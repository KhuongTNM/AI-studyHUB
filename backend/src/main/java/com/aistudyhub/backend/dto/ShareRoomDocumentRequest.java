package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class ShareRoomDocumentRequest {
    @NotNull(message = "Tài liệu không được để trống.")
    private UUID documentId;

    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }
}
