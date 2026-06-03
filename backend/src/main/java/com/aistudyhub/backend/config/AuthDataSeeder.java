package com.aistudyhub.backend.config;

import com.aistudyhub.backend.entity.User;
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
    private final PasswordEncoder passwordEncoder;

    public AuthDataSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (userRepository.count() > 0) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        List<SeedUser> seeds = List.of(
                new SeedUser("admin@aistudyhub.com", "Admin123", "Admin System", User.Role.admin, 5L * 1024 * 1024 * 1024),
                new SeedUser("subadmin@aistudyhub.com", "SubAdmin123", "Sub Admin", User.Role.sub_admin, 1024L * 1024 * 1024),
                new SeedUser("student@aistudyhub.com", "Student123", "Demo Student", User.Role.user, 512L * 1024 * 1024));

        for (SeedUser seed : seeds) {
            User user = new User();
            user.setId(UUID.randomUUID());
            user.setEmail(seed.email());
            user.setPasswordHash(passwordEncoder.encode(seed.password()));
            user.setDisplayName(seed.displayName());
            user.setRole(seed.role());
            user.setLocked(false);
            user.setLoginAttempts((short) 0);
            user.setStorageLimitBytes(seed.storageLimitBytes());
            user.setStorageUsedBytes(0L);
            user.setCreatedAt(now);
            user.setUpdatedAt(now);
            userRepository.save(user);
        }
    }

    private record SeedUser(String email, String password, String displayName, User.Role role, long storageLimitBytes) {}
}
