package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.SubscriptionPurchase;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubscriptionPurchaseRepository extends JpaRepository<SubscriptionPurchase, Long> {

    Optional<SubscriptionPurchase> findByOrderId(String orderId);

    Optional<SubscriptionPurchase> findByOrderCode(Long orderCode);

    boolean existsByOrderId(String orderId);
}