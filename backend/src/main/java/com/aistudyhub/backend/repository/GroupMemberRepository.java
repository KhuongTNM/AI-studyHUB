package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.GroupMember;
import com.aistudyhub.backend.entity.GroupMemberId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, GroupMemberId> {

    List<GroupMember> findById_UserId(UUID userId);

    List<GroupMember> findById_GroupIdOrderByJoinedAtAsc(UUID groupId);

    Optional<GroupMember> findById_GroupIdAndId_UserId(UUID groupId, UUID userId);

    boolean existsByIdGroupIdAndIdUserId(UUID groupId, UUID userId);

    void deleteByIdGroupIdAndIdUserId(UUID groupId, UUID userId);

    long countByIdGroupId(UUID groupId);

    long countByIdUserId(UUID userId);

    @Query("SELECT COUNT(gm) FROM GroupMember gm WHERE gm.id.groupId = :groupId")
    long countByGroupId(@Param("groupId") UUID groupId);

    @Modifying
    @Query("DELETE FROM GroupMember gm WHERE gm.id.groupId = :groupId AND gm.id.userId = :userId")
    void deleteByGroupIdAndUserId(@Param("groupId") UUID groupId, @Param("userId") UUID userId);
}
