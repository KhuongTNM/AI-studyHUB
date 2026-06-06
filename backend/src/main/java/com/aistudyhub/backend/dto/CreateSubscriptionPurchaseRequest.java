package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class CreateSubscriptionPurchaseRequest {

    @NotBlank(message = "Gói dịch vụ không được để trống.")
    private String planName;

    public String getPlanName() {
        return planName;
    }

    public void setPlanName(String planName) {
        this.planName = planName;
    }
}
