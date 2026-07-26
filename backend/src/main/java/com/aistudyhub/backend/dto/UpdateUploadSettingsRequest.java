package com.aistudyhub.backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public class UpdateUploadSettingsRequest {

    @NotNull(message = "Dung lượng tối đa mỗi file không được để trống.")
    @DecimalMin(value = "0.1", message = "Dung lượng tối đa mỗi file phải lớn hơn 0 MB.")
    private Double maxFileSizeMb;

    @NotNull(message = "Số lượng file tối đa không được để trống.")
    @Min(value = 1, message = "Số lượng file tối đa phải từ 1 trở lên.")
    @Max(value = 100, message = "Số lượng file tối đa không được vượt quá 100.")
    private Integer maxFilesPerUpload;

    public Double getMaxFileSizeMb() {
        return maxFileSizeMb;
    }

    public void setMaxFileSizeMb(Double maxFileSizeMb) {
        this.maxFileSizeMb = maxFileSizeMb;
    }

    public Integer getMaxFilesPerUpload() {
        return maxFilesPerUpload;
    }

    public void setMaxFilesPerUpload(Integer maxFilesPerUpload) {
        this.maxFilesPerUpload = maxFilesPerUpload;
    }
}
