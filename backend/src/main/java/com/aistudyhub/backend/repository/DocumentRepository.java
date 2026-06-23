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
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    List<Document> findByUserIdAndStatusAndDeletedAtIsNull(UUID userId, DocumentStatus status);

    List<Document> findByVisibilityAndDeletedAtIsNullAndStatus(Visibility visibility, DocumentStatus status);

    List<Document> findByStatusAndDeletedAtIsNull(DocumentStatus status);

    long countByUserIdAndDeletedAtIsNull(UUID userId);

    List<Document> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, DocumentStatus status);

    long countByUserIdAndDeletedAtIsNullAndOriginalName(UUID userId, String originalName);

    List<Document> findByUserIdAndDeletedAtIsNullAndOriginalNameStartingWith(UUID userId, String prefix);

    @Query("SELECT d FROM Document d JOIN d.tags t WHERE d.userId = :userId AND d.deletedAt IS NULL AND t.name = :tagName ORDER BY d.createdAt DESC")
    List<Document> findByUserIdAndTagName(@Param("userId") UUID userId, @Param("tagName") String tagName);

    @Modifying
    @Query("UPDATE Document d SET d.folderId = NULL WHERE d.folderId IN :folderIds")
    void clearFolderIdByFolderIds(Collection<UUID> folderIds);

    @Modifying
    @Query("UPDATE Document d SET d.deletedAt = :deletedAt WHERE d.userId = :userId AND d.deletedAt IS NULL")
    void softDeleteByUserId(@Param("userId") UUID userId, @Param("deletedAt") java.time.LocalDateTime deletedAt);
}
