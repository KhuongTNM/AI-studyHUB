package com.aistudyhub.backend.entity;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Visibility {
    PRIVATE,
    PUBLIC;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }
}
