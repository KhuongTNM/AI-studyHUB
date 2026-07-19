package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Subscription;
import com.aistudyhub.backend.entity.SubscriptionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionRepository extends JpaRepository<Subscription, UUID> {

    Optional<Subscription> findFirstByUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByCreatedAtDesc(
            UUID userId, SubscriptionStatus status, LocalDateTime now1, LocalDateTime now2);

    boolean existsByPlanIdAndStatus(Integer planId, SubscriptionStatus status);
    
    List<Subscription> findAllByUserIdAndStatus(UUID userId, SubscriptionStatus status);
    
    boolean existsByUserIdAndStatusAndEndDateAfter(UUID userId, SubscriptionStatus status, LocalDateTime dateTime);
}
