package com.aistudyhub.backend.dto.ws;

import com.aistudyhub.backend.dto.GroupMemberResponse;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Payload đẩy qua WebSocket topic "/topic/groups/{groupId}/members" mỗi khi thành viên
 * của 1 nhóm thay đổi (join/leave/kick), để FE cập nhật số lượng/danh sách thành viên
 * ngay lập tức mà không cần refresh trang.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GroupMemberEvent {

    public enum Type { MEMBER_JOINED, MEMBER_LEFT, MEMBER_KICKED }

    private Type type;
    private UUID groupId;
    private long memberCount;
    private GroupMemberResponse member;
}
