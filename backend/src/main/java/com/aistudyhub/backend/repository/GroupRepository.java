package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Group;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupRepository extends JpaRepository<Group, UUID> {

    boolean existsByGroupCode(String groupCode);

    Optional<Group> findByGroupCode(String groupCode);

    long countByOwnerId(UUID ownerId);
}
