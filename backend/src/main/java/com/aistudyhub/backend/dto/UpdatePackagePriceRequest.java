package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public class UpdatePackagePriceRequest {

    @NotNull(message = "Giá gói không được để trống.")
    @DecimalMin(value = "0.00", message = "Giá gói không được âm.")
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
