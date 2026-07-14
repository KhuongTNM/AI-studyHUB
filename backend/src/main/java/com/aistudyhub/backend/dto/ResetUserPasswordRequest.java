package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * BR-062: Request body for Admin/Sub-admin resetting a user's password.
 * The new password is further validated against BR-002 in the service layer.
 */
public class ResetUserPasswordRequest {

    @NotBlank(message = "Mật khẩu mới không được để trống.")
    @Size(min = 8, message = "Mật khẩu phải có ít nhất 8 ký tự.")
    private String newPassword;

    @NotBlank(message = "Mật khẩu Admin không được để trống.")
    private String adminPassword;

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }

    public String getAdminPassword() {
        return adminPassword;
    }

    public void setAdminPassword(String adminPassword) {
        this.adminPassword = adminPassword;
    }
}
