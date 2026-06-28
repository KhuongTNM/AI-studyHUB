package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một "mảnh" văn bản đã được chunk + embed từ Document.
 * Lưu tại bảng ai.document_chunks (pgvector).
 */
@Entity
@Table(schema = "ai", name = "document_chunks")
public class DocumentChunk {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Thứ tự chunk trong document (bắt đầu từ 0). */
    @Column(name = "chunk_index", nullable = false)
    private int chunkIndex;

    /** Nội dung text gốc của chunk này. */
    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    /** Ước tính số token (chars / 4). */
    @Column(name = "token_count")
    private Integer tokenCount;

    /**
     * Vector embedding 1536 chiều từ OpenAI text-embedding-3-small.
     * Lưu dưới dạng pgvector: "[0.12,0.34,...]"
     * Dùng VectorFloatConverter để convert float[] <-> String.
     */
    @Convert(converter = VectorFloatConverter.class)
    @Column(name = "embedding", columnDefinition = "vector(1536)")
    private float[] embedding;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    // ---------- getters / setters ----------

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public int getChunkIndex() { return chunkIndex; }
    public void setChunkIndex(int chunkIndex) { this.chunkIndex = chunkIndex; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Integer getTokenCount() { return tokenCount; }
    public void setTokenCount(Integer tokenCount) { this.tokenCount = tokenCount; }

    public float[] getEmbedding() { return embedding; }
    public void setEmbedding(float[] embedding) { this.embedding = embedding; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
