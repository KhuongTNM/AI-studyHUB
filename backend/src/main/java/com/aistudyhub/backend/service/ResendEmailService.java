package com.aistudyhub.backend.service;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.SendEmailRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class ResendEmailService implements EmailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ResendEmailService.class);

    private final Resend resend;

    @Value("${resend.from-email}")
    private String fromEmail;

    @Value("${app.base-url}")
    private String baseUrl;

    public ResendEmailService(Resend resend) {
        this.resend = resend;
    }

    @Override
    @Async("taskExecutor")
    public void sendResetEmail(String to, String token) {
        String resetLink = baseUrl + "/api/auth/reset-password?token=" + token;

        String htmlContent = "<p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click <a href='" + resetLink + "'>vào đây</a> để tiến hành. Link này sẽ hết hạn trong 15 phút.</p>";

        SendEmailRequest params = SendEmailRequest.builder()
                .from(fromEmail)
                .to(to)
                .subject("Khôi phục mật khẩu - AI Study Hub")
                .html(htmlContent)
                .build();

        try {
            resend.emails().send(params);
            LOGGER.info("Successfully sent password reset email to: {}", to);
        } catch (ResendException e) {
            // Log the error securely without exposing the token to logs
            LOGGER.error("Failed to send password reset email to: {}. Error: {}", to, e.getMessage());
        }
    }
}
