package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.DocumentRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.entity.Folder;
import com.aistudyhub.backend.entity.Tag;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.entity.Visibility;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.FolderRepository;
import com.aistudyhub.backend.repository.TagRepository;
import com.aistudyhub.backend.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentScanProcessor scanProcessor;
    private final FolderRepository folderRepository;
    private final TagRepository tagRepository;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDirPath;

    private Path uploadDir;

    @PostConstruct
    private void init() {
        uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directory: " + uploadDir, e);
        }
    }

    public Document upload(UUID userId, MultipartFile file, String subject, String title,
                           Visibility visibility, String tags) {
        if (subject == null || subject.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Môn học không được để trống.");
        }
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

        Set<Tag> resolvedTags = resolveTags(tags);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại."));

        if (user.getStorageUsedBytes() + file.getSize() > user.getStorageLimitBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Dung lượng lưu trữ không đủ.");
        }

        String storedName = UUID.randomUUID() + "_" + originalName;
        Path targetPath = uploadDir.resolve(storedName);
        LocalDateTime now = LocalDateTime.now();

        Document doc = new Document();
        doc.setId(UUID.randomUUID());
        doc.setUserId(userId);
        doc.setOriginalName(originalName);
        doc.setTitle(title != null && !title.isBlank() ? title : originalName);
        doc.setFileUrl("uploads/" + storedName);
        doc.setFileSizeBytes(file.getSize());
        doc.setFileType(ext);
        doc.setSubject(subject != null ? subject.trim().toLowerCase() : null);
        doc.setTags(resolvedTags);
        doc.setStatus(DocumentStatus.UPLOADING);
        doc.setVisibility(visibility != null ? visibility : Visibility.PRIVATE);
        doc.setDownloadCount(0);
        doc.setCreatedAt(now);
        doc.setUpdatedAt(now);

        // Inline storage update inside this transaction to avoid nested @Transactional
        // + PESSIMISTIC_WRITE deadlock on MSSQL
        user.setStorageUsedBytes(user.getStorageUsedBytes() + file.getSize());
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        Document saved = documentRepository.save(doc);

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            documentRepository.deleteById(saved.getId());
            user.setStorageUsedBytes(Math.max(0, user.getStorageUsedBytes() - file.getSize()));
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi lưu file: " + e.getMessage());
        }

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
    public Document getDocumentForPreview(UUID id, UUID userId, String role) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        if (doc.getDeletedAt() != null || doc.getStatus() != DocumentStatus.READY) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại.");
        }
        boolean isOwner = doc.getUserId().equals(userId);
        boolean isAdminOrSubAdmin = "admin".equals(role) || "sub_admin".equals(role);
        if (!isOwner && !isAdminOrSubAdmin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem tài liệu này.");
        }
        return doc;
    }

    @Transactional(readOnly = true)
    public List<Document> getUserDocuments(UUID userId) {
        return documentRepository.findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public List<Document> getUserDocumentsByTag(UUID userId, String tagName) {
        return documentRepository.findByUserIdAndTagName(userId, tagName);
    }

    @Transactional(readOnly = true)
    public List<Document> getPublicDocuments() {
        return documentRepository.findByVisibilityAndDeletedAtIsNullAndStatus(Visibility.PUBLIC, DocumentStatus.READY);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id, UUID userId) {
        Document doc = getById(id);
        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xóa tài liệu này.");
        }
        // Lưu lại tags trước khi soft-delete để kiểm tra orphan sau
        Set<Tag> docTags = new HashSet<>(doc.getTags());
        doc.setStatus(DocumentStatus.DELETED);
        doc.setDeletedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());
        // saveAndFlush để DB phản ánh deletedAt trước khi query orphan
        documentRepository.saveAndFlush(doc);
        // Xóa tag mồ côi (không còn file active nào dùng)
        deleteOrphanTags(docTags);
        // Inline storage subtraction to avoid nested @Transactional PESSIMISTIC_WRITE deadlock
        userRepository.findById(userId).ifPresent(u -> {
            u.setStorageUsedBytes(Math.max(0, u.getStorageUsedBytes() - doc.getFileSizeBytes()));
            u.setUpdatedAt(LocalDateTime.now());
            userRepository.save(u);
        });
    }

    @Transactional(readOnly = true)
    public List<Document> getTrashDocuments(UUID userId) {
        return documentRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, DocumentStatus.DELETED);
    }

    @Transactional(rollbackFor = Exception.class)
    public Document restoreDocument(UUID id, UUID userId) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        if (doc.getStatus() != DocumentStatus.DELETED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài liệu không ở trạng thái đã xóa.");
        }
        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền khôi phục tài liệu này.");
        }

        String originalName = doc.getOriginalName();
        int dot = originalName.lastIndexOf('.');
        String base = (dot > 0) ? originalName.substring(0, dot) : originalName;
        String ext = (dot > 0) ? originalName.substring(dot) : "";

        List<Document> existing = documentRepository.findByUserIdAndDeletedAtIsNullAndOriginalNameStartingWith(userId, base);
        int maxN = 0;
        Pattern pattern = Pattern.compile(Pattern.quote(base) + " \\((\\d+)\\)" + Pattern.quote(ext));
        for (Document d : existing) {
            Matcher m = pattern.matcher(d.getOriginalName());
            if (m.matches()) {
                int n = Integer.parseInt(m.group(1));
                if (n > maxN) maxN = n;
            }
        }
        if (maxN > 0) {
            String newName = base + " (" + (maxN + 1) + ")" + ext;
            doc.setOriginalName(newName);
            doc.setTitle(newName);
        } else if (documentRepository.countByUserIdAndDeletedAtIsNullAndOriginalName(userId, originalName) > 0) {
            String newName = base + " (2)" + ext;
            doc.setOriginalName(newName);
            doc.setTitle(newName);
        }

        doc.setStatus(DocumentStatus.READY);
        doc.setDeletedAt(null);
        doc.setUpdatedAt(LocalDateTime.now());
        Document restored = documentRepository.save(doc);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại."));
        if (user.getStorageUsedBytes() + doc.getFileSizeBytes() > user.getStorageLimitBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Dung lượng lưu trữ không đủ để khôi phục.");
        }
        // Inline storage addition to avoid nested @Transactional PESSIMISTIC_WRITE deadlock
        user.setStorageUsedBytes(user.getStorageUsedBytes() + doc.getFileSizeBytes());
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        return restored;
    }

    @Transactional(rollbackFor = Exception.class)
    public Document updateVisibility(UUID id, UUID userId, Visibility visibility) {
        Document doc = getById(id);
        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền thay đổi tài liệu này.");
        }
        doc.setVisibility(visibility);
        doc.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(doc);
    }

    @Transactional(rollbackFor = Exception.class)
    public Document incrementDownloadCount(UUID id, UUID userId) {
        Document doc = getDocumentIfAccessible(id, userId);
        if (doc.getStatus() == DocumentStatus.FAILED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài liệu này không thể tải xuống do lỗi scan.");
        }
        doc.setDownloadCount(doc.getDownloadCount() + 1);
        doc.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(doc);
    }

    @Transactional(rollbackFor = Exception.class)
    public Document updateFolderId(UUID documentId, UUID userId, UUID folderId) {
        Document doc = getById(documentId);
        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền thay đổi tài liệu này.");
        }

        if (folderId != null) {
            Folder folder = folderRepository.findById(folderId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Thư mục đích không tồn tại."));
            if (!folder.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Bạn không có quyền di chuyển tài liệu vào thư mục này.");
            }
        }

        doc.setFolderId(folderId);
        doc.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(doc);
    }

    @Transactional(rollbackFor = Exception.class)
    public Document updateDocument(UUID id, UUID userId, DocumentRequest request) {
        Document doc = getById(id);
        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền chỉnh sửa tài liệu này.");
        }

        if (request.getFolderId() != null) {
            Folder folder = folderRepository.findById(request.getFolderId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Thư mục đích không tồn tại."));
            if (!folder.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Bạn không có quyền di chuyển tài liệu vào thư mục này.");
            }
            doc.setFolderId(request.getFolderId());
        }

        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            doc.setTitle(request.getTitle().strip());
        }
        if (request.getSubject() != null && !request.getSubject().isBlank()) {
            doc.setSubject(request.getSubject().strip().toLowerCase());
        }
        if (request.getDescription() != null) {
            doc.setDescription(request.getDescription());
        }
        if (request.getVisibility() != null) {
            try {
                doc.setVisibility(Visibility.valueOf(request.getVisibility().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Visibility chỉ hỗ trợ private hoặc public.");
            }
        }
        if (request.getTags() != null) {
            Set<Tag> oldTags = new HashSet<>(doc.getTags());
            Set<Tag> newTags = resolveTags(request.getTags());
            doc.setTags(newTags);
            doc.setUpdatedAt(LocalDateTime.now());
            documentRepository.saveAndFlush(doc);
            // Xóa orphan tags từ những tag bị gỡ bỏ
            Set<Tag> removedTags = new HashSet<>(oldTags);
            removedTags.removeAll(newTags);
            deleteOrphanTags(removedTags);
            return doc;
        }
        doc.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(doc);
    }

    @Transactional(readOnly = true)
    public List<Document> searchDocuments(UUID userId, String keyword, String subject, String tag) {
        String cleanKeyword = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        String cleanSubject = (subject == null || subject.isBlank()) ? null : subject.trim();
        String cleanTag = (tag == null || tag.isBlank()) ? null : tag.trim();
        if (cleanKeyword == null && cleanSubject == null && cleanTag == null) {
            return getUserDocuments(userId);
        }
        return documentRepository.searchUserDocuments(userId, cleanKeyword, cleanSubject, cleanTag);
    }

    public Path getFilePath(Document doc) {
        String filename = Paths.get(doc.getFileUrl()).getFileName().toString();
        return uploadDir.resolve(filename);
    }

    /** Xóa những tag trong danh sách không còn được gắn với bất kỳ document active nào */
    private void deleteOrphanTags(Set<Tag> candidates) {
        if (candidates == null || candidates.isEmpty()) return;
        Set<Long> candidateIds = candidates.stream()
            .map(Tag::getId)
            .collect(Collectors.toSet());
        List<Tag> orphans = tagRepository.findOrphanTagsAmongIds(candidateIds);
        if (!orphans.isEmpty()) {
            tagRepository.deleteAll(orphans);
        }
    }

    private Set<Tag> resolveTags(String rawTags) {
        if (rawTags == null || rawTags.isBlank()) {
            return new HashSet<>();
        }

        List<String> normalized = Arrays.stream(rawTags.split(","))
                .map(s -> s.trim().toLowerCase())
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();

        normalized.forEach(name -> {
            if (name.length() > 100) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Tên thẻ tag không được vượt quá 100 ký tự");
            }
        });

        return normalized.stream()
                .map(name -> tagRepository.findByName(name)
                        .orElseGet(() -> {
                            Tag tag = new Tag();
                            tag.setName(name);
                            return tagRepository.save(tag);
                        }))
                .collect(Collectors.toCollection(HashSet::new));
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0) return "";
        return filename.substring(dot + 1).toLowerCase();
    }
}
