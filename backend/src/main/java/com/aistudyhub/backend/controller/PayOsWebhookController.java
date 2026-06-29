package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.service.SubscriptionPurchaseService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payos")
public class PayOsWebhookController {

    private final SubscriptionPurchaseService subscriptionPurchaseService;

    public PayOsWebhookController(SubscriptionPurchaseService subscriptionPurchaseService) {
        this.subscriptionPurchaseService = subscriptionPurchaseService;
    }

    /**
     * PayOS gọi về endpoint này sau khi user chuyển khoản (thành công hoặc thất bại).
     * QUAN TRỌNG: luôn trả về HTTP 200 để PayOS không retry vô tận — mọi lỗi xử lý
     * bên trong handleWebhook đều được catch và log, không throw ra ngoài.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Map<String, String>> handleWebhook(@RequestBody String body) {
        subscriptionPurchaseService.handleWebhook(body);
        return ResponseEntity.ok(Map.of("code", "00", "desc", "success"));
    }
}