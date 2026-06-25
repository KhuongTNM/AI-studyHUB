package com.aistudyhub.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PinGroupRequest {

    @NotNull(message = "PINNED_STATUS_REQUIRED")
    private Boolean pinned;
}