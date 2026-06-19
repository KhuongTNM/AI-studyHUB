package com.aistudyhub.backend.dto;

import java.util.UUID;

/**
 * FR-23 / BR-085: Dữ liệu gửi lên từ Frontend để cập nhật thư mục chứa tài liệu.
 * folderId = null → chuyển tài liệu về thư mục gốc (Folder_ID = NULL).
 */
public class UpdateDocumentFolderRequest {

    /** UUID thư mục đích. null = chuyển về root (Folder_ID = NULL). */
    private UUID folderId;

    public UUID getFolderId() {
        return folderId;
    }

    public void setFolderId(UUID folderId) {
        this.folderId = folderId;
    }
}
