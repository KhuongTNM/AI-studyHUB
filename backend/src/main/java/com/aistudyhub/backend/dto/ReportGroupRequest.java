package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ReportGroupRequest {

    @NotBlank(message = "Lý do báo cáo không được để trống.")
    @Size(max = 500, message = "Lý do báo cáo không được vượt quá 500 ký tự.")
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
