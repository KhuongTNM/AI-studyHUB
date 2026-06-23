package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.GroupMessage;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupMessageRepository extends JpaRepository<GroupMessage, UUID> {

    List<GroupMessage> findByGroupIdOrderByCreatedAtAsc(UUID groupId);

    Page<GroupMessage> findByGroupIdOrderByCreatedAtDesc(UUID groupId, Pageable pageable);
}
