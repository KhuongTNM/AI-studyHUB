package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.SubscriptionPlanResponse;
import com.aistudyhub.backend.dto.UpdatePackagePriceRequest;
import com.aistudyhub.backend.service.AdminSubscriptionPlanService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;

/**
 * Controller cho các thao tác quản trị Subscription Plan.
 * LƯU Ý (BREAKING CHANGE): Tất cả các endpoint thay đổi dữ liệu (POST, PUT, PATCH, DELETE)
 * hiện yêu cầu phải có xác thực mật khẩu admin.
 * - POST/PUT/PATCH: Truyền `adminPassword` trong Request Body.
 * - DELETE: Truyền qua custom header `X-Admin-Password`.
 */
@RestController
@RequestMapping("/api/admin/subscription-plans")
public class AdminSubscriptionPlanController {

    private final AdminSubscriptionPlanService adminSubscriptionPlanService;

    public AdminSubscriptionPlanController(AdminSubscriptionPlanService adminSubscriptionPlanService) {
        this.adminSubscriptionPlanService = adminSubscriptionPlanService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('admin', 'sub_admin')")
    public ResponseEntity<List<SubscriptionPlanResponse>> getPlans() {
        return ResponseEntity.ok(adminSubscriptionPlanService.getPlans());
    }

    @PostMapping
    @PreAuthorize("hasRole('admin')")
    public ResponseEntity<SubscriptionPlanResponse> createPlan(
            @Valid @RequestBody com.aistudyhub.backend.dto.CreateSubscriptionPlanRequest request) {
        return ResponseEntity.ok(adminSubscriptionPlanService.createPlan(request));
    }

    @PutMapping("/{planName}")
    @PreAuthorize("hasRole('admin')")
    public ResponseEntity<SubscriptionPlanResponse> updatePlan(
            @PathVariable String planName,
            @Valid @RequestBody com.aistudyhub.backend.dto.UpdateSubscriptionPlanRequest request) {
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePlan(planName, request));
    }

    @DeleteMapping("/{planName}")
    @PreAuthorize("hasRole('admin')")
    public ResponseEntity<Void> deletePlan(
            @PathVariable String planName,
            @RequestHeader("X-Admin-Password") String adminPassword) {
        adminSubscriptionPlanService.deletePlan(planName, adminPassword);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{planName}/price")
    @PreAuthorize("hasRole('admin')")
    public ResponseEntity<SubscriptionPlanResponse> updatePrice(
            @PathVariable String planName,
            @Valid @RequestBody UpdatePackagePriceRequest request) {
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePrice(planName, request));
    }
}
