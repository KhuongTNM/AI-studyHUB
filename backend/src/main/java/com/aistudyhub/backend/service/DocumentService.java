package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.entity.Visibility;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentScanProcessor scanProcessor;
    private final Path uploadDir;

    public DocumentService(
            DocumentRepository documentRepository,
            UserRepository userRepository,
            DocumentScanProcessor scanProcessor,
            @Value("${app.upload.dir:./uploads}") String uploadDirPath) {
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.scanProcessor = scanProcessor;
        this.uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory: " + this.uploadDir, e);
        }
    }

    @Transactional
    public Document upload(UUID userId, MultipartFile file, String subject, String title, Visibility visibility) {
        if (file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File không được để trống.");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tên file không hợp lệ.");
        }

        String ext = getExtension(originalName);
        if (!List.of("pdf", "docx", "pptx").contains(ext)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Chỉ hỗ trợ file PDF, DOCX, PPTX.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại."));

        if (user.getStorageUsedBytes() + file.getSize() > user.getStorageLimitBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "Dung lượng lưu trữ không đủ.");
        }

        String storedName = UUID.randomUUID() + "_" + originalName;
        Path targetPath = uploadDir.resolve(storedName);
        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi lưu file: " + e.getMessage());
        }

        LocalDateTime now = LocalDateTime.now();
        Document doc = new Document();
        doc.setId(UUID.randomUUID());
        doc.setUserId(userId);
        doc.setOriginalName(originalName);
        doc.setTitle(title != null && !title.isBlank() ? title : originalName);
        doc.setFileUrl("uploads/" + storedName);
        doc.setFileSizeBytes(file.getSize());
        doc.setFileType(ext);
        doc.setSubject(subject);
        doc.setStatus(DocumentStatus.UPLOADING);
        doc.setVisibility(visibility != null ? visibility : Visibility.PRIVATE);
        doc.setDownloadCount(0);
        doc.setCreatedAt(now);
        doc.setUpdatedAt(now);

        user.setStorageUsedBytes(user.getStorageUsedBytes() + file.getSize());
        userRepository.save(user);

        Document saved = documentRepository.save(doc);
        scanProcessor.simulateScan(saved.getId());
        return saved;
    }

    @Transactional(readOnly = true)
    public Document getById(UUID id) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        if (doc.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại.");
        }
        return doc;
    }

    @Transactional(readOnly = true)
    public Document getDocumentIfAccessible(UUID id, UUID userId) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        if (doc.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại.");
        }
        boolean isOwner = doc.getUserId().equals(userId);
        boolean isPublicReady = doc.getVisibility() == Visibility.PUBLIC && doc.getStatus() == DocumentStatus.READY;
        if (!isOwner && !isPublicReady) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem tài liệu này.");
        }
        return doc;
    }

    @Transactional(readOnly = true)
    public List<Document> getUserDocuments(UUID userId) {
        return documentRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<Document> getPublicDocuments() {
        return documentRepository.findByVisibilityAndDeletedAtIsNullAndStatus(Visibility.PUBLIC, DocumentStatus.READY);
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        Document doc = getById(id);
        if (!doc.getUserId().equals(userId)) {
            User currentUser = getCurrentUser();
            if (currentUser.getRole() != User.Role.admin && currentUser.getRole() != User.Role.sub_admin) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xóa tài liệu này.");
            }
        }
        doc.setStatus(DocumentStatus.DELETED);
        doc.setDeletedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());
        documentRepository.save(doc);
    }

    // ==================== BR-022/023: SOFT DELETE & RESTORE ====================

    @Transactional(readOnly = true)
    public List<Document> getTrashDocuments(UUID userId) {
        return documentRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, DocumentStatus.DELETED);
    }

    @Transactional(readOnly = true)
    public List<Document> getAllTrashDocuments() {
        return documentRepository.findByStatusOrderByCreatedAtDesc(DocumentStatus.DELETED);
    }

    @Transactional
    public Document restoreDocument(UUID id, UUID userId) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        if (doc.getStatus() != DocumentStatus.DELETED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài liệu không ở trạng thái đã xóa.");
        }
        if (!doc.getUserId().equals(userId)) {
            User currentUser = getCurrentUser();
            if (currentUser.getRole() != User.Role.admin && currentUser.getRole() != User.Role.sub_admin) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền khôi phục tài liệu này.");
            }
        }
        doc.setStatus(DocumentStatus.READY);
        doc.setDeletedAt(null);
        doc.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(doc);
    }

    @Transactional
    public Document updateVisibility(UUID id, UUID userId, Visibility visibility) {
        Document doc = getById(id);
        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền thay đổi tài liệu này.");
        }
        doc.setVisibility(visibility);
        doc.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(doc);
    }

    @Transactional
    public Document incrementDownloadCount(UUID id, UUID userId) {
        Document doc = getDocumentIfAccessible(id, userId);
        if (doc.getStatus() == DocumentStatus.FAILED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài liệu này không thể tải xuống do lỗi scan.");
        }
        doc.setDownloadCount(doc.getDownloadCount() + 1);
        doc.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(doc);
    }

    public Path getFilePath(Document doc) {
        return Paths.get(doc.getFileUrl());
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0) return "";
        return filename.substring(dot + 1).toLowerCase();
    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof AuthUserPrincipal authPrincipal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ.");
        }
        return authPrincipal.getId();
    }
}
