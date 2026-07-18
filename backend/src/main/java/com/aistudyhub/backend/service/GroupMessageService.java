package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.GroupMessageResponse;
import com.aistudyhub.backend.dto.request.ReportGroupRequest;
import com.aistudyhub.backend.dto.request.SendTextRequest;
import com.aistudyhub.backend.dto.request.ShareDocumentRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.entity.Group;
import com.aistudyhub.backend.entity.GroupMessage;
import com.aistudyhub.backend.entity.GroupReport;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.entity.Visibility;
import com.aistudyhub.backend.exception.BusinessException;
import com.aistudyhub.backend.exception.ErrorCode;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.GroupMemberRepository;
import com.aistudyhub.backend.repository.GroupMessageRepository;
import com.aistudyhub.backend.repository.GroupReportRepository;
import com.aistudyhub.backend.repository.GroupRepository;
import com.aistudyhub.backend.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class GroupMessageService {

    private static final String MESSAGE_TYPE_TEXT = "text";
    private static final String MESSAGE_TYPE_DOCUMENT = "document";
    private static final String MESSAGE_TYPE_IMAGE = "image";
    private static final long MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
    private static final String IMAGE_CONTENT_TYPE_PREFIX = "image/";

    private final GroupMessageRepository groupMessageRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupRepository groupRepository;
    private final DocumentRepository documentRepository;
    private final GroupReportRepository groupReportRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;

    @Transactional
    public GroupMessageResponse sendTextMessage(UUID groupId, UUID userId, SendTextRequest request) {
        // Membership Check
        requireMembership(groupId, userId);

        Group group = groupRepository.getReferenceById(groupId);

        GroupMessage message = new GroupMessage();
        message.setGroup(group);
        message.setSenderId(userId);
        message.setContent(request.getContent());
        message.setMessageType(MESSAGE_TYPE_TEXT);
        message.setCreatedAt(LocalDateTime.now());

        // Save Message
        GroupMessage saved = groupMessageRepository.save(message);
        return toResponse(saved);
    }

    @Transactional
    public GroupMessageResponse shareDocument(UUID groupId, UUID userId, ShareDocumentRequest request) {
        // Membership Check
        requireMembership(groupId, userId);

        // Document Validation
        Document document = documentRepository.findById(request.getDocumentId())
                .orElseThrow(() -> new BusinessException(ErrorCode.DOCUMENT_NOT_FOUND));

        if (document.getVisibility() != Visibility.PUBLIC) {
            throw new BusinessException(ErrorCode.DOCUMENT_NOT_PUBLIC);
        }
        if (document.getStatus() != DocumentStatus.READY) {
            throw new BusinessException(ErrorCode.DOCUMENT_NOT_READY);
        }

        Group group = groupRepository.getReferenceById(groupId);

        GroupMessage message = new GroupMessage();
        message.setGroup(group);
        message.setSenderId(userId);
        message.setContent(document.getTitle());
        message.setMessageType(MESSAGE_TYPE_DOCUMENT);
        message.setDocumentId(document.getId());
        message.setCreatedAt(LocalDateTime.now());

        // Save Message
        GroupMessage saved = groupMessageRepository.save(message);
        return toResponse(saved);
    }

    // Group Chat History Fetch Logic
    @Transactional(readOnly = true)
    public List<GroupMessageResponse> getGroupMessages(UUID groupId, UUID userId) {
        // Membership Check - Fail-Fast
        requireMembership(groupId, userId);

        List<GroupMessage> messages = groupMessageRepository.findByGroup_IdOrderByCreatedAtAsc(groupId);

        // GAP FIX: senderName trước đây luôn null vì toResponse() không map trường này.
        // Batch-fetch display_name của tất cả senderId khác null (loại trừ tin nhắn hệ thống)
        // trong 1 lần truy vấn duy nhất, tránh N+1 query khi lặp qua danh sách tin nhắn.
        List<UUID> senderIds = messages.stream()
                .map(GroupMessage::getSenderId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        Map<UUID, String> senderNames = senderIds.isEmpty()
                ? Collections.emptyMap()
                : userRepository.findAllById(senderIds).stream()
                .collect(Collectors.toMap(User::getId, User::getDisplayName));

        return messages.stream()
                .map(msg -> toResponse(msg, senderNames))
                .collect(Collectors.toList());
    }

    // Membership Check
    private void requireMembership(UUID groupId, UUID userId) {
        // Check Group Existence to safely use getReferenceById
        if (!groupRepository.existsById(groupId)) {
            throw new BusinessException(ErrorCode.GROUP_NOT_FOUND);
        }
        boolean isMember = groupMemberRepository.existsByIdGroupIdAndIdUserId(groupId, userId);
        if (!isMember) {
            throw new BusinessException(ErrorCode.GROUP_ACCESS_DENIED);
        }
    }

    // NOTE: toResponse là private method nên không thể gắn @Transactional(readOnly = true)
    // trực tiếp lên đây — self-invocation (this.toResponse(...)) bị Spring AOP Proxy bỏ qua,
    // annotation sẽ không có tác dụng thật. Khi triển khai hàm getHistory (public) ở Phần sau,
    // hãy đánh dấu @Transactional(readOnly = true) ngay trên hàm public đó để Hibernate áp
    // dụng read-only flush mode cho toàn bộ luồng gọi xuống toResponse.
    // Overload tiện dụng: dùng ngay sau khi tạo 1 tin nhắn đơn lẻ (sendTextMessage, shareDocument,
    // uploadImage) - chỉ cần 1 lượt tra cứu display_name của chính sender đó (nếu có).
    private GroupMessageResponse toResponse(GroupMessage msg) {
        Map<UUID, String> senderNames = msg.getSenderId() == null
                ? Collections.emptyMap()
                : userRepository.findById(msg.getSenderId())
                .map(u -> Map.of(msg.getSenderId(), u.getDisplayName()))
                .orElse(Collections.emptyMap());
        return toResponse(msg, senderNames);
    }

    // GAP FIX: bổ sung tham số senderNames để populate trường senderName của DTO.
    // Tin nhắn hệ thống (senderId == null) giữ nguyên senderName = null.
    private GroupMessageResponse toResponse(GroupMessage msg, Map<UUID, String> senderNames) {
        GroupMessageResponse.GroupMessageResponseBuilder builder = GroupMessageResponse.builder()
                .id(msg.getId())
                .groupId(msg.getGroup().getId())
                .senderId(msg.getSenderId())
                .senderName(msg.getSenderId() != null ? senderNames.get(msg.getSenderId()) : null)
                .content(msg.getContent())
                .messageType(msg.getMessageType())
                .imageUrl(msg.getImageUrl())
                .imageName(msg.getImageName())
                .createdAt(msg.getCreatedAt());

        // Document Enrichment
        if (MESSAGE_TYPE_DOCUMENT.equals(msg.getMessageType()) && msg.getDocumentId() != null) {
            documentRepository.findById(msg.getDocumentId()).ifPresentOrElse(document -> {
                boolean downloadable = document.getVisibility() == Visibility.PUBLIC
                        && document.getStatus() == DocumentStatus.READY;

                builder.documentId(document.getId())
                        .documentName(document.getTitle())
                        .documentSubject(document.getSubject())
                        .documentVisibility(document.getVisibility().name())
                        .documentDownloadable(downloadable);
            }, () -> {
                builder.documentId(msg.getDocumentId())
                        .documentDownloadable(false);
            });
        }

        return builder.build();
    }

    // Document Download Logic
    @Transactional(readOnly = true)
    public Resource downloadDocument(UUID groupId, UUID documentId, UUID userId) {
        // Membership Check
        requireMembership(groupId, userId);

        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DOCUMENT_NOT_FOUND));

        if (document.getStatus() == DocumentStatus.DELETED) {
            throw new BusinessException(ErrorCode.DOCUMENT_DELETED);
        }
        if (document.getVisibility() != Visibility.PUBLIC) {
            throw new BusinessException(ErrorCode.DOCUMENT_NOT_PUBLIC);
        }
        if (document.getStatus() != DocumentStatus.READY) {
            throw new BusinessException(ErrorCode.DOCUMENT_NOT_READY);
        }

        return storageService.loadAsResource(document.getFileUrl());
    }

    // Image Upload Logic
    @Transactional
    public GroupMessageResponse uploadImage(UUID groupId, UUID userId, MultipartFile file) {
        // Membership Check
        requireMembership(groupId, userId);

        // Image Validation
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith(IMAGE_CONTENT_TYPE_PREFIX)) {
            throw new BusinessException(ErrorCode.INVALID_IMAGE_TYPE);
        }
        if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new BusinessException(ErrorCode.IMAGE_TOO_LARGE);
        }

        String storedImageUrl = storageService.storeGroupImage(groupId, file);

        Group group = groupRepository.getReferenceById(groupId);

        GroupMessage message = new GroupMessage();
        message.setGroup(group);
        message.setSenderId(userId);
        message.setContent(file.getOriginalFilename());
        message.setMessageType(MESSAGE_TYPE_IMAGE);
        message.setImageUrl(storedImageUrl);
        message.setImageName(file.getOriginalFilename());
        message.setCreatedAt(LocalDateTime.now());

        // Save Message
        GroupMessage saved = groupMessageRepository.save(message);
        return toResponse(saved);
    }

    // Chat History Export Logic
    @Transactional(readOnly = true)
    public Resource exportChatHistory(UUID groupId, UUID userId) {
        // Membership Check
        requireMembership(groupId, userId);

        List<GroupMessage> messages = groupMessageRepository.findByGroup_IdOrderByCreatedAtAsc(groupId);

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
        StringBuilder builder = new StringBuilder();

        for (GroupMessage msg : messages) {
            builder.append("[").append(msg.getCreatedAt().format(formatter)).append("] ");
            builder.append(msg.getSenderId() != null ? msg.getSenderId() : "Hệ thống");
            builder.append(": ");

            if (MESSAGE_TYPE_DOCUMENT.equals(msg.getMessageType())) {
                builder.append("Đã chia sẻ tài liệu - ").append(msg.getContent());
            } else if (MESSAGE_TYPE_IMAGE.equals(msg.getMessageType())) {
                builder.append("Đã gửi hình ảnh - ").append(msg.getImageName());
            } else {
                builder.append(msg.getContent());
            }
            builder.append(System.lineSeparator());
        }

        return new ByteArrayResource(builder.toString().getBytes(StandardCharsets.UTF_8));
    }

    // Group Report Logic
    @Transactional
    public void reportGroup(UUID groupId, UUID userId, ReportGroupRequest request) {
        // Membership Check
        requireMembership(groupId, userId);

        Group group = groupRepository.getReferenceById(groupId);

        GroupReport report = new GroupReport();
        report.setGroup(group);
        report.setReporterId(userId);
        report.setReason(request.getReason());
        report.setCreatedAt(LocalDateTime.now());

        // Save Report
        groupReportRepository.save(report);
    }
}