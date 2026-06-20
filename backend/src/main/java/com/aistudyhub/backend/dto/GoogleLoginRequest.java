package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

/** DTO nhận access token từ phía client khi đăng nhập bằng Google OAuth2. */
public class GoogleLoginRequest {

    @NotBlank(message = "Access token Google không được để trống.")
    private String accessToken;

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }
}
