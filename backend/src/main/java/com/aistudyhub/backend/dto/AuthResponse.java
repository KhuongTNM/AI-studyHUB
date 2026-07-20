package com.aistudyhub.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthResponse {

    private String accessToken;
    private String tokenType = "Bearer";
    private UserResponse user;

    /** BR-005: chỉ có giá trị khi đăng ký, null khi đăng nhập (bỏ qua trong JSON). */
    @JsonProperty("password_strength")
    private String passwordStrength;

    /** BR-095: true khi register vừa tạo tài khoản và đang chờ xác thực OTP; null (ẩn) ở các response khác. */
    private Boolean requiresVerification;

    /** BR-095: thời hạn hiệu lực của OTP vừa gửi, tính bằng giây; null (ẩn) ở các response khác. */
    private Integer otpExpiresInSeconds;

    public AuthResponse(String accessToken, UserResponse user) {
        this.accessToken = accessToken;
        this.user = user;
    }

    /** BR-095: dùng cho response của register — không cấp accessToken cho tới khi verify OTP. */
    public AuthResponse(UserResponse user) {
        this.user = user;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public String getTokenType() {
        return tokenType;
    }

    public UserResponse getUser() {
        return user;
    }

    public String getPasswordStrength() {
        return passwordStrength;
    }

    public void setPasswordStrength(String passwordStrength) {
        this.passwordStrength = passwordStrength;
    }

    public Boolean getRequiresVerification() {
        return requiresVerification;
    }

    public void setRequiresVerification(Boolean requiresVerification) {
        this.requiresVerification = requiresVerification;
    }

    public Integer getOtpExpiresInSeconds() {
        return otpExpiresInSeconds;
    }

    public void setOtpExpiresInSeconds(Integer otpExpiresInSeconds) {
        this.otpExpiresInSeconds = otpExpiresInSeconds;
    }
}