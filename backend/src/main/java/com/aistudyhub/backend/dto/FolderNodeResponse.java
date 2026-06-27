package com.aistudyhub.backend.dto;

import java.util.List;
import java.util.UUID;

/**
 * FR-23: Đại diện cho một nút trong cây thư mục phân cấp trả về cho Frontend.
 * Trường children chứa danh sách các nút con trực tiếp — rỗng nếu là nút lá.
 * Không chứa tham chiếu ngược lên cha để tránh vòng lặp JSON vô hạn khi tuần tự hóa.
 */
public class FolderNodeResponse {

    private final UUID id;
    private final String name;
    private final String subject;
    private final List<FolderNodeResponse> children;

    public FolderNodeResponse(UUID id, String name, String subject, List<FolderNodeResponse> children) {
        this.id = id;
        this.name = name;
        this.subject = subject;
        this.children = children;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getSubject() {
        return subject;
    }

    public List<FolderNodeResponse> getChildren() {
        return children;
    }
}
