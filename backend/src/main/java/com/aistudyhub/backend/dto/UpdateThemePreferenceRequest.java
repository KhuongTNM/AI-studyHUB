package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateThemePreferenceRequest {

    @NotBlank(message = "Giao diện không được để trống.")
    private String themePreference;

    public String getThemePreference() {
        return themePreference;
    }

    public void setThemePreference(String themePreference) {
        this.themePreference = themePreference;
    }
}
