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

    List<Subscription> findAllByUserIdAndStatus(UUID userId, SubscriptionStatus status);

    boolean existsByUserIdAndStatusAndEndDateAfter(UUID userId, SubscriptionStatus status, LocalDateTime dateTime);

    /** SUB-201/SUB-302: đếm số User đang thực sự dùng gói này (còn hiệu lực), dùng cho cảnh báo trước khi xoá/sửa gói. */
    long countByPlanIdAndStatusAndEndDateAfter(Integer planId, SubscriptionStatus status, LocalDateTime endDate);
}
