package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

/** DTO nhận ID Token từ phía client khi đăng nhập bằng Google. */
public class GoogleLoginRequest {

    @NotBlank(message = "ID Token Google không được để trống.")
    private String idToken;

    public String getIdToken() {
        return idToken;
    }

    public void setIdToken(String idToken) {
        this.idToken = idToken;
    }
}
