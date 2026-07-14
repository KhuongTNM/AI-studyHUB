package com.aistudyhub.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class KickMemberRequest {

    @NotBlank(message = "Mật khẩu nhóm không được để trống")
    private String groupPassword;
}