package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateStudyRoomRequest;
import com.aistudyhub.backend.dto.JoinStudyRoomRequest;
import com.aistudyhub.backend.dto.SendStudyRoomMessageRequest;
import com.aistudyhub.backend.dto.ShareRoomDocumentRequest;
import com.aistudyhub.backend.dto.StudyRoomMemberResponse;
import com.aistudyhub.backend.dto.StudyRoomMessageResponse;
import com.aistudyhub.backend.dto.StudyRoomResponse;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.entity.StudyRoom;
import com.aistudyhub.backend.entity.StudyRoomMember;
import com.aistudyhub.backend.entity.StudyRoomMessage;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.entity.Visibility;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.StudyRoomMemberRepository;
import com.aistudyhub.backend.repository.StudyRoomMessageRepository;
import com.aistudyhub.backend.repository.StudyRoomRepository;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StudyRoomService {

    private final StudyRoomRepository studyRoomRepository;
    private final StudyRoomMemberRepository studyRoomMemberRepository;
    private final StudyRoomMessageRepository studyRoomMessageRepository;
    private final UserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final DocumentRepository documentRepository;

    public StudyRoomService(StudyRoomRepository studyRoomRepository,
                            StudyRoomMemberRepository studyRoomMemberRepository,
                            StudyRoomMessageRepository studyRoomMessageRepository,
                            UserRepository userRepository,
                            SubscriptionPlanRepository subscriptionPlanRepository,
                            DocumentRepository documentRepository) {
        this.studyRoomRepository = studyRoomRepository;
        this.studyRoomMemberRepository = studyRoomMemberRepository;
        this.studyRoomMessageRepository = studyRoomMessageRepository;
        this.userRepository = userRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.documentRepository = documentRepository;
    }

    @Transactional(readOnly = true)
    public List<StudyRoomResponse> listActiveRooms() {
        getCurrentUserId();
        return studyRoomRepository.findByIsActiveTrueOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public StudyRoomResponse getRoom(String code) {
        getCurrentUserId();
        StudyRoom room = getActiveRoomByCode(code);
        return toResponse(room);
    }

    @Transactional
    public StudyRoomResponse createRoom(CreateStudyRoomRequest request) {
        UUID userId = getCurrentUserId();
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại."));

        checkCreateRoomPermission(user);

        if (studyRoomRepository.existsByCode(request.getRoomCode())) {
            throw new ApiException(HttpStatus.CONFLICT, "Mã phòng đã tồn tại.");
        }

        String code = request.getRoomCode().toUpperCase();
        String passwordHash = request.getPassword() != null && !request.getPassword().isBlank()
                ? request.getPassword() : null;

        short maxMembers = resolveMaxMembers(user);

        LocalDateTime now = LocalDateTime.now();
        StudyRoom room = new StudyRoom();
        room.setId(UUID.randomUUID());
        room.setCode(code);
        room.setHostId(userId);
        room.setPasswordHash(passwordHash);
        room.setMaxMembers(maxMembers);
        room.setCurrentMemberCount((short) 1);
        room.setActive(true);
        room.setCreatedAt(now);

        StudyRoom saved = studyRoomRepository.save(room);
        addOrReactivateMember(saved, user, now);
        addSystemMessage(saved, "Phòng học " + code + " đã được tạo bởi " + user.getDisplayName() + ".", now);
        return toResponse(saved);
    }

    @Transactional
    public StudyRoomResponse joinRoom(String code, JoinStudyRoomRequest request) {
        User user = getCurrentUser();
        StudyRoom room = getActiveRoomByCode(code);
        if (room.getPasswordHash() != null) {
            String password = request != null ? request.getPassword() : null;
            if (password == null || !room.getPasswordHash().equals(password)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Mật khẩu phòng không đúng.");
            }
        }
        if (!studyRoomMemberRepository.existsByRoomIdAndUserIdAndLeftAtIsNull(room.getId(), user.getId())
                && studyRoomMemberRepository.countByRoomIdAndLeftAtIsNull(room.getId()) >= room.getMaxMembers()) {
            throw new ApiException(HttpStatus.CONFLICT, "Phòng học đã đầy.");
        }

        LocalDateTime now = LocalDateTime.now();
        boolean wasMember = studyRoomMemberRepository.existsByRoomIdAndUserIdAndLeftAtIsNull(room.getId(), user.getId());
        addOrReactivateMember(room, user, now);
        if (!wasMember) {
            addSystemMessage(room, user.getDisplayName() + " đã tham gia phòng.", now);
        }
        syncMemberCount(room);
        return toResponse(room);
    }

    @Transactional
    public StudyRoomResponse leaveRoom(String code) {
        User user = getCurrentUser();
        StudyRoom room = getActiveRoomByCode(code);
        StudyRoomMember member = studyRoomMemberRepository.findByRoomIdAndUserId(room.getId(), user.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Bạn chưa tham gia phòng này."));

        LocalDateTime now = LocalDateTime.now();
        if (room.getHostId().equals(user.getId())) {
            room.setActive(false);
            room.setClosedAt(now);
            studyRoomMemberRepository.findByRoomIdAndLeftAtIsNull(room.getId()).forEach(activeMember -> {
                activeMember.setLeftAt(now);
                studyRoomMemberRepository.save(activeMember);
            });
            room.setCurrentMemberCount((short) 0);
            studyRoomRepository.save(room);
            addSystemMessage(room, "Host đã đóng phòng học.", now);
            return toResponse(room);
        }

        member.setLeftAt(now);
        studyRoomMemberRepository.save(member);
        addSystemMessage(room, user.getDisplayName() + " đã rời phòng.", now);
        syncMemberCount(room);
        return toResponse(room);
    }

    @Transactional
    public StudyRoomResponse sendMessage(String code, SendStudyRoomMessageRequest request) {
        User user = getCurrentUser();
        StudyRoom room = requireActiveMember(code, user.getId());
        StudyRoomMessage message = new StudyRoomMessage();
        message.setId(UUID.randomUUID());
        message.setRoomId(room.getId());
        message.setUserId(user.getId());
        message.setContent(request.getContent().trim());
        message.setMessageType(StudyRoomMessage.TYPE_USER);
        message.setCreatedAt(LocalDateTime.now());
        studyRoomMessageRepository.save(message);
        return toResponse(room);
    }

    @Transactional
    public StudyRoomResponse shareDocument(String code, ShareRoomDocumentRequest request) {
        User user = getCurrentUser();
        StudyRoom room = requireActiveMember(code, user.getId());
        Document doc = documentRepository.findById(request.getDocumentId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));
        if (doc.getDeletedAt() != null || doc.getStatus() != DocumentStatus.READY) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Chỉ được chia sẻ tài liệu đã sẵn sàng.");
        }
        boolean isOwner = doc.getUserId().equals(user.getId());
        if (!isOwner) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền chia sẻ tài liệu này.");
        }
        if (doc.getVisibility() != Visibility.PUBLIC) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Chỉ tài liệu Public mới được chia sẻ vào phòng.");
        }

        StudyRoomMessage message = new StudyRoomMessage();
        message.setId(UUID.randomUUID());
        message.setRoomId(room.getId());
        message.setUserId(user.getId());
        message.setContent("Shared document: " + doc.getTitle());
        message.setMessageType(StudyRoomMessage.TYPE_DOCUMENT);
        message.setDocumentId(doc.getId());
        message.setCreatedAt(LocalDateTime.now());
        studyRoomMessageRepository.save(message);
        return toResponse(room);
    }

    private void checkCreateRoomPermission(User user) {
        if (user.getRole() == User.Role.admin || user.getRole() == User.Role.sub_admin) {
            return;
        }

        Integer planId = user.getSubscriptionPlanId();
        if (planId == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn cần gói trả phí để tạo phòng học.");
        }

        LocalDateTime expiresAt = user.getSubscriptionExpiresAt();
        if (expiresAt == null || expiresAt.isBefore(LocalDateTime.now())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Gói subscription của bạn đã hết hạn.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findById(planId)
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Bạn cần gói trả phí để tạo phòng học."));

        if (SubscriptionPlan.FREE_PLAN_NAME.equals(plan.getName())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn cần gói trả phí để tạo phòng học.");
        }
    }

    private short resolveMaxMembers(User user) {
        if (user.getRole() == User.Role.admin || user.getRole() == User.Role.sub_admin) {
            return (short) 99;
        }

        Integer planId = user.getSubscriptionPlanId();
        if (planId == null) return 4;

        return subscriptionPlanRepository.findById(planId)
                .map(SubscriptionPlan::getMaxRoomMembers)
                .orElse((short) 4);
    }

    private StudyRoom getActiveRoomByCode(String code) {
        return studyRoomRepository.findByCode(code.trim().toUpperCase())
                .filter(StudyRoom::isActive)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Phòng học không tồn tại."));
    }

    private StudyRoom requireActiveMember(String code, UUID userId) {
        StudyRoom room = getActiveRoomByCode(code);
        if (!studyRoomMemberRepository.existsByRoomIdAndUserIdAndLeftAtIsNull(room.getId(), userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn chưa tham gia phòng này.");
        }
        return room;
    }

    private void addOrReactivateMember(StudyRoom room, User user, LocalDateTime now) {
        StudyRoomMember member = studyRoomMemberRepository.findByRoomIdAndUserId(room.getId(), user.getId())
                .orElseGet(() -> {
                    StudyRoomMember next = new StudyRoomMember();
                    next.setId(UUID.randomUUID());
                    next.setRoomId(room.getId());
                    next.setUserId(user.getId());
                    next.setJoinedAt(now);
                    return next;
                });
        member.setLeftAt(null);
        studyRoomMemberRepository.save(member);
        syncMemberCount(room);
    }

    private void addSystemMessage(StudyRoom room, String content, LocalDateTime createdAt) {
        StudyRoomMessage message = new StudyRoomMessage();
        message.setId(UUID.randomUUID());
        message.setRoomId(room.getId());
        message.setUserId(null);
        message.setContent(content);
        message.setMessageType(StudyRoomMessage.TYPE_SYSTEM);
        message.setCreatedAt(createdAt);
        studyRoomMessageRepository.save(message);
    }

    private void syncMemberCount(StudyRoom room) {
        room.setCurrentMemberCount((short) studyRoomMemberRepository.countByRoomIdAndLeftAtIsNull(room.getId()));
        studyRoomRepository.save(room);
    }

    private StudyRoomResponse toResponse(StudyRoom room) {
        Map<UUID, User> usersById = userRepository.findAll().stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        String hostName = usersById.get(room.getHostId()) != null
                ? usersById.get(room.getHostId()).getDisplayName()
                : "Unknown";
        List<StudyRoomMemberResponse> members = studyRoomMemberRepository
                .findByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(room.getId()).stream()
                .map(member -> {
                    User memberUser = usersById.get(member.getUserId());
                    String displayName = memberUser != null ? memberUser.getDisplayName() : "Unknown";
                    return new StudyRoomMemberResponse(member.getUserId(), displayName, member.getJoinedAt());
                })
                .toList();
        List<StudyRoomMessage> messages = studyRoomMessageRepository.findByRoomIdOrderByCreatedAtAsc(room.getId());
        Map<UUID, Document> documentsById = documentRepository.findAllById(messages.stream()
                        .map(StudyRoomMessage::getDocumentId)
                        .filter(java.util.Objects::nonNull)
                        .collect(Collectors.toSet()))
                .stream()
                .collect(Collectors.toMap(Document::getId, Function.identity()));
        List<StudyRoomMessageResponse> messageResponses = messages.stream()
                .map(message -> {
                    User sender = message.getUserId() != null ? usersById.get(message.getUserId()) : null;
                    Document document = message.getDocumentId() != null ? documentsById.get(message.getDocumentId()) : null;
                    return new StudyRoomMessageResponse(
                            message.getId(),
                            message.getUserId(),
                            sender != null ? sender.getDisplayName() : "Hệ thống",
                            message.getContent(),
                            message.getMessageType(),
                            message.getDocumentId(),
                            document != null ? document.getTitle() : null,
                            document != null ? document.getSubject() : null,
                            document != null ? document.getFileType() : null,
                            document != null ? document.getVisibility().name().toLowerCase() : null,
                            document != null
                                    && document.getVisibility() == Visibility.PUBLIC
                                    && document.getDeletedAt() == null
                                    && document.getStatus() == DocumentStatus.READY,
                            message.getCreatedAt());
                })
                .toList();
        return StudyRoomResponse.from(room, hostName, members, messageResponses);
    }

    private User getCurrentUser() {
        UUID currentUserId = getCurrentUserId();
        return userRepository.findById(currentUserId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
    }

    private UUID getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        return principal.getId();
    }
}
