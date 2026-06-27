package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.FolderCreateRequest;
import com.aistudyhub.backend.dto.FolderNodeResponse;
import com.aistudyhub.backend.dto.FolderUpdateRequest;
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

@RestController
@RequestMapping("/api/folders")
@RequiredArgsConstructor
public class FolderController {

    private final FolderService folderService;


    @PostMapping
    public ResponseEntity<FolderNodeResponse> createFolder(
            @Valid @RequestBody FolderCreateRequest request) {
        UUID userId = getCurrentUserId();
        FolderNodeResponse response = folderService.createFolder(userId, request);
        return ResponseEntity.status(201).body(response);
    }

    @GetMapping
    public ResponseEntity<List<FolderNodeResponse>> getFolderTree() {
        UUID userId = getCurrentUserId();
        return ResponseEntity.ok(folderService.getFolderTree(userId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<FolderNodeResponse> updateFolder(
            @PathVariable UUID id,
            @Valid @RequestBody FolderUpdateRequest request) {
        UUID userId = getCurrentUserId();
        return ResponseEntity.ok(folderService.updateFolder(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFolder(@PathVariable UUID id) {
        UUID userId = getCurrentUserId();
        folderService.deleteFolder(userId, id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/move")
    public ResponseEntity<Void> moveFolder(
            @PathVariable UUID id,
            @RequestParam(required = false) UUID targetParentId) {
        UUID userId = getCurrentUserId();
        folderService.moveFolder(userId, id, targetParentId);
        return ResponseEntity.ok().build();
    }

    private UUID getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof AuthUserPrincipal authPrincipal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ.");
        }
        return authPrincipal.getId();
    }
}
