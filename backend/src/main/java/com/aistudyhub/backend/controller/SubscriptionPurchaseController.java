package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.CreateSubscriptionPurchaseRequest;
import com.aistudyhub.backend.dto.SubscriptionPurchaseResponse;
import com.aistudyhub.backend.service.SubscriptionPurchaseService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/subscription-purchases")
public class SubscriptionPurchaseController {

    private final SubscriptionPurchaseService subscriptionPurchaseService;

    public SubscriptionPurchaseController(SubscriptionPurchaseService subscriptionPurchaseService) {
        this.subscriptionPurchaseService = subscriptionPurchaseService;
    }

    @PostMapping
    public ResponseEntity<SubscriptionPurchaseResponse> createPurchase(
            @Valid @RequestBody CreateSubscriptionPurchaseRequest request) {
        return ResponseEntity.ok(subscriptionPurchaseService.createPurchase(request));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<SubscriptionPurchaseResponse> getPurchase(@PathVariable String orderId) {
        return subscriptionPurchaseService.getPurchase(orderId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{orderId}/dev-complete")
    public ResponseEntity<SubscriptionPurchaseResponse> completeForDev(@PathVariable String orderId) {
        return ResponseEntity.ok(subscriptionPurchaseService.completePurchaseForDev(orderId));
    }
}
