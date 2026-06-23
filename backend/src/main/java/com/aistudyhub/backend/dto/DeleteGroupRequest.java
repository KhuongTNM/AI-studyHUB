package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class DeleteGroupRequest {

    @NotBlank(message = "Mật khẩu nhóm không được để trống.")
    private String password;

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
