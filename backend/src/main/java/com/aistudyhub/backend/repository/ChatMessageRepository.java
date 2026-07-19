package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.ChatMessage;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    /** GET /api/v1/chat/sessions/{sessionId}/messages — theo đúng thứ tự thời gian gửi */
    List<ChatMessage> findBySessionIdOrderByCreatedAtAsc(UUID sessionId);

    void deleteBySessionId(UUID sessionId);

    @org.springframework.data.jpa.repository.Query(
        "SELECT COUNT(m) FROM ChatMessage m, ChatSession s " +
        "WHERE m.sessionId = s.id AND s.userId = :userId AND m.role = :role AND m.createdAt >= :since"
    )
    long countUserMessagesSince(
        @org.springframework.data.repository.query.Param("userId") UUID userId, 
        @org.springframework.data.repository.query.Param("role") String role, 
        @org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since
    );
}
