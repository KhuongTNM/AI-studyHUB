package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.StudyRoom;
import java.time.LocalDateTime;
import java.util.UUID;

public class StudyRoomResponse {

    private UUID id;
    private String code;
    private UUID hostId;
    private boolean hasPassword;
    private short maxMembers;
    private short currentMemberCount;
    private boolean active;
    private LocalDateTime createdAt;

    public static StudyRoomResponse from(StudyRoom room) {
        StudyRoomResponse r = new StudyRoomResponse();
        r.id = room.getId();
        r.code = room.getCode();
        r.hostId = room.getHostId();
        r.hasPassword = room.getPasswordHash() != null;
        r.maxMembers = room.getMaxMembers();
        r.currentMemberCount = room.getCurrentMemberCount();
        r.active = room.isActive();
        r.createdAt = room.getCreatedAt();
        return r;
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public UUID getHostId() { return hostId; }
    public boolean isHasPassword() { return hasPassword; }
    public short getMaxMembers() { return maxMembers; }
    public short getCurrentMemberCount() { return currentMemberCount; }
    public boolean isActive() { return active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
