package com.aistudyhub.backend.dto;

import com.aistudyhub.backend.entity.UploadSettings;

public class UploadSettingsResponse {

    private long maxFileSizeBytes;
    private double maxFileSizeMb;
    private int maxFilesPerUpload;

    public static UploadSettingsResponse from(UploadSettings settings) {
        UploadSettingsResponse response = new UploadSettingsResponse();
        response.maxFileSizeBytes = settings.getMaxFileSizeBytes();
        response.maxFileSizeMb = settings.getMaxFileSizeBytes() / (1024.0 * 1024.0);
        response.maxFilesPerUpload = settings.getMaxFilesPerUpload();
        return response;
    }

    public long getMaxFileSizeBytes() {
        return maxFileSizeBytes;
    }

    public double getMaxFileSizeMb() {
        return maxFileSizeMb;
    }

    public int getMaxFilesPerUpload() {
        return maxFilesPerUpload;
    }
}
