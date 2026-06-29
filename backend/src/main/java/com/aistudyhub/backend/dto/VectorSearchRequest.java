package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Request body cho endpoint tìm kiếm semantic. */
public class VectorSearchRequest {

    @NotBlank(message = "Câu truy vấn không được để trống.")
    @Size(max = 1000, message = "Câu truy vấn tối đa 1000 ký tự.")
    private String query;

    /**
     * (Tùy chọn) Giới hạn tìm kiếm trong 1 document cụ thể.
     * Nếu null → tìm trong toàn bộ document của user.
     */
    private UUID documentId;

    /** Số kết quả trả về. Mặc định 5, tối đa 20. */
    @Min(1) @Max(20)
    private int topK = 5;

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }

    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }

    public int getTopK() { return topK; }
    public void setTopK(int topK) { this.topK = topK; }
}
