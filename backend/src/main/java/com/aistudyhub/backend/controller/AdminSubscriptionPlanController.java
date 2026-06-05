package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.SubscriptionPlanResponse;
import com.aistudyhub.backend.dto.UpdatePackagePriceRequest;
import com.aistudyhub.backend.service.AdminSubscriptionPlanService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/subscription-plans")
public class AdminSubscriptionPlanController {

    private final AdminSubscriptionPlanService adminSubscriptionPlanService;

    public AdminSubscriptionPlanController(AdminSubscriptionPlanService adminSubscriptionPlanService) {
        this.adminSubscriptionPlanService = adminSubscriptionPlanService;
    }

    @GetMapping
    public ResponseEntity<List<SubscriptionPlanResponse>> getPlans() {
        return ResponseEntity.ok(adminSubscriptionPlanService.getPlans());
    }

    @PatchMapping("/{planName}/price")
    public ResponseEntity<SubscriptionPlanResponse> updatePrice(
            @PathVariable String planName,
            @Valid @RequestBody UpdatePackagePriceRequest request) {
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePrice(planName, request));
    }
}
