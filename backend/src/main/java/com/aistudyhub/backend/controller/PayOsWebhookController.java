package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.service.SubscriptionPurchaseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/payos")
public class PayOsWebhookController {

    private final SubscriptionPurchaseService subscriptionPurchaseService;

    public PayOsWebhookController(SubscriptionPurchaseService subscriptionPurchaseService) {
        this.subscriptionPurchaseService = subscriptionPurchaseService;
    }

    /**
     * PayOS gọi về endpoint này sau khi user chuyển khoản thành công.
     * QUAN TRỌNG: Luôn trả về HTTP 200 viên mãn để PayOS không retry vô tận.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Map<String, String>> handleWebhook(@RequestBody String body) {
        subscriptionPurchaseService.handleWebhook(body);
        return ResponseEntity.ok(Map.of("code", "00", "desc", "success"));
    }
}