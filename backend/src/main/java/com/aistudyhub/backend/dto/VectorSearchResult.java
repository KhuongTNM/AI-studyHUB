package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.DocumentChunk;
import java.util.UUID;

/** Một kết quả tìm kiếm semantic – thông tin về chunk phù hợp nhất. */
public class VectorSearchResult {

    private UUID chunkId;
    private UUID documentId;
    private int chunkIndex;
    private String content;
    private Integer tokenCount;

    /**
     * Điểm tương đồng cosine: 0.0 (không liên quan) – 1.0 (giống hệt).
     * Được tính từ phía application sau khi query pgvector.
     * (pgvector trả về cosine DISTANCE nên score = 1 - distance)
     */
    private double score;

    // ---------- factory ----------

    public static VectorSearchResult from(DocumentChunk chunk, double score) {
        VectorSearchResult r = new VectorSearchResult();
        r.chunkId    = chunk.getId();
        r.documentId = chunk.getDocumentId();
        r.chunkIndex = chunk.getChunkIndex();
        r.content    = chunk.getContent();
        r.tokenCount = chunk.getTokenCount();
        r.score      = Math.round(score * 10_000) / 10_000.0; // 4 chữ số thập phân
        return r;
    }

    // ---------- getters ----------

    public UUID getChunkId() { return chunkId; }
    public UUID getDocumentId() { return documentId; }
    public int getChunkIndex() { return chunkIndex; }
    public String getContent() { return content; }
    public Integer getTokenCount() { return tokenCount; }
    public double getScore() { return score; }
}
