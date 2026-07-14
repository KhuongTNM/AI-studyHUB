package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public class UpdateUserStorageLimitRequest {

    @NotNull(message = "Giới hạn dung lượng không được để trống.")
    @DecimalMin(value = "0.1", message = "Giới hạn dung lượng phải lớn hơn 0 GB.")
    private BigDecimal storageLimitGb;

    @NotBlank(message = "Mật khẩu Admin không được để trống.")
    private String adminPassword;

    public BigDecimal getStorageLimitGb() {
        return storageLimitGb;
    }

    public void setStorageLimitGb(BigDecimal storageLimitGb) {
        this.storageLimitGb = storageLimitGb;
    }

    public String getAdminPassword() {
        return adminPassword;
    }

    public void setAdminPassword(String adminPassword) {
        this.adminPassword = adminPassword;
    }
}
