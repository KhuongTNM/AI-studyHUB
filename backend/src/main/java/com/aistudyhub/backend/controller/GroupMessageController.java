package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.GroupMessageResponse;
import com.aistudyhub.backend.dto.request.ReportGroupRequest;
import com.aistudyhub.backend.dto.request.SendTextRequest;
import com.aistudyhub.backend.dto.request.ShareDocumentRequest;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.GroupMessageService;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupMessageController {

    private final GroupMessageService groupMessageService;

    @PostMapping("/{groupId}/messages")
    public ResponseEntity<GroupMessageResponse> sendTextMessage(
            @PathVariable UUID groupId,
            @Valid @RequestBody SendTextRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {

        UUID userId = principal.getId();
        GroupMessageResponse response = groupMessageService.sendTextMessage(groupId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/{groupId}/documents")
    public ResponseEntity<GroupMessageResponse> shareDocument(
            @PathVariable UUID groupId,
            @Valid @RequestBody ShareDocumentRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {

        UUID userId = principal.getId();
        GroupMessageResponse response = groupMessageService.shareDocument(groupId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // Document Download Logic
    @GetMapping("/{groupId}/documents/{docId}/download")
    public ResponseEntity<Resource> downloadDocument(
            @PathVariable UUID groupId,
            @PathVariable UUID docId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {

        UUID userId = principal.getId();
        Resource resource = groupMessageService.downloadDocument(groupId, docId, userId);

        String filename = resource.getFilename() != null ? resource.getFilename() : "document";

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(resource);
    }

    // Image Upload Logic
    @PostMapping("/{groupId}/images")
    public ResponseEntity<GroupMessageResponse> uploadImage(
            @PathVariable UUID groupId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal AuthUserPrincipal principal) {

        UUID userId = principal.getId();
        GroupMessageResponse response = groupMessageService.uploadImage(groupId, userId, file);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // Chat History Export Logic
    @GetMapping("/{groupId}/messages/export")
    public ResponseEntity<Resource> exportChatHistory(
            @PathVariable UUID groupId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {

        UUID userId = principal.getId();
        Resource resource = groupMessageService.exportChatHistory(groupId, userId);

        String filename = "lich-su-chat-" + groupId + "-"
                + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + ".txt";

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(resource);
    }

    // Group Report Logic
    @PostMapping("/{groupId}/report")
    public ResponseEntity<Void> reportGroup(
            @PathVariable UUID groupId,
            @Valid @RequestBody ReportGroupRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {

        UUID userId = principal.getId();
        groupMessageService.reportGroup(groupId, userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}