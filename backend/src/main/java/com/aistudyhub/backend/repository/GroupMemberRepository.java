package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.GroupMember;
import com.aistudyhub.backend.entity.GroupMemberId;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, GroupMemberId> {

    boolean existsByIdGroupIdAndIdUserId(UUID groupId, UUID userId);
    void deleteByIdGroupIdAndIdUserId(UUID groupId, UUID userId);

    long countByIdGroupId(UUID groupId);

    @Query("SELECT COUNT(m) FROM GroupMember m WHERE m.id.userId = :userId")
    long countGroupsJoinedByUser(@Param("userId") UUID userId);

    List<GroupMember> findByIdUserId(UUID userId);
    List<GroupMember> findByIdGroupIdOrderByJoinedAtAsc(UUID groupId);
}