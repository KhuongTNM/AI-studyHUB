package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.FolderCreateRequest;
import com.aistudyhub.backend.dto.FolderNodeResponse;
import com.aistudyhub.backend.dto.FolderRenameRequest;
import com.aistudyhub.backend.dto.FolderUpdateRequest;
import java.util.List;
import java.util.UUID;
public interface FolderService {
    FolderNodeResponse createFolder(UUID userId, FolderCreateRequest request);
    List<FolderNodeResponse> getFolderTree(UUID userId);
    FolderNodeResponse renameFolder(UUID userId, UUID folderId, FolderRenameRequest request);
    void deleteFolder(UUID userId, UUID folderId);
    void moveFolder(UUID userId, UUID folderId, UUID targetParentId);
    FolderNodeResponse updateFolder(UUID userId, UUID folderId, FolderUpdateRequest request);
}
