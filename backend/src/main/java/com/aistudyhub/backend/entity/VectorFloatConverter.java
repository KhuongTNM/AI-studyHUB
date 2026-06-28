package com.aistudyhub.backend.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * Chuyển đổi float[] <-> chuỗi pgvector "[x1,x2,...,xN]"
 *
 * pgvector lưu trong PostgreSQL dưới dạng "[0.12,-0.34,0.56,...]"
 * JDBC driver trả về kiểu String nên cần converter này.
 */
@Converter
public class VectorFloatConverter implements AttributeConverter<float[], String> {

    @Override
    public String convertToDatabaseColumn(float[] vector) {
        if (vector == null || vector.length == 0) return null;
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            sb.append(vector[i]);
            if (i < vector.length - 1) sb.append(",");
        }
        sb.append("]");
        return sb.toString();
    }

    @Override
    public float[] convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) return null;
        // Xóa dấu '[' và ']'
        String stripped = dbData.trim().replaceAll("^\\[|]$", "");
        String[] parts = stripped.split(",");
        float[] result = new float[parts.length];
        for (int i = 0; i < parts.length; i++) {
            result[i] = Float.parseFloat(parts[i].trim());
        }
        return result;
    }
}
