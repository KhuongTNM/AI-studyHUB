package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.Group;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
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
public class GroupResponse {

    private UUID id;
    private String groupCode;
    private String name;
    private String description;
    private UUID ownerId;
    private String ownerName;
    private Integer maxMembers;
    private List<GroupMemberResponse> members;
    private List<GroupMessageResponse> messages;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static GroupResponse from(Group group) {
        return GroupResponse.builder()
                .id(group.getId())
                .groupCode(group.getGroupCode())
                .name(group.getName())
                .description(group.getDescription())
                .ownerId(group.getOwnerId())
                .members(Collections.emptyList())
                .messages(Collections.emptyList())
                .createdAt(group.getCreatedAt())
                .updatedAt(group.getUpdatedAt())
                .build();
    }

    public static GroupResponse detail(Group group, String ownerName, int maxMembers,
                                       List<GroupMemberResponse> members,
                                       List<GroupMessageResponse> messages) {
        GroupResponse response = from(group);
        response.setOwnerName(ownerName);
        response.setMaxMembers(maxMembers);
        response.setMembers(members);
        response.setMessages(messages);
        return response;
    }
}
