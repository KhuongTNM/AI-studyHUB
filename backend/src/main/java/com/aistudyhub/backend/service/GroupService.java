package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateGroupRequest;
import com.aistudyhub.backend.dto.DeleteGroupRequest;
import com.aistudyhub.backend.dto.GroupMemberResponse;
import com.aistudyhub.backend.dto.GroupMessageResponse;
import com.aistudyhub.backend.dto.GroupResponse;
import com.aistudyhub.backend.dto.GroupSettingsResponse;
import com.aistudyhub.backend.dto.JoinGroupRequest;
import com.aistudyhub.backend.dto.ReportGroupRequest;
import com.aistudyhub.backend.dto.SendGroupMessageRequest;
import com.aistudyhub.backend.dto.ShareGroupDocumentRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.entity.Group;
import com.aistudyhub.backend.entity.GroupMember;
import com.aistudyhub.backend.entity.GroupMemberId;
import com.aistudyhub.backend.entity.GroupMemberRole;
import com.aistudyhub.backend.entity.GroupMessage;
import com.aistudyhub.backend.entity.GroupMessageType;
import com.aistudyhub.backend.entity.GroupReport;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.entity.Visibility;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.GroupMemberRepository;
import com.aistudyhub.backend.repository.GroupMessageRepository;
import com.aistudyhub.backend.repository.GroupReportRepository;
import com.aistudyhub.backend.repository.GroupRepository;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class GroupService {

    private static final int RECENT_MESSAGE_LIMIT = 50;
    private static final List<String> ALLOWED_IMAGE_EXTENSIONS = List.of("png", "jpg", "jpeg", "gif", "webp");

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final GroupReportRepository groupReportRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDirPath;

    private Path uploadDir;

    @PostConstruct
    private void init() {
        uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(uploadDir.resolve("group-images"));
        } catch (IOException e) {
            throw new RuntimeException("Could not create group image upload directory", e);
        }
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> listMyGroups(UUID userId) {
        requireUser(userId);
        List<GroupMember> memberships = groupMemberRepository.findById_UserId(userId);
        if (memberships.isEmpty()) {
            return List.of();
        }

        List<GroupResponse> responses = new ArrayList<>();
        for (GroupMember membership : memberships) {
            UUID groupId = membership.getId().getGroupId();
            Group group = requireGroup(groupId);
            User owner = requireUser(group.getOwnerId());
            responses.add(GroupResponse.detail(
                    group,
                    owner.getDisplayName(),
                    limits(owner).maxCapacity(),
                    List.of(),
                    List.of()
            ));
        }
        responses.sort(Comparator.comparing(GroupResponse::getUpdatedAt).reversed());
        return responses;
    }

    @Transactional(readOnly = true)
    public GroupResponse getGroupDetail(UUID userId, UUID groupId) {
        Group group = requireGroup(groupId);
        requireMembership(groupId, userId);
        User owner = requireUser(group.getOwnerId());
        List<GroupMemberResponse> members = loadMemberResponses(groupId);
        List<GroupMessageResponse> messages = loadRecentMessages(groupId);
        return GroupResponse.detail(group, owner.getDisplayName(), limits(owner).maxCapacity(), members, messages);
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupResponse createGroup(CreateGroupRequest req, UUID userId) {
        User user = requireUser(userId);
        Limits userLimits = limits(user);

        if (!userLimits.canCreate()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_CREATE_NOT_ALLOWED");
        }
        if (groupRepository.countByOwnerId(userId) >= userLimits.maxCreated()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_CREATE_LIMIT_EXCEEDED");
        }
        if (groupMemberRepository.countByIdUserId(userId) >= userLimits.maxJoined()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_JOIN_LIMIT_EXCEEDED");
        }

        String trimmedName = req.getName().trim();
        String trimmedPassword = req.getPassword().trim();
        if (trimmedPassword.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_PASSWORD_REQUIRED");
        }

        String groupCode = resolveGroupCode(req.getGroupCode());
        if (groupRepository.existsByGroupCode(groupCode)) {
            throw new ApiException(HttpStatus.CONFLICT, "GROUP_CODE_ALREADY_EXISTS");
        }

        LocalDateTime now = LocalDateTime.now();
        UUID groupId = UUID.randomUUID();
        Group group = new Group();
        group.setId(groupId);
        group.setGroupCode(groupCode);
        group.setPasswordHash(passwordEncoder.encode(trimmedPassword));
        group.setName(trimmedName);
        group.setDescription(trimBlankToNull(req.getDescription()));
        group.setOwnerId(userId);
        group.setCreatedAt(now);
        group.setUpdatedAt(now);
        groupRepository.save(group);

        GroupMember ownerMember = new GroupMember();
        ownerMember.setId(new GroupMemberId(groupId, userId));
        ownerMember.setRole(GroupMemberRole.OWNER);
        ownerMember.setJoinedAt(now);
        groupMemberRepository.save(ownerMember);

        return GroupResponse.detail(
                group,
                user.getDisplayName(),
                userLimits.maxCapacity(),
                List.of(GroupMemberResponse.from(ownerMember, user)),
                List.of()
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupResponse joinGroup(JoinGroupRequest req, UUID userId) {
        Limits userLimits = limits(requireUser(userId));

        if (groupMemberRepository.countByIdUserId(userId) >= userLimits.maxJoined()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_JOIN_LIMIT_EXCEEDED");
        }

        String groupCode = req.getGroupCode().trim().toUpperCase();
        Group group = groupRepository.findByGroupCode(groupCode)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GROUP_NOT_FOUND"));

        if (groupMemberRepository.existsByIdGroupIdAndIdUserId(group.getId(), userId)) {
            return getGroupDetail(userId, group.getId());
        }

        if (!passwordEncoder.matches(req.getPassword().trim(), group.getPasswordHash())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_PASSWORD_INVALID");
        }

        User owner = requireUser(group.getOwnerId());
        Limits ownerLimits = limits(owner);
        if (groupMemberRepository.countByIdGroupId(group.getId()) >= ownerLimits.maxCapacity()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_FULL");
        }

        LocalDateTime now = LocalDateTime.now();
        GroupMember member = new GroupMember();
        member.setId(new GroupMemberId(group.getId(), userId));
        member.setRole(GroupMemberRole.MEMBER);
        member.setJoinedAt(now);
        groupMemberRepository.save(member);

        group.setUpdatedAt(now);
        groupRepository.save(group);

        return getGroupDetail(userId, group.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteGroup(UUID groupId, DeleteGroupRequest req, UUID userId) {
        Group group = requireGroup(groupId);
        if (!group.getOwnerId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_DELETE_FORBIDDEN");
        }
        if (!passwordEncoder.matches(req.getPassword().trim(), group.getPasswordHash())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_PASSWORD_INVALID");
        }
        groupRepository.delete(group);
    }

    @Transactional(rollbackFor = Exception.class)
    public void leaveGroup(UUID groupId, UUID userId) {
        Group group = requireGroup(groupId);
        if (group.getOwnerId().equals(userId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_OWNER_CANNOT_LEAVE");
        }
        if (!groupMemberRepository.existsByIdGroupIdAndIdUserId(groupId, userId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "GROUP_NOT_MEMBER");
        }

        groupMemberRepository.deleteByIdGroupIdAndIdUserId(groupId, userId);
        saveSystemMessage(groupId, userId + " đã rời nhóm.");
        touchGroup(groupId);
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupMessageResponse sendMessage(UUID userId, UUID groupId, SendGroupMessageRequest request) {
        requireMembership(groupId, userId);
        String content = request.getContent().trim();
        if (content.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_MESSAGE_EMPTY");
        }

        User sender = requireUser(userId);
        GroupMessage message = saveUserMessage(groupId, userId, content, GroupMessageType.TEXT, null, null, null);
        touchGroup(groupId);
        return GroupMessageResponse.from(message, sender, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupMessageResponse shareDocument(UUID userId, UUID groupId, ShareGroupDocumentRequest request) {
        requireMembership(groupId, userId);
        Document document = documentRepository.findById(request.getDocumentId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND"));
        if (document.getDeletedAt() != null || document.getStatus() != DocumentStatus.READY) {
            throw new ApiException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND");
        }
        if (document.getVisibility() != Visibility.PUBLIC) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_DOCUMENT_NOT_PUBLIC");
        }
        if (!document.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_DOCUMENT_NOT_OWNER");
        }

        User sender = requireUser(userId);
        GroupMessage message = saveUserMessage(
                groupId,
                userId,
                document.getTitle(),
                GroupMessageType.DOCUMENT,
                document.getId(),
                null,
                null
        );
        touchGroup(groupId);
        return GroupMessageResponse.from(message, sender, document);
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupMessageResponse uploadImage(UUID userId, UUID groupId, MultipartFile file) {
        requireMembership(groupId, userId);
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_IMAGE_REQUIRED");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || originalName.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_IMAGE_INVALID_NAME");
        }

        String ext = getExtension(originalName);
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(ext)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_IMAGE_INVALID_TYPE");
        }

        String storedName = UUID.randomUUID() + "_" + originalName;
        Path targetPath = uploadDir.resolve("group-images").resolve(storedName);
        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "GROUP_IMAGE_SAVE_FAILED");
        }

        User sender = requireUser(userId);
        String imageUrl = "uploads/group-images/" + storedName;
        GroupMessage message = saveUserMessage(
                groupId,
                userId,
                originalName,
                GroupMessageType.IMAGE,
                null,
                imageUrl,
                originalName
        );
        touchGroup(groupId);
        return GroupMessageResponse.from(message, sender, null);
    }

    @Transactional(readOnly = true)
    public Document getSharedDocumentForDownload(UUID userId, UUID groupId, UUID documentId) {
        requireMembership(groupId, userId);
        groupMessageRepository.findByGroupIdOrderByCreatedAtAsc(groupId).stream()
                .filter(message -> message.getMessageType() == GroupMessageType.DOCUMENT)
                .filter(message -> documentId.equals(message.getDocumentId()))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GROUP_DOCUMENT_NOT_SHARED"));

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND"));
        if (document.getDeletedAt() != null || document.getStatus() != DocumentStatus.READY) {
            throw new ApiException(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND");
        }
        if (document.getVisibility() != Visibility.PUBLIC) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GROUP_DOCUMENT_NOT_DOWNLOADABLE");
        }
        return document;
    }

    @Transactional(readOnly = true)
    public List<GroupMemberResponse> getMembers(UUID userId, UUID groupId) {
        requireMembership(groupId, userId);
        return loadMemberResponses(groupId);
    }

    @Transactional(readOnly = true)
    public GroupSettingsResponse getSettings(UUID userId, UUID groupId) {
        GroupMember member = requireMembership(groupId, userId);
        return GroupSettingsResponse.builder()
                .groupId(groupId)
                .muted(member.isMuted())
                .pinned(member.isPinned())
                .build();
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupSettingsResponse updateMute(UUID userId, UUID groupId, boolean muted) {
        GroupMember member = requireMembership(groupId, userId);
        member.setMuted(muted);
        groupMemberRepository.save(member);
        return GroupSettingsResponse.builder()
                .groupId(groupId)
                .muted(member.isMuted())
                .pinned(member.isPinned())
                .build();
    }

    @Transactional(rollbackFor = Exception.class)
    public GroupSettingsResponse updatePin(UUID userId, UUID groupId, boolean pinned) {
        GroupMember member = requireMembership(groupId, userId);
        member.setPinned(pinned);
        groupMemberRepository.save(member);
        return GroupSettingsResponse.builder()
                .groupId(groupId)
                .muted(member.isMuted())
                .pinned(member.isPinned())
                .build();
    }

    @Transactional(readOnly = true)
    public byte[] exportChat(UUID userId, UUID groupId) {
        Group group = requireGroup(groupId);
        requireMembership(groupId, userId);
        List<GroupMessage> messages = groupMessageRepository.findByGroupIdOrderByCreatedAtAsc(groupId);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        StringBuilder builder = new StringBuilder();
        builder.append("Group: ").append(group.getName()).append('\n');
        builder.append("Group Code: ").append(group.getGroupCode()).append('\n');
        builder.append("Exported At: ").append(LocalDateTime.now().format(formatter)).append("\n\n");

        for (GroupMessage message : messages) {
            String senderName = "System";
            if (message.getSenderId() != null) {
                senderName = userRepository.findById(message.getSenderId())
                        .map(User::getDisplayName)
                        .orElse("Unknown");
            }
            builder.append('[')
                    .append(message.getCreatedAt().format(formatter))
                    .append("] ")
                    .append(senderName)
                    .append(" (")
                    .append(message.getMessageType().toJson())
                    .append("): ")
                    .append(message.getContent())
                    .append('\n');
        }
        return builder.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    @Transactional(rollbackFor = Exception.class)
    public void reportGroup(UUID userId, UUID groupId, ReportGroupRequest request) {
        requireMembership(groupId, userId);
        if (groupReportRepository.existsByGroupIdAndReporterId(groupId, userId)) {
            throw new ApiException(HttpStatus.CONFLICT, "GROUP_ALREADY_REPORTED");
        }

        GroupReport report = new GroupReport();
        report.setId(UUID.randomUUID());
        report.setGroupId(groupId);
        report.setReporterId(userId);
        report.setReason(request.getReason().trim());
        report.setCreatedAt(LocalDateTime.now());
        groupReportRepository.save(report);
    }

    private record Limits(boolean canCreate, int maxCreated, int maxJoined, int maxCapacity) {}

    private Limits limits(User user) {
        if (user.getRole() == User.Role.admin || user.getRole() == User.Role.sub_admin) {
            return new Limits(true, 50, 60, 99);
        }
        String plan = resolveActivePlanName(user);
        if ("vip_5_plus".equals(plan) || "plan_5_plus".equals(plan)) {
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

    private Group requireGroup(UUID groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "GROUP_NOT_FOUND"));
    }

    private User requireUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND"));
        if (user.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND");
        }
        return user;
    }

    private GroupMember requireMembership(UUID groupId, UUID userId) {
        return groupMemberRepository.findById_GroupIdAndId_UserId(groupId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "GROUP_NOT_MEMBER"));
    }

    private List<GroupMemberResponse> loadMemberResponses(UUID groupId) {
        List<GroupMember> members = groupMemberRepository.findById_GroupIdOrderByJoinedAtAsc(groupId);
        if (members.isEmpty()) {
            return List.of();
        }
        Map<UUID, User> usersById = userRepository.findAllById(
                members.stream().map(member -> member.getId().getUserId()).collect(Collectors.toSet())
        ).stream().collect(Collectors.toMap(User::getId, user -> user));

        return members.stream()
                .map(member -> GroupMemberResponse.from(member, usersById.get(member.getId().getUserId())))
                .toList();
    }

    private List<GroupMessageResponse> loadRecentMessages(UUID groupId) {
        List<GroupMessage> recentDesc = groupMessageRepository
                .findByGroupIdOrderByCreatedAtDesc(groupId, PageRequest.of(0, RECENT_MESSAGE_LIMIT))
                .getContent();
        if (recentDesc.isEmpty()) {
            return List.of();
        }

        List<GroupMessage> chronological = new ArrayList<>(recentDesc);
        Collections.reverse(chronological);

        Map<UUID, User> senders = userRepository.findAllById(
                chronological.stream()
                        .map(GroupMessage::getSenderId)
                        .filter(id -> id != null)
                        .collect(Collectors.toSet())
        ).stream().collect(Collectors.toMap(User::getId, user -> user));

        Map<UUID, Document> documents = documentRepository.findAllById(
                chronological.stream()
                        .map(GroupMessage::getDocumentId)
                        .filter(id -> id != null)
                        .collect(Collectors.toSet())
        ).stream().collect(Collectors.toMap(Document::getId, document -> document));

        return chronological.stream()
                .map(message -> GroupMessageResponse.from(
                        message,
                        message.getSenderId() != null ? senders.get(message.getSenderId()) : null,
                        message.getDocumentId() != null ? documents.get(message.getDocumentId()) : null
                ))
                .toList();
    }

    private GroupMessage saveUserMessage(UUID groupId, UUID senderId, String content,
                                         GroupMessageType type, UUID documentId,
                                         String imageUrl, String imageName) {
        LocalDateTime now = LocalDateTime.now();
        GroupMessage message = new GroupMessage();
        message.setId(UUID.randomUUID());
        message.setGroupId(groupId);
        message.setSenderId(senderId);
        message.setContent(content);
        message.setMessageType(type);
        message.setDocumentId(documentId);
        message.setImageUrl(imageUrl);
        message.setImageName(imageName);
        message.setCreatedAt(now);
        return groupMessageRepository.save(message);
    }

    private void saveSystemMessage(UUID groupId, String content) {
        LocalDateTime now = LocalDateTime.now();
        GroupMessage message = new GroupMessage();
        message.setId(UUID.randomUUID());
        message.setGroupId(groupId);
        message.setContent(content);
        message.setMessageType(GroupMessageType.SYSTEM);
        message.setCreatedAt(now);
        groupMessageRepository.save(message);
    }

    private void touchGroup(UUID groupId) {
        Group group = requireGroup(groupId);
        group.setUpdatedAt(LocalDateTime.now());
        groupRepository.save(group);
    }

    private String resolveGroupCode(String requestedCode) {
        if (requestedCode != null && !requestedCode.isBlank()) {
            return requestedCode.trim().toUpperCase();
        }
        for (int attempt = 0; attempt < 10; attempt++) {
            String generated = generateGroupCode();
            if (!groupRepository.existsByGroupCode(generated)) {
                return generated;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "GROUP_CODE_GENERATION_FAILED");
    }

    private String generateGroupCode() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 3).toUpperCase();
        int number = 100 + (int) (Math.random() * 900);
        return "GRP-" + suffix + "-" + number;
    }

    private String trimBlankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String getExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0) {
            return "";
        }
        return filename.substring(dot + 1).toLowerCase();
    }
}
