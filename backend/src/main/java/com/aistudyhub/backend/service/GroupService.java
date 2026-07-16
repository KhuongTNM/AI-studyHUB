package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.GroupMemberResponse;
import com.aistudyhub.backend.dto.GroupResponse;
import com.aistudyhub.backend.dto.GroupSettingsResponse;
import com.aistudyhub.backend.dto.request.*;
import com.aistudyhub.backend.entity.*;
import com.aistudyhub.backend.exception.BusinessException;
import com.aistudyhub.backend.exception.ErrorCode;
import com.aistudyhub.backend.exception.MaxGroupsLimitExceededException;
import com.aistudyhub.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final UserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final SubscriptionService subscriptionService;

    // ==========================================
    // 1. UTILITY & SECURITY GUARDS
    // ==========================================

    private void requireUserId(UUID userId) {
        if (userId == null) {
            throw new BusinessException(ErrorCode.UNAUTHENTICATED);
        }
    }

    private void requireMembership(UUID groupId, UUID userId) {
        if (!groupMemberRepository.existsByIdGroupIdAndIdUserId(groupId, userId)) {
            throw new BusinessException(ErrorCode.GROUP_ACCESS_DENIED);
        }
    }

    private GroupMember getMembership(UUID groupId, UUID userId) {
        return groupMemberRepository.findById(new GroupMemberId(groupId, userId))
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_ACCESS_DENIED));
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
        requireUserId(userId);

        // 1. Khóa bi quan user để tránh Race Condition khi tạo nhiều group cùng lúc
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        // 2. Lấy thông tin subscription active hiện tại (hoặc Virtual Free Fallback)
        Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(userId);
        SubscriptionPlan plan = subscriptionPlanRepository.findById(activeSub.getPlanId())
                .orElseThrow(() -> new com.aistudyhub.backend.exception.SystemConfigurationException("Cấu hình gói không hợp lệ."));

        // Nếu admin thì override limit
        boolean isAdmin = user.getRole() == User.Role.admin || user.getRole() == User.Role.sub_admin;

        int createLimit = plan.getCreateGroupLimit();

        if (!isAdmin) {
            if (createLimit == 0) {
                throw new MaxGroupsLimitExceededException("Gói của bạn không được phép tạo nhóm.");
            }

            // 3. Đếm số group hiện tại của user bằng countByOwnerId
            long currentGroups = groupRepository.countByOwnerId(userId);

            // 4. Kiểm tra giới hạn (nếu != -1)
            if (createLimit != -1 && currentGroups >= createLimit) {
                throw new MaxGroupsLimitExceededException("Bạn đã đạt giới hạn tạo nhóm của gói hiện tại.");
            }
        }

        String code = req.getGroupCode() != null && !req.getGroupCode().isBlank()
                ? req.getGroupCode().trim().toUpperCase()
                : "GRP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        if (groupRepository.existsByGroupCode(code)) {
            throw new BusinessException(ErrorCode.GROUP_CODE_ALREADY_EXISTS);
        }

        // 5. Tiến hành lưu group mới và kết thúc transaction.
        Group g = new Group();
        g.setGroupCode(code);
        g.setPasswordHash(req.getPassword().trim());
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
        requireUserId(userId);

        Group g = groupRepository.findByGroupCode(req.getGroupCode().trim().toUpperCase())
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        if (groupMemberRepository.existsByIdGroupIdAndIdUserId(g.getId(), userId)) {
            throw new BusinessException(ErrorCode.GROUP_ALREADY_JOINED);
        }
        
        if (!req.getPassword().trim().equals(g.getPasswordHash())) {
            throw new BusinessException(ErrorCode.GROUP_PASSWORD_INVALID);
        }

        User owner = userRepository.findById(g.getOwnerId()).orElseThrow();
        Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(owner.getId());
        SubscriptionPlan plan = subscriptionPlanRepository.findById(activeSub.getPlanId()).orElseThrow();

        // Kiểm tra limit số lượng thành viên của owner
        int maxMembers = plan.getMaxRoomMembers();
        if (maxMembers != -1 && groupMemberRepository.countByIdGroupId(g.getId()) >= maxMembers) {
            throw new BusinessException(ErrorCode.GROUP_FULL);
        }

        User user = userRepository.findById(userId).orElseThrow();
        Subscription userActiveSub = subscriptionService.getActiveSubscriptionOrDefault(user.getId());
        SubscriptionPlan userPlan = subscriptionPlanRepository.findById(userActiveSub.getPlanId()).orElseThrow();
        
        int joinLimit = userPlan.getJoinGroupLimit();
        if (joinLimit != -1 && groupMemberRepository.countGroupsJoinedByUser(userId) >= joinLimit) {
            throw new BusinessException(ErrorCode.GROUP_JOIN_LIMIT_REACHED);
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
        requireUserId(userId);

        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        if (!g.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.GROUP_OWNER_REQUIRED);
        }
        
        if (!req.getPassword().trim().equals(g.getPasswordHash())) {
            throw new BusinessException(ErrorCode.GROUP_PASSWORD_INVALID);
        }

        groupRepository.delete(g);
    }

    @Transactional(rollbackFor = Exception.class)
    public void leaveGroup(UUID groupId, UUID userId) {
        requireUserId(userId);

        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        if (g.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.GROUP_OWNER_CANNOT_LEAVE);
        }

        GroupMember member = getMembership(groupId, userId);
        groupMemberRepository.delete(member);

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
        requireUserId(userId);

        GroupMember member = getMembership(groupId, userId);
        return new GroupSettingsResponse(groupId, member.isMuted(), member.isPinned());
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupSettingsResponse updateMute(UUID userId, UUID groupId, MuteGroupRequest req) {
        requireUserId(userId);

        GroupMember member = getMembership(groupId, userId);
        member.setMuted(req.getMuted());
        groupMemberRepository.save(member);
        return new GroupSettingsResponse(groupId, member.isMuted(), member.isPinned());
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupSettingsResponse updatePin(UUID userId, UUID groupId, PinGroupRequest req) {
        requireUserId(userId);

        GroupMember member = getMembership(groupId, userId);
        member.setPinned(req.getPinned());
        groupMemberRepository.save(member);
        return new GroupSettingsResponse(groupId, member.isMuted(), member.isPinned());
    }

    // ==========================================
    // 4. TRUY VẤN DỮ LIỆU (GET)
    // ==========================================
    @Transactional(readOnly = true)
    public GroupResponse getGroupDetail(UUID groupId, UUID userId) {
        requireUserId(userId);

        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        requireMembership(groupId, userId);
        return buildResponse(group);
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> listMyGroups(UUID userId) {
        requireUserId(userId);

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
    public List<GroupMemberResponse> getMembers(UUID userId, UUID groupId) {
        requireUserId(userId);
        requireMembership(groupId, userId);

        List<GroupMember> members = groupMemberRepository.findByIdGroupIdOrderByJoinedAtAsc(groupId);
        if (members.isEmpty()) {
            return List.of();
        }

        List<UUID> userIds = members.stream()
                .map(member -> member.getId().getUserId())
                .toList();
        Map<UUID, User> usersById = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return members.stream().map(member -> {
            UUID memberUserId = member.getId().getUserId();
            User user = usersById.get(memberUserId);

            return GroupMemberResponse.builder()
                    .userId(memberUserId)
                    .displayName(user != null ? user.getDisplayName() : null)
                    .avatar(null)
                    .role(member.getRole())
                    .joinedAt(member.getJoinedAt())
                    .build();
        }).toList();
    }

    @Transactional(readOnly = true)
    public String getGroupPassword(UUID groupId, UUID userId) {
        requireUserId(userId);

        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        if (!g.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.GROUP_OWNER_REQUIRED);
        }

        return g.getPasswordHash();
    }

    // ==========================================
    // 5. KICK MEMBER (CHỦ NHÓM XÓA THÀNH VIÊN)
    // ==========================================

    @Transactional(rollbackFor = Exception.class)
    public void kickMember(UUID groupId, UUID targetUserId, UUID operatorId, KickMemberRequest req) {
        requireUserId(operatorId);

        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        if (!g.getOwnerId().equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_OWNER_REQUIRED);
        }

        if (!req.getGroupPassword().trim().equals(g.getPasswordHash())) {
            throw new BusinessException(ErrorCode.GROUP_PASSWORD_INVALID);
        }

        if (targetUserId.equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_CANNOT_KICK_SELF);
        }

        if (!groupMemberRepository.existsByIdGroupIdAndIdUserId(groupId, targetUserId)) {
            throw new BusinessException(ErrorCode.GROUP_MEMBER_NOT_FOUND);
        }

        groupMemberRepository.deleteByIdGroupIdAndIdUserId(groupId, targetUserId);
    }
}