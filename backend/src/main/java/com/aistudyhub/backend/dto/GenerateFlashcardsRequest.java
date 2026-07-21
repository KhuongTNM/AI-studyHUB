package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import java.util.UUID;

@Getter
@Setter
public class GenerateFlashcardsRequest {

    @NotNull(message = "documentId không được để trống.")
    private UUID documentId;

    @Min(value = 1, message = "Số lượng thẻ tối thiểu là 1.")
    private Integer count = 5;
}
