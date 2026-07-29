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
                        applyPlanSnapshot(virtualSub, plan);
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
        applyPlanSnapshot(virtualSub, freePlan);
        return virtualSub;
    }

    /**
     * SUB-301: chốt (snapshot) toàn bộ hạn mức của plan vào đúng thời điểm gói được kích hoạt/
     * dựng lên cho User, để về sau Admin sửa gói không hồi tố lại các Subscription đã tồn tại.
     */
    private void applyPlanSnapshot(Subscription sub, SubscriptionPlan plan) {
        sub.setPlanNameSnapshot(plan.getName());
        sub.setDailyAiChatLimitSnapshot(plan.getDailyAiChatLimit());
        sub.setMaxFlashcardsSnapshot(plan.getMaxFlashcards());
        sub.setDailyMaxFlashcardsSnapshot(plan.getDailyMaxFlashcards());
        sub.setCreateGroupLimitSnapshot(plan.getCreateGroupLimit());
        sub.setJoinGroupLimitSnapshot(plan.getJoinGroupLimit());
        sub.setMaxRoomMembersSnapshot(plan.getMaxRoomMembers());
        sub.setStorageBytesSnapshot(plan.getDefaultStorageBytes());
    }

    /**
     * Đánh dấu mọi Subscription đang ACTIVE của User thành SUPERSEDED, không tạo bản ghi mới.
     * Dùng khi Admin hạ cấp User về Free (grantSubscription) — Free không có bản ghi giao dịch
     * riêng (GAP-T1), nhưng vẫn PHẢI kết thúc bản ghi trả phí cũ, nếu không
     * getActiveSubscriptionOrDefault() sẽ tiếp tục thấy bản ghi cũ còn ACTIVE + chưa hết hạn và
     * trả về gói đó thay vì Free, bỏ qua quyết định hạ cấp của Admin.
     */
    @Transactional
    public void supersedeActiveSubscriptions(UUID userId) {
        List<Subscription> activeSubs = subscriptionRepository.findAllByUserIdAndStatus(userId, SubscriptionStatus.ACTIVE);
        for (Subscription sub : activeSubs) {
            sub.setStatus(SubscriptionStatus.SUPERSEDED);
            sub.setUpdatedAt(LocalDateTime.now());
        }
        if (!activeSubs.isEmpty()) {
            subscriptionRepository.saveAll(activeSubs);
        }
    }

    /**
     * Kích hoạt một subscription mới và đánh dấu các subscription ACTIVE cũ thành SUPERSEDED.
     */
    @Transactional
    public void activateNewSubscription(UUID userId, SubscriptionPlan plan, LocalDateTime startDate, LocalDateTime endDate) {
        supersedeActiveSubscriptions(userId);

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
        applyPlanSnapshot(newSub, plan);

        subscriptionRepository.save(newSub);
    }
}
