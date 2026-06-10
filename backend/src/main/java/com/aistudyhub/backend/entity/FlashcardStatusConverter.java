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
        return dbData == null ? null : FlashcardStatus.valueOf(dbData.toUpperCase());
    }
}
