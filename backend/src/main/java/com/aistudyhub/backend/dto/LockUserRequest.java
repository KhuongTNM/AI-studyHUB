package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotNull;

public class LockUserRequest {

    @NotNull(message = "Trường 'locked' không được để trống.")
    private Boolean locked;

    public Boolean getLocked() {
        return locked;
    }

    public void setLocked(Boolean locked) {
        this.locked = locked;
    }
}
