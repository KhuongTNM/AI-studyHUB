package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.ChatMessage;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    /** GET /api/v1/chat/sessions/{sessionId}/messages — theo đúng thứ tự thời gian gửi */
    List<ChatMessage> findBySessionIdOrderByCreatedAtAsc(UUID sessionId);

    void deleteBySessionId(UUID sessionId);
}
