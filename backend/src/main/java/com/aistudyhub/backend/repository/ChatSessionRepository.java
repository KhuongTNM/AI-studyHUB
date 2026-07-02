package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.ChatSession;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatSessionRepository extends JpaRepository<ChatSession, UUID> {

    /** GET /api/v1/chat/sessions — lịch sử chat của user, mới nhất trước */
    List<ChatSession> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
