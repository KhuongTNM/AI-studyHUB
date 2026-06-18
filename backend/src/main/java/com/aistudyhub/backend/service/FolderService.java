package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.FolderCreateRequest;
import com.aistudyhub.backend.dto.FolderNodeResponse;
import com.aistudyhub.backend.dto.FolderRenameRequest;
import java.util.List;
import java.util.UUID;

/**
 * FR-23: Hợp đồng nghiệp vụ cho tính năng quản lý thư mục phân cấp.
 * Triển khai cụ thể tại {@link FolderServiceImpl}.
 */
public interface FolderService {

    /**
     * Tạo một thư mục mới (gốc hoặc con) thuộc quyền sở hữu của người dùng.
     *
     * @param userId  UUID của người dùng đang đăng nhập.
     * @param request Dữ liệu tạo thư mục từ Frontend.
     * @return Thông tin thư mục vừa tạo dưới dạng DTO.
     */
    FolderNodeResponse createFolder(UUID userId, FolderCreateRequest request);

    /**
     * Lấy toàn bộ cây thư mục phân cấp lồng nhau của người dùng.
     *
     * @param userId UUID của người dùng đang đăng nhập.
     * @return Danh sách các nút gốc, mỗi nút mang theo toàn bộ cây con bên trong.
     */
    List<FolderNodeResponse> getFolderTree(UUID userId);

    /**
     * Đổi tên (và tùy chọn cập nhật môn học) của một thư mục.
     *
     * @param userId   UUID người dùng đang đăng nhập.
     * @param folderId UUID thư mục cần đổi tên.
     * @param request  Tên mới và môn học mới (môn học null = giữ nguyên).
     * @return Thông tin thư mục sau khi cập nhật.
     */
    FolderNodeResponse renameFolder(UUID userId, UUID folderId, FolderRenameRequest request);

    /**
     * Xóa một thư mục cùng toàn bộ cây con của nó.
     * Các Document bên trong được gán folderId = NULL trước khi xóa (BR-085).
     *
     * @param userId   UUID người dùng đang đăng nhập.
     * @param folderId UUID thư mục cần xóa.
     */
    void deleteFolder(UUID userId, UUID folderId);

    /**
     * Di chuyển một thư mục sang vị trí mới trong cây phân cấp (BR-087).
     * Bao gồm kiểm tra chống vòng lặp và kế thừa môn học từ thư mục đích.
     *
     * @param userId         UUID người dùng đang đăng nhập.
     * @param folderId       UUID thư mục cần di chuyển.
     * @param targetParentId UUID thư mục đích (null = đưa lên cấp gốc).
     */
    void moveFolder(UUID userId, UUID folderId, UUID targetParentId);
}
