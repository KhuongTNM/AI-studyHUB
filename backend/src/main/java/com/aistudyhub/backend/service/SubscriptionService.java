package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.Subscription;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.SubscriptionStatus;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.SystemConfigurationException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.SubscriptionRepository;
import com.aistudyhub.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserRepository userRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository,
                               SubscriptionPlanRepository subscriptionPlanRepository,
                               UserRepository userRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.userRepository = userRepository;
    }

    /**
     * Lấy Subscription Active hiện tại của User. Nếu không có, fallback về gói Free ảo.
     * Tự động kiểm tra, cập nhật trạng thái EXPIRED và đồng bộ về core.users nếu gói cước hết hạn.
     */
    @Transactional
    public Subscription getActiveSubscriptionOrDefault(UUID userId) {
        LocalDateTime now = LocalDateTime.now();
        // 1. Check if there is an active subscription record in the database.
        Optional<Subscription> activeSubOpt = subscriptionRepository.findFirstByUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByCreatedAtDesc(
                userId, SubscriptionStatus.ACTIVE, now, now);
        if (activeSubOpt.isPresent()) {
            return activeSubOpt.get();
        }

        // 2. If no active record, check if there are any ACTIVE subscription records that have expired (endDate < now)
        // and need to be marked as EXPIRED and synced to the user.
        List<Subscription> activeSubs = subscriptionRepository.findAllByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);
        boolean expiredAny = false;
        for (Subscription sub : activeSubs) {
            if (sub.getEndDate().isBefore(now)) {
                sub.setStatus(SubscriptionStatus.EXPIRED);
                sub.setUpdatedAt(now);
                subscriptionRepository.save(sub);
                expiredAny = true;
            }
        }

        if (expiredAny) {
            // Reset the user's fields to Free plan
            userRepository.findById(userId).ifPresent(user -> {
                boolean hasNewerActiveSub = subscriptionRepository.existsByUserIdAndStatusAndEndDateAfter(
                        userId, SubscriptionStatus.ACTIVE, now);
                if (!hasNewerActiveSub) {
                    SubscriptionPlan freePlan = subscriptionPlanRepository.findByNameIgnoreCase(SubscriptionPlan.FREE_PLAN_NAME)
                            .orElseThrow(() -> new SystemConfigurationException("Hệ thống chưa được cấu hình gói Free mặc định."));
                    user.setSubscriptionPlanId(freePlan.getId());
                    user.setSubscriptionExpiresAt(null);
                    user.setStorageLimitBytes(freePlan.getDefaultStorageBytes());
                    userRepository.save(user);
                }
            });
        }

        // 3. Check if the user has an active legacy subscription plan set in core.users (legacy/seed data fallback)
        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getSubscriptionPlanId() != null && user.getSubscriptionExpiresAt() != null) {
                if (user.getSubscriptionExpiresAt().isAfter(now)) {
                    // Return a virtual subscription matching the user's plan in core.users
                    Optional<SubscriptionPlan> planOpt = subscriptionPlanRepository.findById(user.getSubscriptionPlanId());
                    if (planOpt.isPresent()) {
                        SubscriptionPlan plan = planOpt.get();
                        Subscription virtualSub = new Subscription();
                        virtualSub.setUserId(userId);
                        virtualSub.setPlanId(plan.getId());
                        virtualSub.setStatus(SubscriptionStatus.ACTIVE);
                        virtualSub.setStartDate(user.getCreatedAt() != null ? user.getCreatedAt() : now);
                        virtualSub.setEndDate(user.getSubscriptionExpiresAt());
                        virtualSub.setPricePaid(plan.getPrice());
                        return virtualSub;
                    }
                } else {
                    // Legacy plan is expired! Sync back to free plan immediately.
                    SubscriptionPlan freePlan = subscriptionPlanRepository.findByNameIgnoreCase(SubscriptionPlan.FREE_PLAN_NAME)
                            .orElseThrow(() -> new SystemConfigurationException("Hệ thống chưa được cấu hình gói Free mặc định."));
                    if (!freePlan.getId().equals(user.getSubscriptionPlanId())) {
                        user.setSubscriptionPlanId(freePlan.getId());
                        user.setSubscriptionExpiresAt(null);
                        user.setStorageLimitBytes(freePlan.getDefaultStorageBytes());
                        userRepository.save(user);
                    }
                }
            }
        }

        // 4. Fallback to free package
        return getVirtualFreeSubscription(userId);
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
