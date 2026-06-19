package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
public class FolderUpdateRequest {

    @NotBlank(message = "Tên thư mục không được để trống.")
    @Size(max = 50, message = "Tên thư mục không được vượt quá 50 ký tự.")
    private String name;
    @Size(max = 100, message = "Tên môn học không được vượt quá 100 ký tự.")
    private String subject;
    private boolean changeParent;
    private UUID parentId;

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

    public boolean isChangeParent() {
        return changeParent;
    }

    public void setChangeParent(boolean changeParent) {
        this.changeParent = changeParent;
    }

    public UUID getParentId() {
        return parentId;
    }

    public void setParentId(UUID parentId) {
        this.parentId = parentId;
    }
}
