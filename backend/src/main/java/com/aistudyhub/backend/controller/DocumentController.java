package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.DocumentRequest;
import com.aistudyhub.backend.dto.DocumentResponse;
import com.aistudyhub.backend.dto.UpdateDocumentFolderRequest;
import com.aistudyhub.backend.dto.UpdateVisibilityRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.Visibility;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.exception.BusinessException;
import com.aistudyhub.backend.exception.ErrorCode;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.DocumentService;
import com.aistudyhub.backend.service.PdfPreviewService;
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
    private final PdfPreviewService pdfPreviewService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentResponse> upload(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam("subject") String subject,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "visibility", required = false, defaultValue = "private") String visibilityStr,
            @RequestParam(value = "tags", required = false) String tags,
            @RequestParam(value = "folderId", required = false) UUID folderId) {
        Visibility visibility;
        try {
            visibility = Visibility.valueOf(visibilityStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.INVALID_VISIBILITY);
        }
        Document doc = documentService.upload(principal.getId(), file, subject, title, visibility, tags, folderId);
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
    public ResponseEntity<?> preview(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        Document doc = documentService.getDocumentForPreview(id, principal.getId(), principal.getRole());

        // CONTRACT MỚI: KHÔNG redirect ra Supabase nữa — BE tự tải file (có cache)
        // rồi convert sang PDF nếu cần, để LUÔN trả về application/pdf cho FE,
        // bất kể file gốc là pdf/docx/pptx (mục 1, docx).
        Path sourceFile = documentService.getLocalFileForServing(doc);
        if (!Files.exists(sourceFile)) {
            return ResponseEntity.notFound().build();
        }

        Path pdfPath = pdfPreviewService.getPreviewPdfPath(doc, sourceFile, documentService.getUploadDir());

        try {
            InputStream is = Files.newInputStream(pdfPath);
            Resource resource = new InputStreamResource(is);
            String pdfFileName = stripExtension(doc.getOriginalName()) + ".pdf";
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION, buildContentDisposition("inline", pdfFileName))
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    private String stripExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    @PostMapping("/{id}/download")
    public ResponseEntity<Resource> download(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        Document doc = documentService.incrementDownloadCount(id, principal.getId());

        // CONTRACT MỚI: không redirect ra Supabase nữa — proxy để tự set đúng
        // Content-Disposition (filename* UTF-8, mục 2 docx). Redirect cũ khiến
        // FE nhận thẳng response gốc từ Supabase, bỏ qua header BE định trả.
        Path filePath = documentService.getLocalFileForServing(doc);
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
                            buildContentDisposition("attachment", doc.getOriginalName()))
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Build Content-Disposition đúng chuẩn RFC 6266 / RFC 5987: luôn kèm cả
     * filename (ASCII fallback, browser cũ) và filename* (UTF-8 percent-encoded,
     * giữ đúng tên có dấu tiếng Việt). Trước đây chỉ có filename="..." nên tên
     * tiếng Việt bị BE gửi thẳng byte UTF-8 không encode -> FE/browser đọc sai.
     */
    private String buildContentDisposition(String dispositionType, String originalFileName) {
        String asciiFallback = java.text.Normalizer.normalize(originalFileName, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .replaceAll("[đĐ]", "d")
                .replaceAll("[^\\x20-\\x7E]", "_")
                .replace("\"", "'");
        String encoded = java.net.URLEncoder.encode(originalFileName, java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
        return dispositionType + "; filename=\"" + asciiFallback + "\"; filename*=UTF-8''" + encoded;
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

    /**
     * Re-trigger embedding pipeline cho 1 tài liệu cụ thể.
     * Dùng khi embedding_status = 'none' hoặc 'failed' (tài liệu upload trước khi AI service hoạt động).
     */
    @PostMapping("/{id}/reingest")
    public ResponseEntity<Void> reingest(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id) {
        documentService.triggerReingest(id, principal.getId());
        return ResponseEntity.accepted().build();
    }

    /**
     * Bulk re-trigger: tự động tìm và re-ingest toàn bộ tài liệu của user hiện tại
     * có embedding_status = 'none' hoặc 'failed'.
     * Trả về {"queued": N} — số lượng tài liệu được đưa vào hàng đợi xử lý.
     */
    @PostMapping("/reingest-all")
    public ResponseEntity<java.util.Map<String, Integer>> reingestAll(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        int queued = documentService.bulkReingestMyDocuments(principal.getId());
        return ResponseEntity.accepted().body(java.util.Map.of("queued", queued));
    }
}