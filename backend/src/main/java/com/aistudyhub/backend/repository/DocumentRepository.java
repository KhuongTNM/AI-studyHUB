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

    @Query("SELECT d FROM Document d JOIN d.tags t WHERE d.userId = :userId AND d.deletedAt IS NULL AND t.name = :tagName ORDER BY d.createdAt DESC")
    List<Document> findByUserIdAndTagName(@Param("userId") UUID userId, @Param("tagName") String tagName);

    /** FR-24/folder-delete: Tìm tất cả doc đang active trong danh sách folder IDs để soft-delete */
    List<Document> findByFolderIdInAndDeletedAtIsNull(Collection<UUID> folderIds);

    @Modifying
    @Query("UPDATE Document d SET d.folderId = NULL WHERE d.folderId IN :folderIds")
    void clearFolderIdByFolderIds(Collection<UUID> folderIds);

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
     * BR-112 (Duplicate File Name Upload Guard): check trùng originalName
     * TRONG CÙNG 1 folder (folderId có thể NULL = root) của CÙNG 1 user. So sánh không phân
     * biệt hoa/thường (LOWER), chỉ tính bản ghi Active (deletedAt IS NULL) — tài liệu đã
     * soft-delete trong Thùng rác KHÔNG tính là trùng (Business Logic Mục 5.1).
     * Dùng để chặn upload trùng tên ở tầng Service -> trả 409, KHÔNG auto-rename.
     * Đây là bước check SỚM phục vụ trải nghiệm; chốt chặn cuối cùng chống race-condition
     * là ràng buộc UNIQUE ux_docs_active_dup_name ở DB (xem migration_duplicate_file_name_guard.sql).
     */
    @Query("SELECT COUNT(d) FROM Document d WHERE d.userId = :userId AND d.deletedAt IS NULL " +
           "AND ((:folderId IS NULL AND d.folderId IS NULL) OR d.folderId = :folderId) " +
           "AND LOWER(d.originalName) = LOWER(:originalName)")
    long countActiveDuplicateInFolder(@Param("userId") UUID userId,
                                       @Nullable @Param("folderId") UUID folderId,
                                       @Param("originalName") String originalName);

    /**
     * BR-11x (Restore Duplicate Guard): tìm các bản Active cùng user + ĐÚNG cùng folder
     * (folderId có thể NULL = root, xử lý null-safe giống countActiveDuplicateInFolder) có tên
     * bắt đầu bằng prefix — dùng để tính số hậu tố " (n)" lớn nhất khi khôi phục kèm autoRename.
     * Giới hạn đúng phạm vi folder (khác 1 lần đếm trùng tên toàn-user trước đây) để nhất quán
     * với BR-112 — tránh đổi tên nhầm khi trùng tên nhưng ở KHÁC folder.
     */
    @Query("SELECT d FROM Document d WHERE d.userId = :userId AND d.deletedAt IS NULL " +
           "AND ((:folderId IS NULL AND d.folderId IS NULL) OR d.folderId = :folderId) " +
           "AND LOWER(d.originalName) LIKE LOWER(CONCAT(:prefix, '%'))")
    List<Document> findActiveByFolderAndNamePrefix(@Param("userId") UUID userId,
                                                     @Nullable @Param("folderId") UUID folderId,
                                                     @Param("prefix") String prefix);

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
