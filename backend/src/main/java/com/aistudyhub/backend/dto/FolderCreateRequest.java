package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * FR-23: Dữ liệu gửi lên từ Frontend để tạo một thư mục mới.
 * parentId = null nghĩa là tạo thư mục gốc; có giá trị nghĩa là tạo thư mục con.
 * subject có thể null — nếu tạo con mà không truyền lên, Service sẽ kế thừa từ cha (BR-083).
 */
public class FolderCreateRequest {

    @NotBlank(message = "Tên thư mục không được để trống.")
    @Size(max = 50, message = "Tên thư mục không được vượt quá 50 ký tự.")
    private String name;

    /** ID thư mục cha. Null khi tạo thư mục ở cấp gốc. */
    private UUID parentId;

    /** Nhãn môn học. Null cho phép — Service tự kế thừa từ cha nếu cần (BR-083). */
    @Size(max = 100, message = "Tên môn học không được vượt quá 100 ký tự.")
    private String subject;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public UUID getParentId() {
        return parentId;
    }

    public void setParentId(UUID parentId) {
        this.parentId = parentId;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }
}
