package com.aistudyhub.backend.entity;

import com.fasterxml.jackson.annotation.JsonValue;

public enum GroupMemberRole {
    OWNER,
    MEMBER;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }
}
