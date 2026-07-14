package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class LockUserRequest {

    @NotNull(message = "Trường 'locked' không được để trống.")
    private Boolean locked;

    @NotBlank(message = "Mật khẩu Admin không được để trống.")
    private String adminPassword;

    public Boolean getLocked() {
        return locked;
    }

    public void setLocked(Boolean locked) {
        this.locked = locked;
    }

    public String getAdminPassword() {
        return adminPassword;
    }

    public void setAdminPassword(String adminPassword) {
        this.adminPassword = adminPassword;
    }
}
