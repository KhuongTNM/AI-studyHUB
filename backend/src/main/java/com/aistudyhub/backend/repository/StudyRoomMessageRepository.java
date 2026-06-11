package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.StudyRoomMessage;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyRoomMessageRepository extends JpaRepository<StudyRoomMessage, UUID> {
    List<StudyRoomMessage> findByRoomIdOrderByCreatedAtAsc(UUID roomId);
}
