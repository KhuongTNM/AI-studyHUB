package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.StudyRoom;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyRoomRepository extends JpaRepository<StudyRoom, UUID> {
    Optional<StudyRoom> findByCode(String code);
    boolean existsByCode(String code);
    List<StudyRoom> findByIsActiveTrueOrderByCreatedAtDesc();
}
