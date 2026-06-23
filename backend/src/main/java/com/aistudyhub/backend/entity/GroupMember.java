package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "group_members")
@Getter
@Setter
@NoArgsConstructor
public class GroupMember {

    @EmbeddedId
    private GroupMemberId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", insertable = false, updatable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    @Convert(converter = GroupMemberRoleConverter.class)
    @Column(name = "role", nullable = false, length = 20, columnDefinition = "NVARCHAR(20)")
    private GroupMemberRole role = GroupMemberRole.MEMBER;

    @Column(name = "muted", nullable = false)
    private boolean muted;

    @Column(name = "pinned", nullable = false)
    private boolean pinned;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;
}
