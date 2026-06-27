package com.aistudyhub.backend.service;

import com.aistudyhub.backend.exception.ApiException;
import org.springframework.http.HttpStatus;

public final class PasswordPolicyValidator {

    private static final String SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;':\",./<>?";

    private PasswordPolicyValidator() {}

    /**
     * BR-002: ném ApiException nếu mật khẩu không đáp ứng yêu cầu tối thiểu
     * (độ dài < 8, thiếu chữ cái, hoặc thiếu chữ số).
     */
    public static void validate(String password) {
        if (password == null || password.length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu phải có ít nhất 8 ký tự.");
        }
        if (!password.chars().anyMatch(Character::isLetter) || !password.chars().anyMatch(Character::isDigit)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số.");
        }
    }

    /**
     * BR-005: trả về một trong YẾU / TRUNG_BÌNH / MẠNH / RẤT_MẠNH.
     * Tính điểm +1 cho mỗi tiêu chí đạt được:
     *   1. độ dài >= 8
     *   2. chứa chữ thường
     *   3. chứa chữ hoa
     *   4. chứa chữ số
     *   5. chứa ký tự đặc biệt
     */
    public static String calculateStrength(String password) {
        if (password == null || password.isEmpty()) {
            return "YẾU";
        }
        boolean hasLower = false;
        boolean hasUpper = false;
        boolean hasDigit = false;
        boolean hasSpecial = false;

        for (int i = 0; i < password.length(); i++) {
            char c = password.charAt(i);
            if (!hasLower && Character.isLowerCase(c)) hasLower = true;
            else if (!hasUpper && Character.isUpperCase(c)) hasUpper = true;
            else if (!hasDigit && Character.isDigit(c)) hasDigit = true;
            else if (!hasSpecial && SPECIAL_CHARS.indexOf(c) >= 0) hasSpecial = true;
            if (hasLower && hasUpper && hasDigit && hasSpecial) break;
        }

        int score = 0;
        if (password.length() >= 8) score++;
        if (hasLower) score++;
        if (hasUpper) score++;
        if (hasDigit) score++;
        if (hasSpecial) score++;

        if (score <= 1) return "YẾU";
        if (score == 2) return "TRUNG_BÌNH";
        if (score == 3) return "MẠNH";
        return "RẤT_MẠNH";
    }
}
