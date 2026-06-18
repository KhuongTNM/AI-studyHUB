package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.entity.Visibility;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    List<Document> findByUserIdAndStatusAndDeletedAtIsNull(UUID userId, DocumentStatus status);

    List<Document> findByVisibilityAndDeletedAtIsNullAndStatus(Visibility visibility, DocumentStatus status);

    List<Document> findByStatusAndDeletedAtIsNull(DocumentStatus status);

    long countByUserIdAndDeletedAtIsNull(UUID userId);

    // ADDED FOR BR-022/023
    List<Document> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, DocumentStatus status);

    long countByUserIdAndDeletedAtIsNullAndOriginalName(UUID userId, String originalName);

    List<Document> findByUserIdAndDeletedAtIsNullAndOriginalNameStartingWith(UUID userId, String prefix);

    /**
     * BR-085: Gán folderId = NULL cho tất cả Document nằm trong các thư mục sắp bị xóa.
     * Được gọi TRƯỚC khi xóa Folder để tránh tham chiếu mồ côi.
     *
     * @param folderIds Tập hợp UUID của các thư mục (gồm thư mục gốc và toàn bộ cây con)
     *                  sẽ bị xóa.
     */
    @Modifying
    @Query("UPDATE Document d SET d.folderId = NULL WHERE d.folderId IN :folderIds")
    void clearFolderIdByFolderIds(Collection<UUID> folderIds);
}
