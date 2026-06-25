package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.GroupMemberResponse;
import com.aistudyhub.backend.dto.GroupResponse;
import com.aistudyhub.backend.dto.GroupSettingsResponse;
import com.aistudyhub.backend.dto.request.*;
import com.aistudyhub.backend.entity.*;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final UserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final PasswordEncoder passwordEncoder;

    // ==========================================
    // 1. UTILITY & SECURITY GUARDS
    // ==========================================

    private record Limits(boolean canCreate, int maxCreated, int maxJoined, int maxCapacity) {}

    private Limits limits(User u) {
        String role = u.getRole().toString();
        boolean admin = role.equalsIgnoreCase("admin") || role.equalsIgnoreCase("sub_admin");

        String plan = resolveActivePlanName(u);

        if (admin || "vip_5_plus".equals(plan) || "plan_5_plus".equals(plan)) {
            return new Limits(true, 50, 60, 99);
        }
        if ("pro_2_4".equals(plan) || "plan_2_4".equals(plan)) {
            return new Limits(true, 20, 30, 4);
        }
        return new Limits(false, 0, 5, 0);
    }

    private String resolveActivePlanName(User user) {
        if (user.getSubscriptionPlanId() == null || user.getSubscriptionExpiresAt() == null) {
            return SubscriptionPlan.FREE_PLAN_NAME;
        }
        if (user.getSubscriptionExpiresAt().isBefore(LocalDateTime.now())) {
            return SubscriptionPlan.FREE_PLAN_NAME;
        }
        return subscriptionPlanRepository.findById(user.getSubscriptionPlanId())
                .map(SubscriptionPlan::getName)
                .orElse(SubscriptionPlan.FREE_PLAN_NAME);
    }

    private void requireMembership(UUID groupId, UUID userId) {
        if (!groupMemberRepository.existsByIdGroupIdAndIdUserId(groupId, userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_ACCESS_DENIED");
        }
    }

    private GroupMember getMembership(UUID groupId, UUID userId) {
        return groupMemberRepository.findById(new GroupMemberId(groupId, userId))
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "GROUP_ACCESS_DENIED"));
    }

    private GroupResponse buildResponse(Group g) {
        return GroupResponse.builder()
                .id(g.getId())
                .groupCode(g.getGroupCode())
                .name(g.getName())
                .description(g.getDescription())
                .ownerId(g.getOwnerId())
                .createdAt(g.getCreatedAt())
                .updatedAt(g.getUpdatedAt())
                .build();
    }

    // ==========================================
    // 2. CORE LOGIC: CREATE, JOIN, DELETE, LEAVE
    // ==========================================

    @Transactional(rollbackFor = Exception.class)
    public GroupResponse createGroup(CreateGroupRequest req, UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND"));
        Limits lim = limits(user);

        if (!lim.canCreate()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_CREATE_NOT_ALLOWED");
        }
        if (groupRepository.countByOwnerId(userId) >= lim.maxCreated()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_CREATE_LIMIT_REACHED");
        }
        if (groupMemberRepository.countByIdUserId(userId) >= lim.maxJoined()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_JOIN_LIMIT_REACHED");
        }

        String code = req.getGroupCode() != null && !req.getGroupCode().isBlank()
                ? req.getGroupCode().trim().toUpperCase()
                : "GRP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        if (groupRepository.existsByGroupCode(code)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_CODE_ALREADY_EXISTS");
        }

        Group g = new Group();
        g.setGroupCode(code);
        g.setPasswordHash(passwordEncoder.encode(req.getPassword().trim()));
        g.setName(req.getName().trim());
        g.setDescription(req.getDescription());
        g.setOwnerId(userId);
        g.setCreatedAt(LocalDateTime.now());
        g.setUpdatedAt(LocalDateTime.now());
        groupRepository.save(g);

        GroupMember ownerMember = new GroupMember();
        ownerMember.setId(new GroupMemberId(g.getId(), userId));
        ownerMember.setGroup(g);
        ownerMember.setRole("owner");
        ownerMember.setJoinedAt(LocalDateTime.now());
        groupMemberRepository.save(ownerMember);

        return buildResponse(g);
    }

    @Transactional(rollbackFor = Exception.class)
    public void joinGroup(JoinGroupRequest req, UUID userId) {
        Group g = groupRepository.findByGroupCode(req.getGroupCode().trim().toUpperCase())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GROUP_NOT_FOUND"));

        if (groupMemberRepository.existsByIdGroupIdAndIdUserId(g.getId(), userId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_ALREADY_JOINED");
        }
        if (!passwordEncoder.matches(req.getPassword().trim(), g.getPasswordHash())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_PASSWORD_INVALID");
        }

        User owner = userRepository.findById(g.getOwnerId()).orElseThrow();
        Limits ownerLim = limits(owner);
        // Lưu ý: bảng Group không có maxCapacity, phải tính qua hàm limits của owner
        if (groupMemberRepository.countByIdGroupId(g.getId()) >= ownerLim.maxCapacity()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_FULL");
        }

        Limits userLim = limits(userRepository.findById(userId).orElseThrow());
        if (groupMemberRepository.countByIdUserId(userId) >= userLim.maxJoined()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_JOIN_LIMIT_REACHED");
        }

        GroupMember m = new GroupMember();
        m.setId(new GroupMemberId(g.getId(), userId));
        m.setGroup(g);
        m.setRole("member");
        m.setJoinedAt(LocalDateTime.now());
        groupMemberRepository.save(m);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteGroup(UUID groupId, DeleteGroupRequest req, UUID userId) {
        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GROUP_NOT_FOUND"));

        if (!g.getOwnerId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_OWNER_REQUIRED");
        }
        if (!passwordEncoder.matches(req.getPassword().trim(), g.getPasswordHash())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_PASSWORD_INVALID");
        }

        groupRepository.delete(g);
    }

    @Transactional(rollbackFor = Exception.class)
    public void leaveGroup(UUID groupId, UUID userId) {
        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GROUP_NOT_FOUND"));

        if (g.getOwnerId().equals(userId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_OWNER_CANNOT_LEAVE");
        }

        GroupMember member = getMembership(groupId, userId);
        groupMemberRepository.delete(member);

        // Map nguyên object Group g vào tin nhắn thay vì UUID
        GroupMessage sys = new GroupMessage();
        sys.setGroup(g);
        sys.setSenderId(null);
        sys.setContent(userId + " đã rời nhóm.");
        sys.setMessageType("system");
        sys.setCreatedAt(LocalDateTime.now());
        groupMessageRepository.save(sys);
    }

    // ==========================================
    // 3. SETTINGS: MUTE & PIN
    // ==========================================

    @Transactional(readOnly = true)
    public GroupSettingsResponse getSettings(UUID userId, UUID groupId) {
        GroupMember member = getMembership(groupId, userId);
        return new GroupSettingsResponse(groupId, member.isMuted(), member.isPinned());
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupSettingsResponse updateMute(UUID userId, UUID groupId, MuteGroupRequest req) {
        GroupMember member = getMembership(groupId, userId);
        member.setMuted(req.getMuted());
        groupMemberRepository.save(member);
        return new GroupSettingsResponse(groupId, member.isMuted(), member.isPinned());
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupSettingsResponse updatePin(UUID userId, UUID groupId, PinGroupRequest req) {
        GroupMember member = getMembership(groupId, userId);
        member.setPinned(req.getPinned());
        groupMemberRepository.save(member);
        return new GroupSettingsResponse(groupId, member.isMuted(), member.isPinned());
    }

    // ==========================================
    // 4. TRUY VẤN DỮ LIỆU (GET)
    // ==========================================

    @Transactional(readOnly = true)
    public List<GroupResponse> listMyGroups(UUID userId) {
        List<GroupMember> memberships = groupMemberRepository.findByIdUserId(userId);
        if (memberships.isEmpty()) {
            return List.of();
        }

        List<GroupResponse> responses = new ArrayList<>();
        for (GroupMember membership : memberships) {
            UUID groupId = membership.getId().getGroupId();
            Group group = groupRepository.findById(groupId).orElse(null);
            if (group != null) {
                responses.add(buildResponse(group));
            }
        }

        responses.sort(Comparator.comparing(GroupResponse::getUpdatedAt).reversed());
        return responses;
    }

    @Transactional(readOnly = true)
    public GroupResponse getGroupDetail(UUID userId, UUID groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GROUP_NOT_FOUND"));

        requireMembership(groupId, userId);
        return buildResponse(group);
    }

    @Transactional(readOnly = true)
    public List<GroupMemberResponse> getMembers(UUID userId, UUID groupId) {
        requireMembership(groupId, userId);

        List<GroupMember> members = groupMemberRepository.findByIdGroupIdOrderByJoinedAtAsc(groupId);
        if (members.isEmpty()) {
            return List.of();
        }

        return members.stream().map(member -> {
            GroupMemberResponse res = new GroupMemberResponse();
            // Lát tự map các trường của Member vào DTO res tại đây
            return res;
        }).toList();
    }
}