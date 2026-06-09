package com.aistudyhub.backend.entity;

import com.fasterxml.jackson.annotation.JsonValue;

public enum DocumentStatus {
    UPLOADING,
    SCANNING,
    READY,
    FAILED,
    DELETED;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }
}
