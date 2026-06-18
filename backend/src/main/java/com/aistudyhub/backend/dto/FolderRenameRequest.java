package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * FR-23: Dữ liệu gửi lên từ Frontend để đổi tên một thư mục.
 * Subject cũng có thể được cập nhật cùng lúc; null = giữ nguyên giá trị cũ.
 */
public class FolderRenameRequest {

    @NotBlank(message = "Tên thư mục không được để trống.")
    @Size(max = 50, message = "Tên thư mục không được vượt quá 50 ký tự.")
    private String name;

    @Size(max = 100, message = "Tên môn học không được vượt quá 100 ký tự.")
    private String subject;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }
}
