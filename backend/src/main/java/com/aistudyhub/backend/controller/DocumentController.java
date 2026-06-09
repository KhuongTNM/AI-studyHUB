package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.DocumentResponse;
import com.aistudyhub.backend.dto.UpdateVisibilityRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.Visibility;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.DocumentService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping("/upload")
    public ResponseEntity<DocumentResponse> upload(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam("subject") String subject,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "visibility", required = false, defaultValue = "private") String visibilityStr) {
        Visibility visibility;
        try {
            visibility = Visibility.valueOf(visibilityStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Visibility chỉ hỗ trợ private hoặc public.");
        }
        Document doc = documentService.upload(principal.getId(), file, subject, title, visibility);
        return ResponseEntity.status(201).body(DocumentResponse.from(doc));
    }

    @GetMapping
    public ResponseEntity<List<DocumentResponse>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        List<Document> docs = documentService.getUserDocuments(principal.getId());
        return ResponseEntity.ok(docs.stream().map(DocumentResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(DocumentResponse.from(documentService.getById(id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        documentService.delete(id, principal.getId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/visibility")
    public ResponseEntity<DocumentResponse> updateVisibility(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateVisibilityRequest request) {
        Visibility visibility;
        try {
            visibility = Visibility.valueOf(request.getVisibility().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Visibility chỉ hỗ trợ private hoặc public.");
        }
        Document doc = documentService.updateVisibility(id, principal.getId(), visibility);
        return ResponseEntity.ok(DocumentResponse.from(doc));
    }

    @PostMapping("/{id}/download")
    public ResponseEntity<Resource> download(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        Document doc = documentService.incrementDownloadCount(id);
        Path filePath = documentService.getFilePath(doc);
        if (!Files.exists(filePath)) {
            return ResponseEntity.notFound().build();
        }
        try {
            InputStream is = Files.newInputStream(filePath);
            String mimeType = URLConnection.guessContentTypeFromName(doc.getOriginalName());
            if (mimeType == null) mimeType = "application/octet-stream";
            Resource resource = new InputStreamResource(is);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(mimeType))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + doc.getOriginalName() + "\"")
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
