package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class JoinGroupRequest {

    @NotBlank(message = "Mã nhóm không được để trống.")
    @Size(max = 32, message = "Mã nhóm không được vượt quá 32 ký tự.")
    private String groupCode;

    @NotBlank(message = "Mật khẩu nhóm không được để trống.")
    private String password;

    public String getGroupCode() {
        return groupCode;
    }

    public void setGroupCode(String groupCode) {
        this.groupCode = groupCode;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
