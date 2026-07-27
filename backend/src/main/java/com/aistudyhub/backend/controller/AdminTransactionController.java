package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.AdminTransactionItemResponse;
import com.aistudyhub.backend.dto.TransactionDetailResponse;
import com.aistudyhub.backend.service.AdminTransactionService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Controller Lịch sử Giao dịch phía Admin/Sub-Admin (TXN-201 -> TXN-203).
 * RBAC: chặn ở filter-level tại SecurityConfig (.requestMatchers("/api/admin/**")
 * .hasAnyRole("ADMIN","SUB_ADMIN")) + @PreAuthorize theo đúng convention hiện tại của các
 * Admin Controller khác (defense-in-depth). Cả 2 role xem được như nhau cho riêng chức năng XEM.
 */
@RestController
@RequestMapping("/api/admin/transactions")
public class AdminTransactionController {

    private final AdminTransactionService adminTransactionService;

    public AdminTransactionController(AdminTransactionService adminTransactionService) {
        this.adminTransactionService = adminTransactionService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUB_ADMIN')")
    public ResponseEntity<Page<AdminTransactionItemResponse>> getTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(adminTransactionService.getTransactions(page, size, month, year, keyword));
    }

    @GetMapping("/{orderId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SUB_ADMIN')")
    public ResponseEntity<TransactionDetailResponse> getTransactionDetail(@PathVariable String orderId) {
        return ResponseEntity.ok(adminTransactionService.getTransactionDetail(orderId));
    }
}
