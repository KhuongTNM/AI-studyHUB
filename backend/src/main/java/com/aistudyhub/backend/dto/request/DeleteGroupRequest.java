package com.aistudyhub.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeleteGroupRequest {

    @NotBlank(message = "GROUP_PASSWORD_REQUIRED")
    private String password;
}