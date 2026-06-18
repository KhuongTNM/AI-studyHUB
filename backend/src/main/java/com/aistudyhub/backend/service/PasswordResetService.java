package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.ResetPasswordRequest;
import com.aistudyhub.backend.entity.PasswordResetToken;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.PasswordResetTokenRepository;
import com.aistudyhub.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PasswordResetService.class);
    private static final int TOKEN_EXPIRY_MINUTES = 15;

    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public PasswordResetService(
            PasswordResetTokenRepository passwordResetTokenRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public Map<String, String> forgotPassword(String email) {
        String normalizedEmail = email.trim().toLowerCase();

        boolean userExists = userRepository.existsByEmailIgnoreCase(normalizedEmail);

        if (userExists) {
            PasswordResetToken resetToken = new PasswordResetToken();
            resetToken.setId(UUID.randomUUID());
            resetToken.setEmail(normalizedEmail);
            resetToken.setToken(UUID.randomUUID().toString());
            resetToken.setExpiry(LocalDateTime.now().plusMinutes(TOKEN_EXPIRY_MINUTES));
            resetToken.setUsed(false);
            passwordResetTokenRepository.save(resetToken);

            LOGGER.info("Reset link: http://localhost:8080/api/auth/reset-password?token={}", resetToken.getToken());
        }

        return Map.of("message", "Link đã được gửi đến email của bạn");
    }

    @Transactional
    public Map<String, String> resetPassword(ResetPasswordRequest request) {
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(request.getToken())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Token không hợp lệ."));

        if (resetToken.isUsed()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Token đã được sử dụng.");
        }

        if (LocalDateTime.now().isAfter(resetToken.getExpiry())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Token đã hết hạn (quá 15 phút).");
        }

        User user = userRepository.findByEmailIgnoreCase(resetToken.getEmail())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

        PasswordPolicyValidator.validate(request.getNewPassword());

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        LOGGER.info("Password reset successful for email: {}", resetToken.getEmail());

        return Map.of("message", "Mật khẩu đã được đặt lại thành công.");
    }
}
