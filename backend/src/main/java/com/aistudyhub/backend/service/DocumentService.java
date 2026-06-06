package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final Path uploadDir;

    public DocumentService(DocumentRepository documentRepository,
                           @Value("${app.document.upload-dir:uploads/documents}") String uploadDirPath) {
        this.documentRepository = documentRepository;
        this.uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
    }

    @Transactional
    public Document upload(MultipartFile file, UUID userId) {
        if (file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "File không được để trống.");
        }

        Document document = new Document();
        document.setId(UUID.randomUUID());
        document.setUserId(userId);
        document.setOriginalName(file.getOriginalFilename());
        document.setTitle(file.getOriginalFilename());
        document.setFileSizeBytes(file.getSize());
        String originalName = file.getOriginalFilename();
        String ext = "";
        if (originalName != null && originalName.contains(".")) {
            ext = originalName.substring(originalName.lastIndexOf(".") + 1);
        }
        document.setFileType(ext);
        document.setSubject("");
        document.setStatus(DocumentStatus.UPLOADING);
        document.setRetryCount(0);
        LocalDateTime now = LocalDateTime.now();
        document.setCreatedAt(now);
        document.setUpdatedAt(now);
        document = documentRepository.save(document);

        if (document.getRetryCount() >= 3) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Vượt quá số lần thử tải lên cho phép.");
        }

        try {
            Files.createDirectories(uploadDir);
            String fileName = document.getId() + "_" + originalName;
            Path targetPath = uploadDir.resolve(fileName);
            file.transferTo(targetPath.toFile());

            document.setFileUrl(targetPath.toString());
            document.setStatus(DocumentStatus.UPLOADED);
            document.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(document);

            document.setStatus(DocumentStatus.PROCESSING);
            document.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(document);

            document.setStatus(DocumentStatus.COMPLETED);
            document.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(document);
        } catch (IOException e) {
            document.setRetryCount(document.getRetryCount() + 1);
            document.setStatus(DocumentStatus.FAILED);
            document.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(document);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Tải file thất bại: " + e.getMessage());
        }

        return document;
    }

    @Transactional(readOnly = true)
    public DocumentStatus getStatus(UUID id) {
        Document document = documentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        return document.getStatus();
    }
}
