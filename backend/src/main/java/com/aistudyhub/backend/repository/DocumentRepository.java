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
import org.springframework.lang.Nullable;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    List<Document> findByUserIdAndStatusAndDeletedAtIsNull(UUID userId, DocumentStatus status);

    List<Document> findByVisibilityAndDeletedAtIsNullAndStatus(Visibility visibility, DocumentStatus status);

    List<Document> findByStatusAndDeletedAtIsNull(DocumentStatus status);

    @Query("SELECT d FROM Document d WHERE d.status = :status AND d.deletedAt < :before")
    org.springframework.data.domain.Page<Document> findByStatusAndDeletedAtBefore(@Param("status") DocumentStatus status, @Param("before") java.time.LocalDateTime before, org.springframework.data.domain.Pageable pageable);

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
    @Query("SELECT DISTINCT d FROM Document d LEFT JOIN d.tags t WHERE d.userId = :userId AND d.deletedAt IS NULL " +
           "AND (:keyword IS NULL OR LOWER(d.title) LIKE LOWER(CONCAT('%', :keyword, '%')) " +
           "     OR LOWER(d.originalName) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "AND (:subject IS NULL OR LOWER(d.subject) = LOWER(:subject)) " +
           "AND (:tag IS NULL OR LOWER(t.name) = LOWER(:tag)) " +
           "ORDER BY d.createdAt DESC")
    List<Document> searchUserDocuments(@Param("userId") UUID userId,
                                       @Nullable @Param("keyword") String keyword,
                                       @Nullable @Param("subject") String subject,
                                       @Nullable @Param("tag") String tag);
}
