package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.SubscriptionPlanResponse;
import com.aistudyhub.backend.dto.UpdatePackagePriceRequest;
import com.aistudyhub.backend.dto.UpdatePlanRequest;
import com.aistudyhub.backend.service.AdminSecurityService;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/subscription-plans")
public class AdminSubscriptionPlanController {

    private final AdminSubscriptionPlanService adminSubscriptionPlanService;
    private final AdminSecurityService adminSecurityService;

    public AdminSubscriptionPlanController(
            AdminSubscriptionPlanService adminSubscriptionPlanService,
            AdminSecurityService adminSecurityService) {
        this.adminSubscriptionPlanService = adminSubscriptionPlanService;
        this.adminSecurityService = adminSecurityService;
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
        adminSecurityService.verifyAdminPassword(request.getAdminPassword());
        return ResponseEntity.ok(adminSubscriptionPlanService.createPlan(request));
    }

    @PutMapping("/{planName}")
    @PreAuthorize("hasRole('admin')")
    public ResponseEntity<SubscriptionPlanResponse> updatePlan(
            @PathVariable String planName,
            @Valid @RequestBody UpdatePlanRequest request) {
        adminSecurityService.verifyAdminPassword(request.getAdminPassword());
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePlan(planName, request));
    }

    @DeleteMapping("/{planName}")
    @PreAuthorize("hasRole('admin')")
    public ResponseEntity<Void> deletePlan(
            @PathVariable String planName,
            @RequestHeader("X-Admin-Password") String adminPassword) {
        adminSecurityService.verifyAdminPassword(adminPassword);
        adminSubscriptionPlanService.deletePlan(planName);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{planName}/price")
    @PreAuthorize("hasRole('admin')")
    public ResponseEntity<SubscriptionPlanResponse> updatePrice(
            @PathVariable String planName,
            @Valid @RequestBody UpdatePackagePriceRequest request) {
        adminSecurityService.verifyAdminPassword(request.getAdminPassword());
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePrice(planName, request));
    }
}
