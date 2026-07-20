package com.aistudyhub.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
public class SmtpEmailService implements EmailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(SmtpEmailService.class);

    private final JavaMailSender mailSender;

    /** Gmail chỉ chấp nhận From = đúng tài khoản đã xác thực SMTP, nên tái dùng spring.mail.username. */
    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    public SmtpEmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Override
    @Async("taskExecutor")
    public void sendResetEmail(String to, String token) {
        // Link này sẽ trỏ về màn hình Đổi Mật Khẩu của FRONTEND (React/Vue/Thymeleaf)
        // chứ không phải trỏ thẳng vào Backend API.
        String resetLink = frontendUrl + "/reset-password?token=" + token;

        String htmlContent = "<p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click <a href='" + resetLink + "'>vào đây</a> để tiến hành. Link này sẽ hết hạn trong 15 phút.</p>";

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("Khôi phục mật khẩu - AI Study Hub");
            helper.setText(htmlContent, true);
            mailSender.send(message);
            LOGGER.info("Successfully sent password reset email to: {}", to);
        } catch (MessagingException | MailException e) {
            // Log the error securely without exposing the token to logs
            LOGGER.error("Failed to send password reset email to: {}. Error: {}", to, e.getMessage());
        }
    }

    // BR-095: gửi bất đồng bộ, không chặn luồng đăng ký/gửi lại mã nếu email provider tạm thời lỗi.
    @Override
    @Async("taskExecutor")
    public void sendOtpEmail(String to, String otpCode) {
        String htmlContent = "<p>Mã xác thực email đăng ký của bạn là: <b>" + otpCode
                + "</b>. Mã này sẽ hết hạn sau 10 phút.</p>";

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("Xác thực email đăng ký - AI Study Hub");
            helper.setText(htmlContent, true);
            mailSender.send(message);
            LOGGER.info("Successfully sent OTP verification email to: {}", to);
        } catch (MessagingException | MailException e) {
            LOGGER.error("Failed to send OTP verification email to: {}. Error: {}", to, e.getMessage());
        }
    }
}
