package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.StudyRoom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class StudyRoomResponse {

    private UUID id;
    private String code;
    private UUID hostId;
    private String hostName;
    private boolean hasPassword;
    private short maxMembers;
    private short currentMemberCount;
    private boolean active;
    private LocalDateTime createdAt;
    private List<StudyRoomMemberResponse> members = List.of();
    private List<StudyRoomMessageResponse> messages = List.of();

    public static StudyRoomResponse from(StudyRoom room) {
        return from(room, null, List.of(), List.of());
    }

    public static StudyRoomResponse from(
            StudyRoom room,
            String hostName,
            List<StudyRoomMemberResponse> members,
            List<StudyRoomMessageResponse> messages) {
        StudyRoomResponse r = new StudyRoomResponse();
        r.id = room.getId();
        r.code = room.getCode();
        r.hostId = room.getHostId();
        r.hostName = hostName;
        r.hasPassword = room.getPasswordHash() != null;
        r.maxMembers = room.getMaxMembers();
        r.currentMemberCount = room.getCurrentMemberCount();
        r.active = room.isActive();
        r.createdAt = room.getCreatedAt();
        r.members = members;
        r.messages = messages;
        return r;
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public UUID getHostId() { return hostId; }
    public String getHostName() { return hostName; }
    public boolean isHasPassword() { return hasPassword; }
    public short getMaxMembers() { return maxMembers; }
    public short getCurrentMemberCount() { return currentMemberCount; }
    public boolean isActive() { return active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public List<StudyRoomMemberResponse> getMembers() { return members; }
    public List<StudyRoomMessageResponse> getMessages() { return messages; }
}
