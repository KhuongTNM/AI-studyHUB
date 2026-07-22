package com.aistudyhub.backend.service;

import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * Gửi email qua Gmail API (HTTPS + OAuth2) thay vì SMTP thô, vì Render chặn
 * outbound tới port 25/465/587 trên free tier -> SMTP không kết nối được,
 * trong khi gmail.googleapis.com chạy qua port 443 nên không bị chặn.
 */
@Service
public class GmailApiEmailService implements EmailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(GmailApiEmailService.class);
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
    // Refresh access token sớm hơn 60s so với hạn thực tế để không bao giờ gửi bằng token vừa hết hạn.
    private static final long TOKEN_REFRESH_BUFFER_SECONDS = 60;

    private final RestTemplate restTemplate;

    @Value("${gmail.api.client-id}")
    private String clientId;

    @Value("${gmail.api.client-secret}")
    private String clientSecret;

    @Value("${gmail.api.refresh-token}")
    private String refreshToken;

    /** Phải trùng với tài khoản Gmail đã cấp quyền OAuth (chủ của refresh token ở trên). */
    @Value("${gmail.api.sender-email}")
    private String fromEmail;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private volatile String cachedAccessToken;
    private volatile Instant cachedAccessTokenExpiry = Instant.EPOCH;

    public GmailApiEmailService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @Override
    @Async("taskExecutor")
    public void sendResetEmail(String to, String token) {
        // Link này sẽ trỏ về màn hình Đổi Mật Khẩu của FRONTEND (React/Vue/Thymeleaf)
        // chứ không phải trỏ thẳng vào Backend API.
        String resetLink = frontendUrl + "/reset-password?token=" + token;
        String htmlContent = "<p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click <a href='" + resetLink
                + "'>vào đây</a> để tiến hành. Link này sẽ hết hạn trong 15 phút.</p>";

        try {
            sendRaw(buildRawMessage(to, "Khôi phục mật khẩu - AI Study Hub", htmlContent));
            LOGGER.info("Successfully sent password reset email to: {}", to);
        } catch (MessagingException | IOException e) {
            LOGGER.error("Failed to build password reset email to: {}. Error: {}", to, e.getMessage());
        } catch (RestClientException e) {
            LOGGER.error("Failed to send password reset email via Gmail API to: {}. Error: {}", to, e.getMessage());
        }
    }

    // BR-095: gửi bất đồng bộ, không chặn luồng đăng ký/gửi lại mã nếu email provider tạm thời lỗi.
    @Override
    @Async("taskExecutor")
    public void sendOtpEmail(String to, String otpCode) {
        String htmlContent = "<p>Mã xác thực email đăng ký của bạn là: <b>" + otpCode
                + "</b>. Mã này sẽ hết hạn sau 10 phút.</p>";

        try {
            sendRaw(buildRawMessage(to, "Xác thực email đăng ký - AI Study Hub", htmlContent));
            LOGGER.info("Successfully sent OTP verification email to: {}", to);
        } catch (MessagingException | IOException e) {
            LOGGER.error("Failed to build OTP verification email to: {}. Error: {}", to, e.getMessage());
        } catch (RestClientException e) {
            LOGGER.error("Failed to send OTP verification email via Gmail API to: {}. Error: {}", to, e.getMessage());
        }
    }

    /** Dựng message RFC 2822 (giống hệt cách MimeMessageHelper dùng cho SMTP trước đây), chỉ khác ở bước gửi. */
    private String buildRawMessage(String to, String subject, String htmlContent)
            throws MessagingException, IOException {
        MimeMessage message = new MimeMessage(Session.getInstance(new Properties()));
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
        helper.setFrom(fromEmail);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(htmlContent, true);

        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        message.writeTo(buffer);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer.toByteArray());
    }

    private void sendRaw(String rawBase64Url) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(getAccessToken());
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(Map.of("raw", rawBase64Url), headers);
        restTemplate.postForEntity(SEND_URL, entity, String.class);
    }

    /** Đổi refresh token lấy access token qua Google OAuth2, cache lại tới gần hết hạn mới xin lại. */
    @SuppressWarnings("unchecked")
    private synchronized String getAccessToken() {
        if (cachedAccessToken != null && Instant.now().isBefore(cachedAccessTokenExpiry)) {
            return cachedAccessToken;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("client_id", clientId);
        body.add("client_secret", clientSecret);
        body.add("refresh_token", refreshToken);
        body.add("grant_type", "refresh_token");

        Map<String, Object> response = restTemplate.postForObject(
                TOKEN_URL, new HttpEntity<>(body, headers), Map.class);
        if (response == null || response.get("access_token") == null) {
            throw new RestClientException("Không lấy được access token từ Google OAuth2 (kiểm tra lại refresh token).");
        }

        cachedAccessToken = (String) response.get("access_token");
        int expiresInSeconds = ((Number) response.getOrDefault("expires_in", 3600)).intValue();
        cachedAccessTokenExpiry = Instant.now().plusSeconds(expiresInSeconds - TOKEN_REFRESH_BUFFER_SECONDS);
        return cachedAccessToken;
    }
}