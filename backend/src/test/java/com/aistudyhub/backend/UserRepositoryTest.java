package com.aistudyhub.backend;

import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ActiveProfiles("test")
@org.springframework.test.context.jdbc.Sql(statements = "CREATE SCHEMA IF NOT EXISTS core;")
public class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    public void testFindByDeletedAtIsNullOrderByCreatedAtDesc() {
        // Arrange
        User activeUser = new User();
        activeUser.setId(UUID.randomUUID());
        activeUser.setEmail("active@example.com");
        activeUser.setPasswordHash("hash");
        activeUser.setDisplayName("Active");
        activeUser.setRole(User.Role.user);
        activeUser.setLocked(false);
        activeUser.setLoginAttempts((short) 0);
        activeUser.setStorageUsedBytes(0L);
        activeUser.setStorageLimitBytes(100L);
        activeUser.setSubscriptionPlanId(1);
        activeUser.setLanguagePreference(User.LanguagePreference.vi);
        activeUser.setThemePreference(User.ThemePreference.light);
        activeUser.setCreatedAt(LocalDateTime.now());
        activeUser.setUpdatedAt(LocalDateTime.now());

        User deletedUser = new User();
        deletedUser.setId(UUID.randomUUID());
        deletedUser.setEmail("deleted@example.com");
        deletedUser.setPasswordHash("hash");
        deletedUser.setDisplayName("Deleted");
        deletedUser.setRole(User.Role.user);
        deletedUser.setLocked(false);
        deletedUser.setLoginAttempts((short) 0);
        deletedUser.setStorageUsedBytes(0L);
        deletedUser.setStorageLimitBytes(100L);
        deletedUser.setSubscriptionPlanId(1);
        deletedUser.setLanguagePreference(User.LanguagePreference.vi);
        deletedUser.setThemePreference(User.ThemePreference.light);
        deletedUser.setCreatedAt(LocalDateTime.now().minusDays(1));
        deletedUser.setUpdatedAt(LocalDateTime.now());
        deletedUser.setDeletedAt(LocalDateTime.now()); // Soft deleted

        userRepository.save(activeUser);
        userRepository.save(deletedUser);

        // Act
        List<User> result = userRepository.findByDeletedAtIsNullOrderByCreatedAtDesc();

        // Assert
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getEmail()).isEqualTo("active@example.com");
    }
}
