package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public class UpdatePackagePriceRequest {

    private BigDecimal price;

    @NotBlank(message = "Mật khẩu Admin không được để trống.")
    private String adminPassword;

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public String getAdminPassword() {
        return adminPassword;
    }

    public void setAdminPassword(String adminPassword) {
        this.adminPassword = adminPassword;
    }
}
