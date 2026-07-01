package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.AddMessageRequest;
import com.aistudyhub.backend.dto.CreateSessionRequest;
import com.aistudyhub.backend.dto.MessageResponse;
import com.aistudyhub.backend.dto.SessionResponse;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping("/sessions")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUB_ADMIN', 'USER')")
    public ResponseEntity<List<SessionResponse>> getSessions(@AuthenticationPrincipal AuthUserPrincipal userDetails) {
        List<SessionResponse> sessions = chatService.getUserSessions(userDetails.getId());
        return ResponseEntity.ok(sessions);
    }

    @PostMapping("/sessions")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUB_ADMIN', 'USER')")
    public ResponseEntity<SessionResponse> createSession(@RequestBody CreateSessionRequest request,
                                                         @AuthenticationPrincipal AuthUserPrincipal userDetails) {
        SessionResponse session = chatService.createSession(userDetails.getId(), request.getDocumentId());
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    @GetMapping("/sessions/{sessionId}/messages")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUB_ADMIN', 'USER')")
    public ResponseEntity<List<MessageResponse>> getMessages(@PathVariable UUID sessionId,
                                                             @AuthenticationPrincipal AuthUserPrincipal userDetails) {
        List<MessageResponse> messages = chatService.getMessages(sessionId, userDetails.getId());
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/sessions/{sessionId}/messages")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUB_ADMIN', 'USER')")
    public ResponseEntity<MessageResponse> addMessage(@PathVariable UUID sessionId,
                                                      @Valid @RequestBody AddMessageRequest request,
                                                      @AuthenticationPrincipal AuthUserPrincipal userDetails) {
        MessageResponse message = chatService.addMessage(sessionId, userDetails.getId(), request.getRole(), request.getContent());
        return ResponseEntity.status(HttpStatus.CREATED).body(message);
    }

    @DeleteMapping("/sessions/{sessionId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUB_ADMIN', 'USER')")
    public ResponseEntity<Void> deleteSession(@PathVariable UUID sessionId,
                                              @AuthenticationPrincipal AuthUserPrincipal userDetails) {
        chatService.deleteSession(sessionId, userDetails.getId());
        return ResponseEntity.noContent().build();
    }
}
