package com.aistudyhub.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MuteGroupRequest {

    @NotNull(message = "MUTED_STATUS_REQUIRED")
    private Boolean muted;
}