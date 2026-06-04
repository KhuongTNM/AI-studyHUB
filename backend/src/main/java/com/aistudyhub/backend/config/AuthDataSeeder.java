package com.aistudyhub.backend.config;

import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AuthDataSeeder implements ApplicationRunner {

    private final UserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthDataSeeder(
            UserRepository userRepository,
            SubscriptionPlanRepository subscriptionPlanRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        SubscriptionPlan freePlan = subscriptionPlanRepository.findByName(SubscriptionPlan.FREE_PLAN_NAME)
                .orElseThrow(() -> new IllegalStateException("Free subscription plan is not configured."));
        List<SeedUser> seeds = List.of(
                new SeedUser("admin@aistudyhub.com", "Admin123", "Admin System", User.Role.admin),
                new SeedUser("subadmin@aistudyhub.com", "SubAdmin123", "Sub Admin", User.Role.sub_admin),
                new SeedUser("student@aistudyhub.com", "Student123", "Demo Student", User.Role.user));

        for (SeedUser seed : seeds) {
            User user = new User();
            user.setId(UUID.randomUUID());
            user.setEmail(seed.email());
            user.setPasswordHash(passwordEncoder.encode(seed.password()));
            user.setDisplayName(seed.displayName());
            user.setRole(seed.role());
            user.setLocked(false);
            user.setLoginAttempts((short) 0);
            user.setStorageLimitBytes(freePlan.getDefaultStorageBytes());
            user.setStorageUsedBytes(0L);
            user.setSubscriptionPlanId(freePlan.getId());
            user.setSubscriptionExpiresAt(null);
            user.setCreatedAt(now);
            user.setUpdatedAt(now);
            userRepository.save(user);
        }
    }

    private record SeedUser(String email, String password, String displayName, User.Role role) {}
}
