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
}
