package com.aistudyhub.backend.dto.request;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ShareDocumentRequest {

    @NotNull(message = "Vui lòng chọn tài liệu cần chia sẻ")
    private UUID documentId;
}