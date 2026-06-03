package com.aistudyhub.backend.service;

import com.aistudyhub.backend.exception.ApiException;
import org.springframework.http.HttpStatus;

public final class PasswordPolicyValidator {

    private PasswordPolicyValidator() {}

    public static void validate(String password) {
        if (password == null || password.length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu phải có ít nhất 8 ký tự.");
        }
        if (!password.chars().anyMatch(Character::isLetter) || !password.chars().anyMatch(Character::isDigit)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu phải chứa ít nhất 1 chữ cái và 1 số.");
        }
    }
}
