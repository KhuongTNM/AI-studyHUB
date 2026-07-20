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

import org.springframework.context.ApplicationContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Page;
import org.springframework.transaction.annotation.Propagation;

@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final DocumentScanProcessor scanProcessor;
    private final FolderRepository folderRepository;
    private final TagRepository tagRepository;
    private final StorageService storageService;
    private final ApplicationContext applicationContext;

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

    @Transactional(rollbackFor = Exception.class)
    public Document upload(UUID userId, MultipartFile file, String subject, String title,
                           Visibility visibility, String tags, UUID folderId) {
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

        // Nếu có chỉ định folder, xác thực folder tồn tại và thuộc về chính user này (BR-080).
        if (folderId != null) {
            Folder folder = folderRepository.findById(folderId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Thư mục đích không tồn tại."));
            if (!folder.getUser().getId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Bạn không có quyền upload vào thư mục này.");
            }
        }

        // BR mới (mục 3, docx): chặn trùng originalName trong CÙNG 1 folder
        // (kể cả cả 2 đều root/null) — KHÔNG auto-rename, trả 409 để FE giữ nguyên form.
        if (documentRepository.countActiveDuplicateInFolder(userId, folderId, originalName) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "File đã tồn tại trong thư mục này.");
        }

        Set<Tag> resolvedTags = resolveTags(tags);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại."));

        if (user.getStorageUsedBytes() + file.getSize() > user.getStorageLimitBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Dung lượng lưu trữ không đủ.");
        }

        String storedName = UUID.randomUUID() + "_" + sanitizeFileName(originalName);

        // Upload lên Supabase Storage TRƯỚC khi tạo bản ghi DB.
        // Nếu lỗi thì chưa đụng gì tới DB, không cần rollback thủ công.
        String fileUrl = storageService.uploadToSupabase(file, storedName);

        LocalDateTime now = LocalDateTime.now();

        Document doc = new Document();
        doc.setId(UUID.randomUUID());
        doc.setUserId(userId);
        doc.setFolderId(folderId);
        doc.setOriginalName(originalName);
        doc.setTitle(title != null && !title.isBlank() ? title : originalName);
        doc.setFileUrl(fileUrl);
        doc.setFileSizeBytes(file.getSize());
        doc.setFileType(ext);
        doc.setSubject(subject != null ? subject.trim().toLowerCase() : null);
        doc.setTags(resolvedTags);
        doc.setStatus(DocumentStatus.UPLOADING);
        doc.setVisibility(visibility != null ? visibility : Visibility.PRIVATE);
        doc.setDownloadCount(0);
        doc.setCreatedAt(now);
        doc.setUpdatedAt(now);

        user.setStorageUsedBytes(user.getStorageUsedBytes() + file.getSize());
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
        final Document saved = documentRepository.save(doc);

        if (org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) {
            org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        scanProcessor.simulateScan(saved.getId());
                    }
                }
            );
        } else {
            scanProcessor.simulateScan(saved.getId());
        }
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

    /**
     * Trả về 1 Path LOCAL để đọc bytes trực tiếp, dùng cho preview/download.
     * - fileUrl là Supabase public URL (trường hợp thật, luôn xảy ra với file mới)
     *   -> tải về cache tại uploadDir/remote-cache/{id}.{ext}, tái sử dụng lần sau.
     * - fileUrl là path local (tương thích ngược, file cũ) -> dùng trực tiếp.
     *
     * Trước đây controller redirect (302) thẳng ra Supabase nên KHÔNG kiểm soát
     * được Content-Type/Content-Disposition/convert PDF — đây là chỗ sửa gốc.
     */
    public Path getLocalFileForServing(Document doc) {
        String fileUrl = doc.getFileUrl();
        if (fileUrl != null && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))) {
            Path cacheDir = uploadDir.resolve("remote-cache");
            Path cacheFile = cacheDir.resolve(doc.getId() + "." + doc.getFileType());
            return storageService.fetchRemoteFileToCache(fileUrl, cacheFile);
        }
        return getFilePath(doc);
    }

    /** Dùng bởi PdfPreviewService để đặt cache PDF cùng gốc với thư mục upload. */
    public Path getUploadDir() {
        return uploadDir;
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

    private String sanitizeFileName(String fileName) {
    String normalized = java.text.Normalizer.normalize(fileName, java.text.Normalizer.Form.NFD)
            .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
    normalized = normalized.replaceAll("[đĐ]", "d");
    normalized = normalized.replaceAll("[^a-zA-Z0-9._-]", "_");
    return normalized;
}

    @Transactional
    public void deleteDocumentPermanentAPI(UUID id, UUID userId) {
        Document doc = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xóa tài liệu này.");
        }
        if (doc.getStatus() != DocumentStatus.DELETED) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài liệu chưa được chuyển vào thùng rác.");
        }
        applicationContext.getBean(DocumentService.class).permanentlyDeleteDocument(doc);
    }

    @Transactional
    public void emptyTrash(UUID userId) {
        List<Document> trashDocs = documentRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, DocumentStatus.DELETED);
        DocumentService self = applicationContext.getBean(DocumentService.class);
        for (Document doc : trashDocs) {
            try {
                self.permanentlyDeleteDocument(doc);
            } catch (Exception e) {
                log.error("Failed to permanently delete document: " + doc.getId(), e);
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void permanentlyDeleteDocument(Document doc) {
        try {
            storageService.delete(doc.getFileUrl());
        } catch (Exception e) {
            log.warn("Storage delete failed, continuing... {}", e.getMessage());
        }
        documentRepository.deleteById(doc.getId());
        storageService.subtractUsed(doc.getUserId(), doc.getFileSizeBytes());
        tagRepository.deleteOrphanTags();
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void scheduledCleanup() {
        log.info("Starting scheduled cleanup of deleted documents...");
        LocalDateTime threshold = LocalDateTime.now().minusDays(30);
        int page = 0;
        int size = 100;
        int cleanedCount = 0;
        DocumentService self = applicationContext.getBean(DocumentService.class);

        while (true) {
            Page<Document> documents = documentRepository.findByStatusAndDeletedAtBefore(
                    DocumentStatus.DELETED, threshold, PageRequest.of(page, size));
            
            if (documents.isEmpty()) {
                break;
            }

            for (Document doc : documents.getContent()) {
                try {
                    self.permanentlyDeleteDocument(doc);
                    cleanedCount++;
                } catch (Exception e) {
                    log.error("Error cleaning up document: " + doc.getId(), e);
                }
            }
            page++;
        }
        log.info("Finished scheduled cleanup. Cleaned {} documents.", cleanedCount);
    }

    /**
     * Re-trigger embedding pipeline cho 1 document cụ thể.
     * Cho phép user gọi lại khi embedding_status = 'none' hoặc 'failed'.
     */
    public void triggerReingest(UUID documentId, UUID userId) {
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện hành động này.");
        }
        if (doc.getStatus() != DocumentStatus.READY) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tài liệu không ở trạng thái READY.");
        }
        scanProcessor.triggerIngest(documentId);
    }

    /**
     * Bulk re-trigger: tự động tìm tất cả document của user có embedding_status 'none' hoặc
     * 'failed' và re-ingest. Trả về số lượng document được lên lịch.
     */
    public int bulkReingestMyDocuments(UUID userId) {
        List<Document> docs = documentRepository
                .findByUserIdAndEmbeddingStatusInAndDeletedAtIsNull(userId, List.of("none", "failed"));
        int count = (int) docs.stream().filter(d -> d.getStatus() == DocumentStatus.READY).count();
        scanProcessor.bulkReingestForUser(userId);
        return count;
    }
}
