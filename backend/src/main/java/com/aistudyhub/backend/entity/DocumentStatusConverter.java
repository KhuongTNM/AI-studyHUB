package com.aistudyhub.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class DocumentStatusConverter implements AttributeConverter<DocumentStatus, String> {

    @Override
    public String convertToDatabaseColumn(DocumentStatus status) {
        return status.name().toLowerCase();
    }

    @Override
    public DocumentStatus convertToEntityAttribute(String dbData) {
        return DocumentStatus.valueOf(dbData.toUpperCase());
    }
}
