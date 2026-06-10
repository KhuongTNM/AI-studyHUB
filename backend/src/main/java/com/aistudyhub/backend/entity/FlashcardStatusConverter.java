package com.aistudyhub.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class FlashcardStatusConverter implements AttributeConverter<FlashcardStatus, String> {

    @Override
    public String convertToDatabaseColumn(FlashcardStatus status) {
        return status.name().toLowerCase();
    }

    @Override
    public FlashcardStatus convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return FlashcardStatus.fromString(dbData);
        } catch (IllegalArgumentException e) {
            return FlashcardStatus.NEW;
        }
    }
}
