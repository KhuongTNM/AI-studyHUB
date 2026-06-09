package com.aistudyhub.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class VisibilityConverter implements AttributeConverter<Visibility, String> {

    @Override
    public String convertToDatabaseColumn(Visibility visibility) {
        return visibility.name().toLowerCase();
    }

    @Override
    public Visibility convertToEntityAttribute(String dbData) {
        return Visibility.valueOf(dbData.toUpperCase());
    }
}
