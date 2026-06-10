package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.CreateSubAdminRequest;
import com.aistudyhub.backend.dto.GrantSubscriptionRequest;
import com.aistudyhub.backend.dto.LockUserRequest;
import com.aistudyhub.backend.dto.ResetUserPasswordRequest;
import com.aistudyhub.backend.dto.UpdateUserStorageLimitRequest;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.service.AdminUserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public ResponseEntity<List<UserResponse>> getUsers() {
        return ResponseEntity.ok(adminUserService.getUsers());
    }

    @PostMapping("/sub-admins")
    public ResponseEntity<UserResponse> createSubAdmin(@Valid @RequestBody CreateSubAdminRequest request) {
        return ResponseEntity.ok(adminUserService.createSubAdmin(request));
    }

    @PatchMapping("/{userId}/storage-limit")
    public ResponseEntity<UserResponse> updateStorageLimit(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserStorageLimitRequest request) {
        return ResponseEntity.ok(adminUserService.updateStorageLimit(userId, request));
    }

    /**
     * BR-061: Admin/Sub-admin khoá hoặc mở khoá tài khoản user.
     * Tài khoản bị khoá sẽ bị từ chối ở mọi request tiếp theo (force logout).
     */
    @PatchMapping("/{userId}/lock")
    public ResponseEntity<UserResponse> setLockStatus(
            @PathVariable UUID userId,
            @Valid @RequestBody LockUserRequest request) {
        return ResponseEntity.ok(adminUserService.setLockStatus(userId, request.getLocked()));
    }

    /**
     * BR-062: Admin/Sub-admin reset mật khẩu của user bất kỳ (trừ Admin).
     * Mật khẩu mới phải đáp ứng BR-002.
     */
    @PatchMapping("/{userId}/password")
    public ResponseEntity<UserResponse> resetPassword(
            @PathVariable UUID userId,
            @Valid @RequestBody ResetUserPasswordRequest request) {
        return ResponseEntity.ok(adminUserService.resetPassword(userId, request));
    }

    // ADDED FOR BR-063
    @PostMapping("/{userId}/subscription")
    public ResponseEntity<UserResponse> grantSubscription(
            @PathVariable UUID userId,
            @Valid @RequestBody GrantSubscriptionRequest request) {
        return ResponseEntity.ok(adminUserService.grantSubscription(userId, request));
    }
}
