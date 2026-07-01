package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.SessionResponse;
import com.aistudyhub.backend.dto.MessageResponse;
import com.aistudyhub.backend.entity.ChatMessage;
import com.aistudyhub.backend.entity.ChatRole;
import com.aistudyhub.backend.entity.ChatSession;
import com.aistudyhub.backend.exception.BusinessException;
import com.aistudyhub.backend.exception.ErrorCode;
import com.aistudyhub.backend.repository.ChatMessageRepository;
import com.aistudyhub.backend.repository.ChatSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;

    @Transactional
    public SessionResponse createSession(UUID userId, UUID documentId) {
        ChatSession session = ChatSession.builder()
                .userId(userId)
                .documentId(documentId)
                .build();
        
        ChatSession savedSession = chatSessionRepository.save(session);
        return mapToSessionResponse(savedSession);
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> getUserSessions(UUID userId) {
        return chatSessionRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(this::mapToSessionResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getMessages(UUID sessionId, UUID userId) {
        ChatSession session = chatSessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_SESSION_NOT_FOUND));

        return chatMessageRepository.findByChatSessionIdOrderByCreatedAtAsc(session.getId())
                .stream()
                .map(this::mapToMessageResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public MessageResponse addMessage(UUID sessionId, UUID userId, ChatRole role, String content) {
        ChatSession session = chatSessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_SESSION_NOT_FOUND));

        ChatMessage message = ChatMessage.builder()
                .chatSession(session)
                .role(role)
                .content(content)
                .build();
        
        ChatMessage savedMessage = chatMessageRepository.save(message);
        return mapToMessageResponse(savedMessage);
    }

    @Transactional
    public void deleteSession(UUID sessionId, UUID userId) {
        ChatSession session = chatSessionRepository.findByIdAndUserId(sessionId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CHAT_SESSION_NOT_FOUND));
        
        chatSessionRepository.delete(session);
    }

    private SessionResponse mapToSessionResponse(ChatSession session) {
        return SessionResponse.builder()
                .id(session.getId())
                .documentId(session.getDocumentId())
                .createdAt(session.getCreatedAt())
                .build();
    }

    private MessageResponse mapToMessageResponse(ChatMessage message) {
        return MessageResponse.builder()
                .id(message.getId())
                .role(message.getRole())
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .build();
    }
}
