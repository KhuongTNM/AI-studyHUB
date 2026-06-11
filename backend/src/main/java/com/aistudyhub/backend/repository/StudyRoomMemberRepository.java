package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.StudyRoomMember;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyRoomMemberRepository extends JpaRepository<StudyRoomMember, UUID> {
    List<StudyRoomMember> findByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(UUID roomId);
    List<StudyRoomMember> findByRoomIdAndLeftAtIsNull(UUID roomId);
    Optional<StudyRoomMember> findByRoomIdAndUserId(UUID roomId, UUID userId);
    boolean existsByRoomIdAndUserIdAndLeftAtIsNull(UUID roomId, UUID userId);
    int countByRoomIdAndLeftAtIsNull(UUID roomId);
}
