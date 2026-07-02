package com.aistudyhub.backend.dto;

import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CreateChatSessionRequest {
    /** Tài liệu đang chat cùng — nullable (BR-A5: phục hồi tài liệu khi mở lại session) */
    private UUID documentId;
    /** Tuỳ chọn: cho phép client đặt tiêu đề ngay khi tạo, mặc định null -> service tự đặt */
    private String title;
}
