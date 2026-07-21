package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.UploadSettingsResponse;
import com.aistudyhub.backend.service.UploadSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public read-only — FE dùng để hiển thị/validate giới hạn upload hiện hành. */
@RestController
@RequestMapping("/api/upload-settings")
public class UploadSettingsController {

    private final UploadSettingsService uploadSettingsService;

    public UploadSettingsController(UploadSettingsService uploadSettingsService) {
        this.uploadSettingsService = uploadSettingsService;
    }

    @GetMapping
    public ResponseEntity<UploadSettingsResponse> getSettings() {
        return ResponseEntity.ok(uploadSettingsService.getSettings());
    }
}
