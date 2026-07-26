package com.aistudyhub.backend.dto;

import java.math.BigDecimal;

public class UpdatePackagePriceRequest {

    private BigDecimal price;

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }
}
