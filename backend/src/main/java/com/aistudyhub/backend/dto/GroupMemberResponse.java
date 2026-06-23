package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.GroupMember;
import com.aistudyhub.backend.entity.User;
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
public class GroupMemberResponse {

    private UUID userId;
    private String displayName;
    private String avatar;
    private String role;
    private LocalDateTime joinedAt;

    public static GroupMemberResponse from(GroupMember member, User user) {
        return GroupMemberResponse.builder()
                .userId(member.getId().getUserId())
                .displayName(user != null ? user.getDisplayName() : "Unknown")
                .role(member.getRole().toJson())
                .joinedAt(member.getJoinedAt())
                .build();
    }
}
