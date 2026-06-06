package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.DocumentService;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        AuthUserPrincipal principal = (AuthUserPrincipal) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
        Document document = documentService.upload(file, principal.getId());
        return ResponseEntity.ok(Map.of(
                "id", document.getId(),
                "status", document.getStatus().name(),
                "originalName", document.getOriginalName(),
                "fileSizeBytes", document.getFileSizeBytes()
        ));
    }

    @GetMapping("/status/{id}")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable UUID id) {
        DocumentStatus status = documentService.getStatus(id);
        return ResponseEntity.ok(Map.of("id", id, "status", status.name()));
    }
}
