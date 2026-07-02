package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.ChatMessageResponse;
import com.aistudyhub.backend.dto.ChatSessionResponse;
import com.aistudyhub.backend.dto.CreateChatMessageRequest;
import com.aistudyhub.backend.dto.CreateChatSessionRequest;
import com.aistudyhub.backend.entity.ChatMessage;
import com.aistudyhub.backend.entity.ChatSession;
import com.aistudyhub.backend.exception.BusinessException;
import com.aistudyhub.backend.exception.ErrorCode;
import com.aistudyhub.backend.repository.ChatMessageRepository;
import com.aistudyhub.backend.repository.ChatSessionRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatService {

    private static final int TITLE_MAX_LENGTH = 60;

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;

    /** GET /api/v1/chat/sessions */
    @Transactional(readOnly = true)
    public List<ChatSessionResponse> listSessions(UUID userId) {
        return chatSessionRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toSessionResponse)
                .toList();
    }

    /** GET /api/v1/chat/sessions/{sessionId}/messages — kèm kiểm tra quyền sở hữu (A6) */
    @Transactional(readOnly = true)
    public List<ChatMessageResponse> listMessages(UUID sessionId, UUID userId) {
        ChatSession session = requireOwnedSession(sessionId, userId);
        return chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId()).stream()
                .map(this::toMessageResponse)
                .toList();
    }

    /** POST /api/v1/chat/sessions — A5: lưu kèm documentId để phục hồi lại khi mở lại session */
    @Transactional
    public ChatSessionResponse createSession(UUID userId, CreateChatSessionRequest request) {
        ChatSession session = new ChatSession();
        session.setUserId(userId);
        session.setDocumentId(request.getDocumentId());
        session.setTitle(
                request.getTitle() != null && !request.getTitle().isBlank()
                        ? request.getTitle()
                        : "Cuộc trò chuyện mới"
        );
        ChatSession saved = chatSessionRepository.save(session);
        return toSessionResponse(saved);
    }

    /** POST /api/v1/chat/sessions/{sessionId}/messages — kèm kiểm tra quyền sở hữu (A6) */
    @Transactional
    public ChatMessageResponse addMessage(UUID sessionId, UUID userId, CreateChatMessageRequest request) {
        ChatSession session = requireOwnedSession(sessionId, userId);

        ChatMessage message = new ChatMessage();
        message.setSessionId(session.getId());
        message.setRole(request.getRole());
        message.setContent(request.getContent());
        ChatMessage saved = chatMessageRepository.save(message);

        // Tự đặt tiêu đề session theo nội dung tin nhắn user đầu tiên (nếu còn để mặc định)
        if ("user".equals(request.getRole()) && "Cuộc trò chuyện mới".equals(session.getTitle())) {
            session.setTitle(truncateTitle(request.getContent()));
        }
        session.setUpdatedAt(LocalDateTime.now());
        chatSessionRepository.save(session);

        return toMessageResponse(saved);
    }

    /** DELETE /api/v1/chat/sessions/{sessionId} — xoá session + toàn bộ message liên quan */
    @Transactional
    public void deleteSession(UUID sessionId, UUID userId) {
        ChatSession session = requireOwnedSession(sessionId, userId);
        chatMessageRepository.deleteBySessionId(session.getId());
        chatSessionRepository.delete(session);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /** A6: chỉ cho phép user truy cập session của chính mình — 404 để không lộ sự tồn tại của session người khác */
    private ChatSession requireOwnedSession(UUID sessionId, UUID userId) {
        ChatSession session = chatSessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_SESSION_NOT_FOUND));
        if (!session.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.CHAT_SESSION_NOT_FOUND);
        }
        return session;
    }

    private String truncateTitle(String content) {
        String trimmed = content.trim();
        if (trimmed.length() <= TITLE_MAX_LENGTH) return trimmed;
        return trimmed.substring(0, TITLE_MAX_LENGTH) + "...";
    }

    private ChatSessionResponse toSessionResponse(ChatSession session) {
        return ChatSessionResponse.builder()
                .id(session.getId())
                .userId(session.getUserId())
                .title(session.getTitle())
                .documentId(session.getDocumentId())
                .createdAt(session.getCreatedAt())
                .build();
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .sessionId(message.getSessionId())
                .role(message.getRole())
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .build();
    }
}
