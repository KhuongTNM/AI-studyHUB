package com.aistudyhub.backend.dto;

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
}
