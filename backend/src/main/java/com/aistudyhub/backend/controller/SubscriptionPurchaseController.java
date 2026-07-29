package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.CreateSubscriptionPurchaseRequest;
import com.aistudyhub.backend.dto.SubscriptionPurchaseResponse;
import com.aistudyhub.backend.dto.TransactionDetailResponse;
import com.aistudyhub.backend.dto.TransactionHistoryItemResponse;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.SubscriptionPurchaseService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    // TXN-101/102 — danh sách Lịch sử Giao dịch của chính User đang đăng nhập.
    @GetMapping("/history")
    public ResponseEntity<Page<TransactionHistoryItemResponse>> getHistory(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year) {
        return ResponseEntity.ok(subscriptionPurchaseService.getHistory(principal.getId(), page, size, month, year));
    }

    // TXN-103 — chi tiết 1 giao dịch (Popup), bắt buộc kiểm tra ownership (GAP-2).
    @GetMapping("/history/{orderId}")
    public ResponseEntity<TransactionDetailResponse> getHistoryDetail(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable String orderId) {
        return ResponseEntity.ok(subscriptionPurchaseService.getHistoryDetail(principal.getId(), orderId));
    }
}
