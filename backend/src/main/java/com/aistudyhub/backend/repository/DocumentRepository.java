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
import org.springframework.transaction.annotation.Transactional;

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

    /** FR-24/folder-delete: Tìm tất cả doc đang active trong danh sách folder IDs để soft-delete */
    List<Document> findByFolderIdInAndDeletedAtIsNull(Collection<UUID> folderIds);

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

    /**
     * BR mới (mục 3, AI-studyHUB_API_File.docx): check trùng originalName
     * TRONG CÙNG 1 folder (folderId có thể NULL = root). So sánh không phân
     * biệt hoa/thường. Dùng để chặn upload trùng tên -> trả 409, KHÔNG auto-rename.
     */
    @Query("SELECT COUNT(d) FROM Document d WHERE d.userId = :userId AND d.deletedAt IS NULL " +
           "AND ((:folderId IS NULL AND d.folderId IS NULL) OR d.folderId = :folderId) " +
           "AND LOWER(d.originalName) = LOWER(:originalName)")
    long countActiveDuplicateInFolder(@Param("userId") UUID userId,
                                       @Nullable @Param("folderId") UUID folderId,
                                       @Param("originalName") String originalName);

       @Modifying
       @Transactional
       @Query(value = """
              UPDATE docs.documents
              SET    embedding_status = :status,
                     updated_at       = NOW()
              WHERE  id = :documentId
              """, nativeQuery = true)
       void updateEmbeddingStatus(
              @Param("documentId") UUID documentId,
              @Param("status") String status
       );

    /**
     * Tìm tất cả document của một user có embedding_status nằm trong danh sách
     * (ví dụ: 'none', 'failed') và chưa bị xóa mềm. Dùng cho bulk reingest.
     */
    List<Document> findByUserIdAndEmbeddingStatusInAndDeletedAtIsNull(UUID userId, List<String> statuses);
}
