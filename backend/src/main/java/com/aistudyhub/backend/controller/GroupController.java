package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.CreateGroupRequest;
import com.aistudyhub.backend.dto.DeleteGroupRequest;
import com.aistudyhub.backend.dto.GroupMemberResponse;
import com.aistudyhub.backend.dto.GroupMessageResponse;
import com.aistudyhub.backend.dto.GroupResponse;
import com.aistudyhub.backend.dto.GroupSettingsResponse;
import com.aistudyhub.backend.dto.JoinGroupRequest;
import com.aistudyhub.backend.dto.ReportGroupRequest;
import com.aistudyhub.backend.dto.SendGroupMessageRequest;
import com.aistudyhub.backend.dto.ShareGroupDocumentRequest;
import com.aistudyhub.backend.dto.UpdateGroupMuteRequest;
import com.aistudyhub.backend.dto.UpdateGroupPinRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.DocumentService;
import com.aistudyhub.backend.service.GroupService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final DocumentService documentService;

    @GetMapping
    public ResponseEntity<List<GroupResponse>> listMyGroups(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        return ResponseEntity.ok(groupService.listMyGroups(requireUserId(principal)));
    }

    @GetMapping("/{groupId}")
    public ResponseEntity<GroupResponse> getGroupDetail(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId) {
        return ResponseEntity.ok(groupService.getGroupDetail(requireUserId(principal), groupId));
    }

    @PostMapping
    public ResponseEntity<GroupResponse> createGroup(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateGroupRequest request) {
        GroupResponse response = groupService.createGroup(request, requireUserId(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/join")
    public ResponseEntity<GroupResponse> joinGroup(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody JoinGroupRequest request) {
        return ResponseEntity.ok(groupService.joinGroup(request, requireUserId(principal)));
    }

    @PostMapping("/{groupId}/messages")
    public ResponseEntity<GroupMessageResponse> sendMessage(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId,
            @Valid @RequestBody SendGroupMessageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(groupService.sendMessage(requireUserId(principal), groupId, request));
    }

    @PostMapping("/{groupId}/documents")
    public ResponseEntity<GroupMessageResponse> shareDocument(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId,
            @Valid @RequestBody ShareGroupDocumentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(groupService.shareDocument(requireUserId(principal), groupId, request));
    }

    @PostMapping("/{groupId}/images")
    public ResponseEntity<GroupMessageResponse> uploadImage(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId,
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(groupService.uploadImage(requireUserId(principal), groupId, file));
    }

    @GetMapping("/{groupId}/documents/{documentId}/download")
    public ResponseEntity<Resource> downloadSharedDocument(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId,
            @PathVariable UUID documentId) {
        groupService.getSharedDocumentForDownload(requireUserId(principal), groupId, documentId);
        Document downloaded = documentService.incrementDownloadCount(documentId, requireUserId(principal));
        Path filePath = documentService.getFilePath(downloaded);
        if (!Files.exists(filePath)) {
            return ResponseEntity.notFound().build();
        }
        try {
            InputStream inputStream = Files.newInputStream(filePath);
            String mimeType = URLConnection.guessContentTypeFromName(downloaded.getOriginalName());
            if (mimeType == null) {
                mimeType = "application/octet-stream";
            }
            Resource resource = new InputStreamResource(inputStream);
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(mimeType))
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + downloaded.getOriginalName() + "\"")
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{groupId}/members")
    public ResponseEntity<List<GroupMemberResponse>> getMembers(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId) {
        return ResponseEntity.ok(groupService.getMembers(requireUserId(principal), groupId));
    }

    @GetMapping("/{groupId}/settings")
    public ResponseEntity<GroupSettingsResponse> getSettings(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId) {
        return ResponseEntity.ok(groupService.getSettings(requireUserId(principal), groupId));
    }

    @PatchMapping("/{groupId}/settings/mute")
    public ResponseEntity<GroupSettingsResponse> updateMute(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId,
            @RequestBody UpdateGroupMuteRequest request) {
        return ResponseEntity.ok(groupService.updateMute(
                requireUserId(principal), groupId, request.isMuted()));
    }

    @PatchMapping("/{groupId}/settings/pin")
    public ResponseEntity<GroupSettingsResponse> updatePin(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId,
            @RequestBody UpdateGroupPinRequest request) {
        return ResponseEntity.ok(groupService.updatePin(
                requireUserId(principal), groupId, request.isPinned()));
    }

    @GetMapping("/{groupId}/messages/export")
    public ResponseEntity<byte[]> exportChat(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId) {
        byte[] content = groupService.exportChat(requireUserId(principal), groupId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"group-" + groupId + "-chat-export.txt\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(content);
    }

    @PostMapping("/{groupId}/report")
    public ResponseEntity<Void> reportGroup(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId,
            @Valid @RequestBody ReportGroupRequest request) {
        groupService.reportGroup(requireUserId(principal), groupId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}/members/me")
    public ResponseEntity<Void> leaveGroup(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId) {
        groupService.leaveGroup(requireUserId(principal), groupId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{groupId}")
    public ResponseEntity<Void> deleteGroup(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID groupId,
            @Valid @RequestBody DeleteGroupRequest request) {
        groupService.deleteGroup(groupId, request, requireUserId(principal));
        return ResponseEntity.noContent().build();
    }

    private UUID requireUserId(AuthUserPrincipal principal) {
        if (principal == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ.");
        }
        return principal.getId();
    }
}
