package com.aistudyhub.backend.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public class StudyRoomMemberResponse {
    private UUID userId;
    private String displayName;
    private LocalDateTime joinedAt;

    public StudyRoomMemberResponse(UUID userId, String displayName, LocalDateTime joinedAt) {
        this.userId = userId;
        this.displayName = displayName;
        this.joinedAt = joinedAt;
    }

    public UUID getUserId() { return userId; }
    public String getDisplayName() { return displayName; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
}
