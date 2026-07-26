package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.UpdateUploadSettingsRequest;
import com.aistudyhub.backend.dto.UploadSettingsResponse;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.UploadSettingsService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin/Sub-admin cấu hình giới hạn upload TOÀN HỆ THỐNG.
 * Độc lập hoàn toàn với SubscriptionPlan — áp dụng cho mọi user.
 * Route đã nằm trong "/api/admin/**" -> được bảo vệ bởi SecurityConfig.
 * RBAC (ADM-401 / GAP-6): chỉ Role ADMIN mới được chỉnh cấu hình upload (@PreAuthorize).
 */
@RestController
@RequestMapping("/api/admin/upload-settings")
public class AdminUploadSettingsController {

    private final UploadSettingsService uploadSettingsService;

    public AdminUploadSettingsController(UploadSettingsService uploadSettingsService) {
        this.uploadSettingsService = uploadSettingsService;
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UploadSettingsResponse> updateSettings(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpdateUploadSettingsRequest request) {
        return ResponseEntity.ok(uploadSettingsService.updateSettings(principal.getId(), request));
    }
}
