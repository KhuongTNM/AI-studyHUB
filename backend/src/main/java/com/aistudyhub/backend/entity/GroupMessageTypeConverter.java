package com.aistudyhub.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class GroupMessageTypeConverter implements AttributeConverter<GroupMessageType, String> {

    @Override
    public String convertToDatabaseColumn(GroupMessageType messageType) {
        return messageType.name().toLowerCase();
    }

    @Override
    public GroupMessageType convertToEntityAttribute(String dbData) {
        return GroupMessageType.valueOf(dbData.toUpperCase());
    }
}
