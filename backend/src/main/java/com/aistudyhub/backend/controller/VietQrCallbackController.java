package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.VietQrTransactionSyncRequest;
import com.aistudyhub.backend.dto.VietQrTransactionSyncResponse;
import com.aistudyhub.backend.service.SubscriptionPurchaseService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/bank/api")
public class VietQrCallbackController {

    private final SubscriptionPurchaseService subscriptionPurchaseService;

    public VietQrCallbackController(SubscriptionPurchaseService subscriptionPurchaseService) {
        this.subscriptionPurchaseService = subscriptionPurchaseService;
    }

    @PostMapping("/transaction-sync")
    public ResponseEntity<VietQrTransactionSyncResponse> transactionSync(
            @RequestBody VietQrTransactionSyncRequest request) {
        VietQrTransactionSyncResponse response = subscriptionPurchaseService.syncVietQrTransaction(request);
        return ResponseEntity.status(response.isError() ? 400 : 200).body(response);
    }
}
