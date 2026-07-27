package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.SubscriptionSnapshotResponse;
import com.aistudyhub.backend.entity.Subscription;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.SubscriptionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** SUB-202 — gói/hạn mức hiện tại của chính User đang đăng nhập. */
@RestController
@RequestMapping("/api/subscriptions")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping("/me")
    public ResponseEntity<SubscriptionSnapshotResponse> getMySubscription(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(principal.getId());
        return ResponseEntity.ok(SubscriptionSnapshotResponse.from(activeSub));
    }
}
