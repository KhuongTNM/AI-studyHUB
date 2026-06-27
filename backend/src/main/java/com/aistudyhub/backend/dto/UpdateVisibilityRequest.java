package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class UpdateVisibilityRequest {

    @NotBlank(message = "Visibility không được để trống.")
    private String visibility;

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
}
