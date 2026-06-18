package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.FolderCreateRequest;
import com.aistudyhub.backend.dto.FolderNodeResponse;
import com.aistudyhub.backend.dto.FolderRenameRequest;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.FolderService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * FR-23: Endpoint quản lý thư mục phân cấp của người dùng.
 * Toàn bộ endpoint yêu cầu xác thực JWT (cấu hình tại SecurityConfig).
 */
@RestController
@RequestMapping("/api/folders")
@RequiredArgsConstructor
public class FolderController {

    private final FolderService folderService;

    /**
     * POST /api/folders
     * Tạo thư mục mới (gốc hoặc con) cho người dùng đang đăng nhập.
     * Trả về HTTP 201 Created kèm thông tin thư mục vừa tạo.
     */
    @PostMapping
    public ResponseEntity<FolderNodeResponse> createFolder(
            @Valid @RequestBody FolderCreateRequest request) {
        UUID userId = getCurrentUserId();
        FolderNodeResponse response = folderService.createFolder(userId, request);
        return ResponseEntity.status(201).body(response);
    }

    /**
     * GET /api/folders
     * Lấy toàn bộ cây thư mục phân cấp lồng nhau của người dùng đang đăng nhập.
     * Trả về danh sách các thư mục gốc, mỗi thư mục mang theo cây con đầy đủ.
     */
    @GetMapping
    public ResponseEntity<List<FolderNodeResponse>> getFolderTree() {
        UUID userId = getCurrentUserId();
        return ResponseEntity.ok(folderService.getFolderTree(userId));
    }

    /**
     * PUT /api/folders/{id}
     * Đổi tên (và tùy chọn cập nhật môn học) của một thư mục.
     * Trả về HTTP 200 OK kèm thông tin thư mục sau khi cập nhật.
     */
    @PutMapping("/{id}")
    public ResponseEntity<FolderNodeResponse> renameFolder(
            @PathVariable UUID id,
            @Valid @RequestBody FolderRenameRequest request) {
        UUID userId = getCurrentUserId();
        return ResponseEntity.ok(folderService.renameFolder(userId, id, request));
    }

    /**
     * DELETE /api/folders/{id}
     * Xóa một thư mục và toàn bộ cây con. Các Document bên trong được tách liên kết (BR-085).
     * Trả về HTTP 204 No Content khi xóa thành công.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable UUID id) {
        UUID userId = getCurrentUserId();
        folderService.deleteFolder(userId, id);
        return ResponseEntity.noContent().build();
    }

    /**
     * PUT /api/folders/{id}/move
     * Di chuyển một thư mục sang vị trí mới trong cây phân cấp (BR-087).
     * targetParentId = null (bỏ qua param) để đưa thư mục lên cấp gốc.
     * Trả về HTTP 200 OK khi di chuyển thành công.
     */
    @PutMapping("/{id}/move")
    public ResponseEntity<Void> moveFolder(
            @PathVariable UUID id,
            @RequestParam(required = false) UUID targetParentId) {
        UUID userId = getCurrentUserId();
        folderService.moveFolder(userId, id, targetParentId);
        return ResponseEntity.ok().build();
    }

    /**
     * Trích xuất UUID người dùng hiện tại từ Security Context.
     * Ném lỗi 401 nếu principal không hợp lệ — phiên hết hạn hoặc chưa xác thực.
     */
    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof AuthUserPrincipal authPrincipal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ.");
        }
        return authPrincipal.getId();
    }
}
