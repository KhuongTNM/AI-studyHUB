package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.*;
import com.aistudyhub.backend.service.AdminSubscriptionPlanService;
import com.aistudyhub.backend.service.AdminSecurityService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller cho các thao tác quản trị Subscription Plan.
 * LƯU Ý: Tất cả các endpoint thay đổi dữ liệu (POST, PUT, PATCH, DELETE)
 * hiện yêu cầu phải có xác thực mật khẩu admin.
 */
@RestController
@RequestMapping("/api/admin/subscription-plans")
public class AdminSubscriptionPlanController {

    private final AdminSubscriptionPlanService adminSubscriptionPlanService;
    private final AdminSecurityService adminSecurityService;

    public AdminSubscriptionPlanController(AdminSubscriptionPlanService adminSubscriptionPlanService,
                                           AdminSecurityService adminSecurityService) {
        this.adminSubscriptionPlanService = adminSubscriptionPlanService;
        this.adminSecurityService = adminSecurityService;
    }

    @PostMapping
    public ResponseEntity<SubscriptionPlanResponse> createPlan(
            @Valid @RequestBody CreateSubscriptionPlanRequest request) {
        adminSecurityService.verifyAdminPassword(request.getAdminPassword());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminSubscriptionPlanService.createPlan(request));
    }

    @PutMapping("/{planName}")
    public ResponseEntity<SubscriptionPlanResponse> updatePlan(
            @PathVariable String planName,
            @Valid @RequestBody UpdatePlanRequest request) {
        adminSecurityService.verifyAdminPassword(request.getAdminPassword());
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePlan(planName, request));
    }

    @PatchMapping("/{planName}/price")
    public ResponseEntity<SubscriptionPlanResponse> updatePrice(
            @PathVariable String planName,
            @Valid @RequestBody UpdatePackagePriceRequest request) {
        adminSecurityService.verifyAdminPassword(request.getAdminPassword());
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePrice(planName, request));
    }

    @DeleteMapping("/{planName}")
    public ResponseEntity<Void> deletePlan(
            @PathVariable String planName,
            @RequestHeader("X-Admin-Password") String adminPassword) {
        adminSecurityService.verifyAdminPassword(adminPassword);
        adminSubscriptionPlanService.deletePlan(planName);
        return ResponseEntity.noContent().build();
    }
}
