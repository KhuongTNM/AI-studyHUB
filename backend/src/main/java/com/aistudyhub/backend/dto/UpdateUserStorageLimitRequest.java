package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public class UpdateUserStorageLimitRequest {

    @NotNull(message = "Giới hạn dung lượng không được để trống.")
    @DecimalMin(value = "0.1", message = "Giới hạn dung lượng phải lớn hơn 0 GB.")
    private BigDecimal storageLimitGb;

    public BigDecimal getStorageLimitGb() {
        return storageLimitGb;
    }

    public void setStorageLimitGb(BigDecimal storageLimitGb) {
        this.storageLimitGb = storageLimitGb;
    }
}
