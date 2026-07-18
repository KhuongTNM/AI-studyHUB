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

    // BR-090: chỉ đếm số nhóm đã tham gia CHÍNH THỨC (status = JOINED).
    // Không được tính các lời mời đang PENDING vào hạn mức gói cước.
    @Query("SELECT COUNT(m) FROM GroupMember m WHERE m.id.userId = :userId AND m.status = 'JOINED'")
    long countGroupsJoinedByUser(@Param("userId") UUID userId);

    List<GroupMember> findByIdUserId(UUID userId);
    List<GroupMember> findByIdGroupIdOrderByJoinedAtAsc(UUID groupId);

    // Dùng cho tính năng Mời thành viên qua Email: lấy các lời mời đang chờ (PENDING) của 1 User.
    List<GroupMember> findByIdUserIdAndStatus(UUID userId, String status);

    // Lấy danh sách thành viên chính thức (JOINED) của 1 nhóm - loại trừ các lời mời PENDING chưa được chấp nhận.
    List<GroupMember> findByIdGroupIdAndStatusOrderByJoinedAtAsc(UUID groupId, String status);
}