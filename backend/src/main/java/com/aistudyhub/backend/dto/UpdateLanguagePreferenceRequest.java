package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateLanguagePreferenceRequest {

    @NotBlank(message = "Ngôn ngữ không được để trống.")
    private String language;

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }
}
