package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.SubscriptionPurchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SubscriptionPurchaseRepository extends JpaRepository<SubscriptionPurchase, Long> {

    Optional<SubscriptionPurchase> findByOrderId(String orderId);

    Optional<SubscriptionPurchase> findByOrderCode(Long orderCode);

    boolean existsByOrderId(String orderId);
}