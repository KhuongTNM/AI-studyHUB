package com.aistudyhub.backend.entity;

import com.fasterxml.jackson.annotation.JsonValue;

public enum GroupMessageType {
    TEXT,
    DOCUMENT,
    IMAGE,
    SYSTEM;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }
}
