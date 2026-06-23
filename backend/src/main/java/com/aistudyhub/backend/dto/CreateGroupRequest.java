package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class CreateGroupRequest {

    @Size(max = 32, message = "Mã nhóm không được vượt quá 32 ký tự.")
    private String groupCode;

    @NotBlank(message = "Tên nhóm không được để trống.")
    @Size(max = 120, message = "Tên nhóm không được vượt quá 120 ký tự.")
    private String name;

    @Size(max = 500, message = "Mô tả không được vượt quá 500 ký tự.")
    private String description;

    @NotBlank(message = "Mật khẩu nhóm không được để trống.")
    private String password;

    public String getGroupCode() {
        return groupCode;
    }

    public void setGroupCode(String groupCode) {
        this.groupCode = groupCode;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
