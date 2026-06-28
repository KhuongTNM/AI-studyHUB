package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.DocumentChunk;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, UUID> {

    /** Lấy tất cả chunks của một document theo thứ tự. */
    List<DocumentChunk> findByDocumentIdOrderByChunkIndex(UUID documentId);

    /** Xóa toàn bộ chunks khi re-process document. */
    @Modifying
    @Transactional
    void deleteByDocumentId(UUID documentId);

    /**
     * Tìm kiếm semantic theo cosine similarity trong TOÀN BỘ document của user.
     *
     * <p>Cú pháp pgvector: embedding <=> queryVector::vector
     *    (<=> = cosine distance; nhỏ hơn = tương đồng hơn)
     *
     * @param userId      UUID của user đang tìm kiếm
     * @param queryVector chuỗi vector "[x1,x2,...]"
     * @param topK        số kết quả trả về
     */
    @Query(value = """
            SELECT *
            FROM   ai.document_chunks
            WHERE  user_id = :userId
              AND  embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:queryVector AS vector)
            LIMIT  :topK
            """, nativeQuery = true)
    List<DocumentChunk> searchByEmbeddingForUser(
            @Param("userId") UUID userId,
            @Param("queryVector") String queryVector,
            @Param("topK") int topK
    );

    /**
     * Tìm kiếm semantic trong một document cụ thể.
     */
    @Query(value = """
            SELECT *
            FROM   ai.document_chunks
            WHERE  document_id = :documentId
              AND  embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:queryVector AS vector)
            LIMIT  :topK
            """, nativeQuery = true)
    List<DocumentChunk> searchByEmbeddingInDocument(
            @Param("documentId") UUID documentId,
            @Param("queryVector") String queryVector,
            @Param("topK") int topK
    );

    /** Đếm số chunks đã có embedding trong một document. */
    @Query("SELECT COUNT(c) FROM DocumentChunk c WHERE c.documentId = :documentId AND c.embedding IS NOT NULL")
    long countEmbeddedChunks(@Param("documentId") UUID documentId);
}
