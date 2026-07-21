package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.UpdateUploadSettingsRequest;
import com.aistudyhub.backend.dto.UploadSettingsResponse;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.service.AdminSecurityService;
import com.aistudyhub.backend.service.UploadSettingsService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin/Sub-admin cấu hình giới hạn upload TOÀN HỆ THỐNG.
 * Độc lập hoàn toàn với SubscriptionPlan — áp dụng cho mọi user.
 * Route đã nằm trong "/api/admin/**" -> được bảo vệ bởi SecurityConfig.
 */
@RestController
@RequestMapping("/api/admin/upload-settings")
public class AdminUploadSettingsController {

    private final UploadSettingsService uploadSettingsService;
    private final AdminSecurityService adminSecurityService;

    public AdminUploadSettingsController(
            UploadSettingsService uploadSettingsService,
            AdminSecurityService adminSecurityService) {
        this.uploadSettingsService = uploadSettingsService;
        this.adminSecurityService = adminSecurityService;
    }

    @PutMapping
    public ResponseEntity<UploadSettingsResponse> updateSettings(
            @Valid @RequestBody UpdateUploadSettingsRequest request) {
        User actor = adminSecurityService.verifyAdminPassword(request.getAdminPassword());
        return ResponseEntity.ok(uploadSettingsService.updateSettings(actor, request));
    }
}
