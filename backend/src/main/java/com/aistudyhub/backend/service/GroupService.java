package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.GroupMemberResponse;
import com.aistudyhub.backend.dto.GroupResponse;
import com.aistudyhub.backend.dto.GroupSettingsResponse;
import com.aistudyhub.backend.dto.request.*;
import com.aistudyhub.backend.entity.*;
import com.aistudyhub.backend.exception.BusinessException;
import com.aistudyhub.backend.exception.ErrorCode;
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

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Limits lim = limits(user);

        if (!lim.canCreate()) {
            throw new BusinessException(ErrorCode.GROUP_CREATE_NOT_ALLOWED);
        }
        if (groupRepository.countByOwnerId(userId) >= lim.maxCreated()) {
            throw new BusinessException(ErrorCode.GROUP_CREATE_LIMIT_REACHED);
        }
        if (groupMemberRepository.countGroupsJoinedByUser(userId) >= lim.maxJoined()) {
            throw new BusinessException(ErrorCode.GROUP_JOIN_LIMIT_REACHED);
        }

        String code = req.getGroupCode() != null && !req.getGroupCode().isBlank()
                ? req.getGroupCode().trim().toUpperCase()
                : "GRP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        if (groupRepository.existsByGroupCode(code)) {
            throw new BusinessException(ErrorCode.GROUP_CODE_ALREADY_EXISTS);
        }

        Group g = new Group();
        g.setGroupCode(code);
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
    public void deleteGroup(UUID groupId, UUID userId) {
        requireUserId(userId);

        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        if (!g.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.GROUP_OWNER_REQUIRED);
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

        // BR-015: Truy vấn display_name của User TRƯỚC khi xóa bản ghi thành viên, để đảm bảo
        // dữ liệu vẫn nhất quán tại thời điểm lấy tên. Nếu không tìm thấy User (dữ liệu bất nhất,
        // tài khoản đã bị xóa vật lý khỏi core.users) -> USER_NOT_FOUND, rollback toàn bộ,
        // không xóa thành viên.
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        groupMemberRepository.delete(member);

        GroupMessage sys = new GroupMessage();
        sys.setGroup(g);
        sys.setSenderId(null);
        sys.setContent(user.getDisplayName() + " đã rời nhóm.");
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

        List<GroupMember> memberships = groupMemberRepository.findByIdUserIdAndStatus(userId, "JOINED");
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

        List<GroupMember> members = groupMemberRepository.findByIdGroupIdAndStatusOrderByJoinedAtAsc(groupId, "JOINED");
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

    // ==========================================
    // 5. KICK MEMBER (CHỦ NHÓM XÓA THÀNH VIÊN)
    // ==========================================

    /**
     * Chủ nhóm xóa (kick) một thành viên ra khỏi nhóm.
     * Fail-fast: check đăng nhập -> group tồn tại -> quyền owner
     * -> không tự kick chính mình -> target có phải thành viên hay không -> xóa.
     */
    @Transactional(rollbackFor = Exception.class)
    public void kickMember(UUID groupId, UUID targetUserId, UUID operatorId) {
        requireUserId(operatorId);

        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        if (!g.getOwnerId().equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_OWNER_REQUIRED);
        }

        if (targetUserId.equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_CANNOT_KICK_SELF);
        }

        if (!groupMemberRepository.existsByIdGroupIdAndIdUserId(groupId, targetUserId)) {
            throw new BusinessException(ErrorCode.GROUP_MEMBER_NOT_FOUND);
        }

        // BR-016: Truy vấn display_name của cả người bị kick (target) và Chủ nhóm (operator) TRƯỚC
        // khi xóa bản ghi thành viên, đảm bảo dữ liệu nhất quán tại thời điểm lấy tên. Nếu không
        // tìm thấy 1 trong 2 -> USER_NOT_FOUND, rollback, không xóa thành viên.
        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        User operatorUser = userRepository.findById(operatorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        groupMemberRepository.deleteByIdGroupIdAndIdUserId(groupId, targetUserId);

        // Theo convention UX của các app chat phổ biến (Zalo/Messenger/Telegram): tin nhắn hệ
        // thống khi bị kick phải nêu rõ AI thực hiện hành động, để phân biệt với trường hợp tự rời
        // nhóm (leaveGroup) và tránh gây hiểu lầm/tranh chấp trách nhiệm.
        GroupMessage sys = new GroupMessage();
        sys.setGroup(g);
        sys.setSenderId(null);
        sys.setContent(targetUser.getDisplayName() + " đã bị " + operatorUser.getDisplayName() + " xóa khỏi nhóm.");
        sys.setMessageType("system");
        sys.setCreatedAt(LocalDateTime.now());
        groupMessageRepository.save(sys);
    }

    // ==========================================
    // 6. MỜI THÀNH VIÊN THAM GIA NHÓM QUA EMAIL
    // ==========================================

    /**
     * Tìm kiếm User theo Email trước khi gửi lời mời, để Chủ nhóm xác nhận đúng người.
     * Fail-fast: check đăng nhập -> check người gọi là thành viên nhóm -> tìm User theo email.
     */
    @Transactional(readOnly = true)
    public GroupMemberResponse searchUserForInvitation(UUID groupId, String email, UUID userId) {
        requireUserId(userId);
        requireMembership(groupId, userId);

        if (email == null || email.isBlank()) {
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }

        User targetUser = userRepository.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        return GroupMemberResponse.builder()
                .userId(targetUser.getId())
                .displayName(targetUser.getDisplayName())
                .avatar(null)
                .role(null)
                .joinedAt(null)
                .build();
    }

    /**
     * Chủ nhóm gửi lời mời tham gia nhóm cho 1 User thông qua Email.
     * Fail-fast: check đăng nhập -> group tồn tại -> quyền Chủ nhóm -> email hợp lệ -> tìm targetUser
     * -> chống tự mời chính mình -> chống mời trùng (đã là thành viên/đã được mời) -> tạo bản ghi PENDING.
     */
    @Transactional(rollbackFor = Exception.class)
    public void inviteMemberByEmail(UUID groupId, String email, UUID operatorId) {
        requireUserId(operatorId);

        Group g = groupRepository.findById(groupId)
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

        if (!g.getOwnerId().equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_OWNER_REQUIRED);
        }

        // Kiểm tra sức chứa tối đa của nhóm theo gói cước của Owner (bao gồm cả các lời mời PENDING
        // để tránh mời tràn lan vượt quá slot còn trống của nhóm).
        User owner = userRepository.findById(g.getOwnerId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        Limits ownerLim = limits(owner);
        if (groupMemberRepository.countByIdGroupId(groupId) >= ownerLim.maxCapacity()) {
            throw new BusinessException(ErrorCode.GROUP_FULL);
        }

        if (email == null || email.isBlank()) {
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }

        User targetUser = userRepository.findByEmailIgnoreCase(email.trim())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (targetUser.getId().equals(operatorId)) {
            throw new BusinessException(ErrorCode.GROUP_CANNOT_INVITE_SELF);
        }

        if (groupMemberRepository.existsByIdGroupIdAndIdUserId(groupId, targetUser.getId())) {
            throw new BusinessException(ErrorCode.GROUP_MEMBER_ALREADY_JOINED_OR_INVITED);
        }

        GroupMember invitation = new GroupMember();
        invitation.setId(new GroupMemberId(groupId, targetUser.getId()));
        invitation.setGroup(g);
        invitation.setRole("member");
        invitation.setStatus("PENDING");
        invitation.setJoinedAt(LocalDateTime.now());
        groupMemberRepository.save(invitation);
    }

    /**
     * Lấy danh sách các lời mời (PENDING) đang chờ chính User hiện tại phản hồi.
     */
    @Transactional(readOnly = true)
    public List<GroupResponse> getMyPendingInvitations(UUID userId) {
        requireUserId(userId);

        List<GroupMember> pendingInvitations = groupMemberRepository.findByIdUserIdAndStatus(userId, "PENDING");
        if (pendingInvitations.isEmpty()) {
            return List.of();
        }

        List<GroupResponse> responses = new ArrayList<>();
        for (GroupMember invitation : pendingInvitations) {
            UUID groupId = invitation.getId().getGroupId();
            Group group = groupRepository.findById(groupId).orElse(null);
            if (group != null) {
                responses.add(buildResponse(group));
            }
        }

        responses.sort(Comparator.comparing(GroupResponse::getUpdatedAt).reversed());
        return responses;
    }

    /**
     * User phản hồi lời mời tham gia nhóm: Chấp nhận (accept = true) hoặc Từ chối (accept = false).
     * Fail-fast: check đăng nhập -> lấy bản ghi lời mời -> kiểm tra đúng trạng thái PENDING
     * -> accept: đối chiếu giới hạn gói cước (BR-090) -> cập nhật JOINED; reject: xóa bản ghi khỏi DB.
     */
    @Transactional(rollbackFor = Exception.class)
    public void handleInvitation(UUID groupId, UUID userId, boolean accept) {
        requireUserId(userId);

        GroupMember invitation = groupMemberRepository.findById(new GroupMemberId(groupId, userId))
                .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_INVITATION_NOT_FOUND));

        if (!"PENDING".equals(invitation.getStatus())) {
            throw new BusinessException(ErrorCode.GROUP_INVITATION_NOT_PENDING);
        }

        if (accept) {
            // BR-090: Kiểm tra giới hạn số lượng nhóm tối đa (maxJoined) theo gói cước hiện tại
            // của chính User đang Accept - chỉ kích hoạt tại thời điểm Chấp nhận, không chặn lúc mời.
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
            Limits lim = limits(user);

            long joinedCount = groupMemberRepository.countGroupsJoinedByUser(userId);
            if (joinedCount >= lim.maxJoined()) {
                throw new BusinessException(ErrorCode.GROUP_JOIN_LIMIT_REACHED);
            }

            invitation.setStatus("JOINED");
            invitation.setJoinedAt(LocalDateTime.now());
            groupMemberRepository.save(invitation);

            // BR-090: Ngay sau khi chuyển trạng thái JOINED thành công (cùng transaction), tạo
            // tin nhắn hệ thống thông báo thành viên mới. Tái sử dụng đối tượng User đã truy vấn
            // ở bước kiểm tra hạn mức phía trên, không query lại core.users lần nữa.
            Group g = groupRepository.findById(groupId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.GROUP_NOT_FOUND));

            GroupMessage sys = new GroupMessage();
            sys.setGroup(g);
            sys.setSenderId(null);
            sys.setContent(user.getDisplayName() + " đã tham gia vào nhóm chat.");
            sys.setMessageType("system");
            sys.setCreatedAt(LocalDateTime.now());
            groupMessageRepository.save(sys);
        } else {
            groupMemberRepository.delete(invitation);
        }
    }
}