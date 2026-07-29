package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.AdminTransactionItemResponse;
import com.aistudyhub.backend.dto.TransactionDetailResponse;
import com.aistudyhub.backend.entity.SubscriptionPurchase;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPurchaseRepository;
import com.aistudyhub.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** TXN-201..203 (Admin/Sub-Admin) — Lịch sử Giao dịch toàn hệ thống. */
@Service
@RequiredArgsConstructor
public class AdminTransactionService {

    private final SubscriptionPurchaseRepository purchaseRepository;
    private final UserRepository userRepository;

    // ───────────────────────────────────────────────
    // TXN-201/202 — GET /api/admin/transactions
    // ───────────────────────────────────────────────
    @Transactional(readOnly = true)
    public Page<AdminTransactionItemResponse> getTransactions(int page, int size, Integer month, Integer year, String keyword) {
        TransactionQueryValidation.validatePage(page);
        int clampedSize = TransactionQueryValidation.clampSize(size);
        LocalDateTime[] range = TransactionQueryValidation.resolveDateRange(month, year);
        String normalizedKeyword = TransactionQueryValidation.normalizeKeyword(keyword);

        Pageable pageable = PageRequest.of(page, clampedSize, Sort.by(Sort.Direction.DESC, "paidAt"));
        return purchaseRepository.searchAdminTransactions(
                SubscriptionPurchase.Status.PAID, range[0], range[1], normalizedKeyword, pageable);
    }

    // ───────────────────────────────────────────────
    // TXN-203 — GET /api/admin/transactions/{orderId}
    // Không check ownership: Admin/Sub-Admin xem được chi tiết bất kỳ giao dịch nào.
    // ───────────────────────────────────────────────
    @Transactional(readOnly = true)
    public TransactionDetailResponse getTransactionDetail(String orderId) {
        SubscriptionPurchase purchase = purchaseRepository.findByOrderId(orderId)
                .filter(p -> p.getStatus() == SubscriptionPurchase.Status.PAID)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy giao dịch."));

        User user = userRepository.findById(purchase.getUserId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy giao dịch."));

        return TransactionDetailResponse.from(purchase, user.getDisplayName());
    }
}
