package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.Subscription;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.SubscriptionStatus;
import com.aistudyhub.backend.exception.SystemConfigurationException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.SubscriptionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository,
                               SubscriptionPlanRepository subscriptionPlanRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
    }

    /**
     * Lấy Subscription Active hiện tại của User. Nếu không có, fallback về gói Free ảo.
     */
    @Transactional(readOnly = true)
    public Subscription getActiveSubscriptionOrDefault(UUID userId) {
        LocalDateTime now = LocalDateTime.now();
        return subscriptionRepository.findFirstByUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByCreatedAtDesc(
                userId, SubscriptionStatus.ACTIVE, now, now)
                .orElseGet(() -> getVirtualFreeSubscription(userId));
    }

    /**
     * Tạo một Subscription Ảo từ gói Free trong DB nếu user chưa có gói nào.
     */
    private Subscription getVirtualFreeSubscription(UUID userId) {
        SubscriptionPlan freePlan = subscriptionPlanRepository.findByNameIgnoreCase(SubscriptionPlan.FREE_PLAN_NAME)
                .orElseThrow(() -> new SystemConfigurationException("Hệ thống chưa được cấu hình gói Free mặc định."));

        Subscription virtualSub = new Subscription();
        virtualSub.setUserId(userId);
        virtualSub.setPlanId(freePlan.getId());
        virtualSub.setStatus(SubscriptionStatus.ACTIVE);
        virtualSub.setStartDate(LocalDateTime.now());
        virtualSub.setEndDate(LocalDateTime.now().plusYears(100)); // Hạn vĩnh viễn
        virtualSub.setPricePaid(freePlan.getPrice());
        return virtualSub;
    }

    /**
     * Kích hoạt một subscription mới và đánh dấu các subscription ACTIVE cũ thành SUPERSEDED.
     */
    @Transactional
    public void activateNewSubscription(UUID userId, SubscriptionPlan plan, LocalDateTime startDate, LocalDateTime endDate) {
        // Cập nhật các gói cũ thành SUPERSEDED
        List<Subscription> activeSubs = subscriptionRepository.findAllByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);
        for (Subscription sub : activeSubs) {
            sub.setStatus(SubscriptionStatus.SUPERSEDED);
            sub.setUpdatedAt(LocalDateTime.now());
        }
        if (!activeSubs.isEmpty()) {
            subscriptionRepository.saveAll(activeSubs);
        }

        // Tạo gói mới
        Subscription newSub = new Subscription();
        newSub.setUserId(userId);
        newSub.setPlanId(plan.getId());
        newSub.setStatus(SubscriptionStatus.ACTIVE);
        newSub.setStartDate(startDate);
        newSub.setEndDate(endDate);
        newSub.setPricePaid(plan.getPrice()); // Snapshot giá tại thời điểm kích hoạt
        newSub.setCreatedAt(LocalDateTime.now());
        newSub.setUpdatedAt(LocalDateTime.now());

        subscriptionRepository.save(newSub);
    }
}
