package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.DocumentRequest;
import com.aistudyhub.backend.dto.DocumentResponse;
import com.aistudyhub.backend.dto.UpdateDocumentFolderRequest;
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
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
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
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;

    @PostMapping("/upload")
    public ResponseEntity<DocumentResponse> upload(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(value = "folderId", required = false) UUID folderId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("subject") String subject,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "visibility", required = false, defaultValue = "private") String visibilityStr,
            @RequestParam(value = "tags", required = false) String tags) {
        Visibility visibility;
        try {
            visibility = Visibility.valueOf(visibilityStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Visibility chỉ hỗ trợ private hoặc public.");
        }
        Document doc = documentService.upload(principal.getId(), folderId, file, subject, title, visibility, tags);
        return ResponseEntity.status(201).body(DocumentResponse.from(doc));
    }

    @GetMapping
    public ResponseEntity<List<DocumentResponse>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String subject) {
        List<Document> docs = documentService.searchDocuments(principal.getId(), keyword, subject, tag);
        return ResponseEntity.ok(docs.stream().map(DocumentResponse::from).toList());
    }

    @GetMapping("/public")
    public ResponseEntity<List<DocumentResponse>> listPublic() {
        List<Document> docs = documentService.getPublicDocuments();
        return ResponseEntity.ok(docs.stream().map(DocumentResponse::from).toList());
    }

    @GetMapping("/trash")
    public ResponseEntity<List<DocumentResponse>> listTrash(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        List<Document> docs = documentService.getTrashDocuments(principal.getId());
        return ResponseEntity.ok(docs.stream().map(DocumentResponse::from).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> getById(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        return ResponseEntity.ok(DocumentResponse.from(documentService.getDocumentIfAccessible(id, principal.getId())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        documentService.delete(id, principal.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> deletePermanent(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        documentService.deleteDocumentPermanentAPI(id, principal.getId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/trash/empty")
    public ResponseEntity<Void> emptyTrash(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        documentService.emptyTrash(principal.getId());
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

    @PostMapping("/{id}/restore")
    public ResponseEntity<DocumentResponse> restore(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        Document doc = documentService.restoreDocument(id, principal.getId());
        return ResponseEntity.ok(DocumentResponse.from(doc));
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody> preview(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        Document doc = documentService.getDocumentForPreview(id, principal.getId(), principal.getRole());
        String cachePdfPath = documentService.getOrCreatePreviewCachePath(doc);

        String fileName = doc.getOriginalName();
        if (!fileName.toLowerCase().endsWith(".pdf")) {
            fileName += ".pdf";
        }
        String asciiName = java.text.Normalizer.normalize(fileName, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "").replaceAll("Đ", "D").replaceAll("đ", "d");
        String encodedFileName = java.net.URLEncoder.encode(fileName, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
        String contentDisposition = "inline; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encodedFileName;

        if (cachePdfPath == null) {
            org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(10000);
            factory.setReadTimeout(10000);
            org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate(factory);
            
            org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody responseBody = outputStream -> {
                restTemplate.execute(java.net.URI.create(doc.getFileUrl()), org.springframework.http.HttpMethod.GET, null, response -> {
                    if (!response.getStatusCode().is2xxSuccessful()) {
                        throw new ApiException(HttpStatus.NOT_FOUND, "Không thể tải file từ cloud.");
                    }
                    try (java.io.InputStream inputStream = response.getBody()) {
                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = inputStream.read(buffer)) != -1) {
                            outputStream.write(buffer, 0, bytesRead);
                        }
                        outputStream.flush();
                    }
                    return null;
                });
            };
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(responseBody);
        } else {
            java.io.File pdfFile = new java.io.File(cachePdfPath);
            if (!pdfFile.exists()) {
                throw new ApiException(HttpStatus.NOT_FOUND, "File xem trước không tồn tại.");
            }
            org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody responseBody = outputStream -> {
                try (java.io.InputStream inputStream = new java.io.FileInputStream(pdfFile)) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }
                    outputStream.flush();
                }
            };
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(responseBody);
        }
    }

    @PostMapping("/{id}/download")
    public ResponseEntity<org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody> download(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        Document doc = documentService.getDocumentIfAccessible(id, principal.getId());
        
        String asciiName = java.text.Normalizer.normalize(doc.getOriginalName(), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "").replaceAll("Đ", "D").replaceAll("đ", "d");
        String encodedName = java.net.URLEncoder.encode(doc.getOriginalName(), java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
        String contentDisposition = "attachment; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encodedName;

        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(10000);
        org.springframework.web.client.RestTemplate restTemplate = new org.springframework.web.client.RestTemplate(factory);

        org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody responseBody = outputStream -> {
            restTemplate.execute(java.net.URI.create(doc.getFileUrl()), org.springframework.http.HttpMethod.GET, null, response -> {
                if (!response.getStatusCode().is2xxSuccessful()) {
                    throw new ApiException(HttpStatus.NOT_FOUND, "Không thể tải file từ hệ thống lưu trữ.");
                }
                try (java.io.InputStream inputStream = response.getBody()) {
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }
                    outputStream.flush();
                    documentService.incrementDownloadCount(id, principal.getId());
                }
                return null;
            });
        };

        String mimeType = java.net.URLConnection.guessContentTypeFromName(doc.getOriginalName());
        if (mimeType == null) mimeType = "application/octet-stream";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition)
                .contentType(MediaType.parseMediaType(mimeType))
                .body(responseBody);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DocumentResponse> updateDocument(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id,
            @RequestBody DocumentRequest request) {
        Document doc = documentService.updateDocument(id, principal.getId(), request);
        return ResponseEntity.ok(DocumentResponse.from(doc));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<DocumentResponse> updateFolder(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id,
            @RequestBody UpdateDocumentFolderRequest request) {
        Document doc = documentService.updateFolderId(id, principal.getId(), request.getFolderId());
        return ResponseEntity.ok(DocumentResponse.from(doc));
    }
}