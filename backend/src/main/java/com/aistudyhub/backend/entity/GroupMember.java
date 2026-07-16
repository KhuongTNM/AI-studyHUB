package com.aistudyhub.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(schema = "group_chat", name = "group_members")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GroupMember {

    @EmbeddedId
    private GroupMemberId id;

    @ManyToOne
    @MapsId("groupId")
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @Column(name = "role", length = 20, nullable = false)
    private String role = "member";

    @Column(name = "muted", nullable = false)
    private boolean muted;

    @Column(name = "pinned", nullable = false)
    private boolean pinned;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    // Trạng thái thành viên: "PENDING" (lời mời chờ phản hồi) hoặc "JOINED" (đã chính thức tham gia).
    // Mặc định là "JOINED" để không ảnh hưởng đến các bản ghi/thành viên cũ (join bằng mã + mật khẩu).
    @Column(name = "status", length = 20, nullable = false)
    private String status = "JOINED";
}