package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.GroupMessage;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.entity.Visibility;
import java.time.LocalDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMessageResponse {

    private UUID id;
    private UUID groupId;
    private UUID senderId;
    private String senderName;
    private String content;
    private String messageType;
    private UUID documentId;
    private String documentName;
    private String documentSubject;
    private String documentVisibility;
    private Boolean documentDownloadable;
    private String imageUrl;
    private String imageName;
    private LocalDateTime createdAt;

    public static GroupMessageResponse from(GroupMessage message, User sender, Document document) {
        GroupMessageResponseBuilder builder = GroupMessageResponse.builder()
                .id(message.getId())
                .groupId(message.getGroupId())
                .senderId(message.getSenderId())
                .senderName(sender != null ? sender.getDisplayName() : "System")
                .content(message.getContent())
                .messageType(message.getMessageType().toJson())
                .imageUrl(message.getImageUrl())
                .imageName(message.getImageName())
                .createdAt(message.getCreatedAt());

        if (document != null) {
            builder.documentId(document.getId())
                    .documentName(document.getTitle())
                    .documentSubject(document.getSubject())
                    .documentVisibility(document.getVisibility().toJson())
                    .documentDownloadable(document.getVisibility() == Visibility.PUBLIC);
        } else if (message.getDocumentId() != null) {
            builder.documentId(message.getDocumentId());
        }

        return builder.build();
    }
}
