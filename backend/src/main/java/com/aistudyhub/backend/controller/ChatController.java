package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.ChatMessageResponse;
import com.aistudyhub.backend.dto.ChatQuotaResponse;
import com.aistudyhub.backend.dto.ChatSessionResponse;
import com.aistudyhub.backend.dto.CreateChatMessageRequest;
import com.aistudyhub.backend.dto.CreateChatSessionRequest;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.ChatService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    /** GET /api/v1/chat/sessions — lấy danh sách session của user hiện tại (theo token JWT) */
    @GetMapping("/sessions")
    public ResponseEntity<List<ChatSessionResponse>> listSessions(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        return ResponseEntity.ok(chatService.listSessions(principal.getId()));
    }

    /** GET /api/v1/chat/quota — CHAT-102: số lượt Chat AI còn lại trong ngày theo gói hiện tại */
    @GetMapping("/quota")
    public ResponseEntity<ChatQuotaResponse> getQuota(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        return ResponseEntity.ok(chatService.getChatQuota(principal.getId()));
    }

    /** GET /api/v1/chat/sessions/{sessionId}/messages — lấy toàn bộ tin nhắn của 1 session */
    @GetMapping("/sessions/{sessionId}/messages")
    public ResponseEntity<List<ChatMessageResponse>> listMessages(
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        return ResponseEntity.ok(chatService.listMessages(sessionId, principal.getId()));
    }

    /** POST /api/v1/chat/sessions — tạo session mới, body gồm documentId (nullable) */
    @PostMapping("/sessions")
    public ResponseEntity<ChatSessionResponse> createSession(
            @RequestBody CreateChatSessionRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        ChatSessionResponse response = chatService.createSession(principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /** POST /api/v1/chat/sessions/{sessionId}/messages — lưu 1 tin nhắn (role: user/assistant) */
    @PostMapping("/sessions/{sessionId}/messages")
    public ResponseEntity<ChatMessageResponse> addMessage(
            @PathVariable UUID sessionId,
            @Valid @RequestBody CreateChatMessageRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        ChatMessageResponse response = chatService.addMessage(sessionId, principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /** DELETE /api/v1/chat/sessions/{sessionId} — xoá 1 session + toàn bộ message liên quan */
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> deleteSession(
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        chatService.deleteSession(sessionId, principal.getId());
        return ResponseEntity.noContent().build();
    }
}
