package com.aistudyhub.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class GroupMemberRoleConverter implements AttributeConverter<GroupMemberRole, String> {

    @Override
    public String convertToDatabaseColumn(GroupMemberRole role) {
        return role.name().toLowerCase();
    }

    @Override
    public GroupMemberRole convertToEntityAttribute(String dbData) {
        return GroupMemberRole.valueOf(dbData.toUpperCase());
    }
}
