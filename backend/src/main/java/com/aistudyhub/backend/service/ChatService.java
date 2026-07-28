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
    private final SubscriptionService subscriptionService;
    private final com.aistudyhub.backend.repository.UserRepository userRepository;

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

        if ("user".equals(request.getRole())) {
            checkDailyChatQuota(userId);
        }

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

    /**
     * CHAT-101 — Kiểm tra & chặn vượt hạn mức Chat AI/ngày. Dùng chung cho addMessage() (lưu
     * lịch sử) và VectorSearchController.search() (luồng thực sự sinh câu trả lời AI) — đây
     * chính là điểm chặn BẮT BUỘC phải nằm trước bước gọi AI service, không chỉ ở bước lưu
     * lịch sử như trước. Bỏ qua hoàn toàn nếu là Admin/Sub-Admin hoặc gói unlimited (-1).
     */
    @Transactional
    public void checkDailyChatQuota(UUID userId) {
        com.aistudyhub.backend.entity.User user = userRepository.findById(userId)
                .orElseThrow(() -> new com.aistudyhub.backend.exception.ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        boolean isAdmin = user.getRole() == com.aistudyhub.backend.entity.User.Role.admin || user.getRole() == com.aistudyhub.backend.entity.User.Role.sub_admin;
        if (isAdmin) {
            return;
        }

        // SUB-301: đọc hạn mức từ snapshot đã chốt tại thời điểm kích hoạt Subscription,
        // không tra cứu sống theo SubscriptionPlan nữa.
        com.aistudyhub.backend.entity.Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(userId);
        int chatLimit = activeSub.getDailyAiChatLimitSnapshot();
        if (chatLimit == -1) {
            return;
        }

        java.time.LocalDateTime startOfToday = java.time.LocalDate.now().atStartOfDay();
        long todayMessages = chatMessageRepository.countUserMessagesSince(userId, "user", startOfToday);
        if (todayMessages >= chatLimit) {
            throw new com.aistudyhub.backend.exception.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "Bạn đã dùng hết lượt Chat AI trong ngày (" + chatLimit + " lượt). Vui lòng nâng cấp gói dịch vụ.");
        }
    }

    /**
     * GET /api/v1/chat/quota — CHAT-102: tái sử dụng ĐÚNG nguồn dữ liệu (countUserMessagesSince)
     * với checkDailyChatQuota() để chỉ số hiển thị không bao giờ lệch pha với bước chặn thực tế.
     */
    @Transactional
    public com.aistudyhub.backend.dto.ChatQuotaResponse getChatQuota(UUID userId) {
        com.aistudyhub.backend.entity.User user = userRepository.findById(userId)
                .orElseThrow(() -> new com.aistudyhub.backend.exception.ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        boolean isAdmin = user.getRole() == com.aistudyhub.backend.entity.User.Role.admin || user.getRole() == com.aistudyhub.backend.entity.User.Role.sub_admin;

        java.time.LocalDateTime startOfToday = java.time.LocalDate.now().atStartOfDay();
        long used = chatMessageRepository.countUserMessagesSince(userId, "user", startOfToday);

        if (isAdmin) {
            return com.aistudyhub.backend.dto.ChatQuotaResponse.builder()
                    .limit(-1).used(used).remaining(null).unlimited(true).build();
        }

        // SUB-301: đọc hạn mức từ snapshot đã chốt tại thời điểm kích hoạt Subscription,
        // không tra cứu sống theo SubscriptionPlan nữa.
        com.aistudyhub.backend.entity.Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(userId);
        int limit = activeSub.getDailyAiChatLimitSnapshot();
        boolean unlimited = limit == -1;
        Long remaining = unlimited ? null : Math.max(0, limit - used);
        return com.aistudyhub.backend.dto.ChatQuotaResponse.builder()
                .limit(limit).used(used).remaining(remaining).unlimited(unlimited).build();
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
