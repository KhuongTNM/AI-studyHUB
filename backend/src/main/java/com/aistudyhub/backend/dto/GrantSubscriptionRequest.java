package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class GrantSubscriptionRequest {

    @NotBlank(message = "Gói dịch vụ không được để trống.")
    private String plan;

    @NotNull(message = "Thời hạn không được để trống.")
    private Integer durationMonths;

    public String getPlan() { return plan; }
    public void setPlan(String plan) { this.plan = plan; }
    public Integer getDurationMonths() { return durationMonths; }
    public void setDurationMonths(Integer durationMonths) { this.durationMonths = durationMonths; }
}
