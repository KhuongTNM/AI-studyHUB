package com.aistudyhub.backend.service;

public interface EmailService {
    void sendResetEmail(String to, String token);

    /** BR-095: gửi mã OTP 6 số dạng plaintext qua email khi đăng ký / gửi lại mã. */
    void sendOtpEmail(String to, String otpCode);
}