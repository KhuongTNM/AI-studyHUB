package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class ResendOtpRequest {

    @NotBlank(message = "Email không được để trống.")
    @Email(message = "Email không đúng định dạng.")
    private String email;

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}