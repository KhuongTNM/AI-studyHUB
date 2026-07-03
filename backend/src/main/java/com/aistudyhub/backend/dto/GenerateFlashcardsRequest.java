package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import java.util.UUID;

@Getter
@Setter
public class GenerateFlashcardsRequest {

    @NotNull(message = "documentId không được để trống.")
    private UUID documentId;

    private Integer count = 5;
}
