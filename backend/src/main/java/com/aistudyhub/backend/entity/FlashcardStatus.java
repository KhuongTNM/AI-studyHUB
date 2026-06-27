package com.aistudyhub.backend.entity;

import com.fasterxml.jackson.annotation.JsonValue;

public enum FlashcardStatus {
    NEW,
    LEARNING,
    MASTERED;

    @JsonValue
    public String toJson() {
        return name().toLowerCase();
    }

    public static FlashcardStatus fromString(String value) {
        if (value == null) return null;
        return valueOf(value.toUpperCase());
    }
}
