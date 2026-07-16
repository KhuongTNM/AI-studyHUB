package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.SubscriptionPlanResponse;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/subscription-plans")
public class SubscriptionPlanController {

    private final SubscriptionPlanRepository subscriptionPlanRepository;

    public SubscriptionPlanController(SubscriptionPlanRepository subscriptionPlanRepository) {
        this.subscriptionPlanRepository = subscriptionPlanRepository;
    }

    @GetMapping
    public ResponseEntity<List<SubscriptionPlanResponse>> getPlans() {
        return ResponseEntity.ok(subscriptionPlanRepository.findAllByIsDeletedFalse().stream()
                .map(SubscriptionPlanResponse::from)
                .toList());
    }

    @GetMapping("/{planName}")
    public ResponseEntity<SubscriptionPlanResponse> getPlanDetail(@PathVariable String planName) {
        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));
        
        if (plan.isDeleted()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ.");
        }
        
        return ResponseEntity.ok(SubscriptionPlanResponse.from(plan));
    }
}
