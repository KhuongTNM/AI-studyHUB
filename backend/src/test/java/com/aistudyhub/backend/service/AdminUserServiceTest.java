package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.repository.ActivityLogRepository;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

import com.aistudyhub.backend.exception.ApiException;

@ExtendWith(MockitoExtension.class)
public class AdminUserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private SubscriptionPlanRepository subscriptionPlanRepository;

    @Mock
    private ActivityLogRepository activityLogRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private DocumentRepository documentRepository;

    @InjectMocks
    private AdminUserService adminUserService;

    @BeforeEach
    void setUp() {
        // Setup Security Context
        User adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setEmail("admin@example.com");
        adminUser.setPasswordHash("hash");
        adminUser.setRole(User.Role.admin);
        AuthUserPrincipal principal = new AuthUserPrincipal(adminUser);
        Authentication authentication = mock(Authentication.class);
        when(authentication.getPrincipal()).thenReturn(principal);
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);
        
        when(userRepository.findById(principal.getId())).thenReturn(Optional.of(adminUser));
    }

    @Test
    void testGetUsers_ShouldOnlyReturnNonDeletedUsers() {
        // Arrange
        User user1 = new User();
        user1.setId(UUID.randomUUID());
        user1.setEmail("user1@example.com");

        User user2 = new User();
        user2.setId(UUID.randomUUID());
        user2.setEmail("user2@example.com");

        when(userRepository.findByDeletedAtIsNullOrderByCreatedAtDesc())
                .thenReturn(Arrays.asList(user1, user2));

        // Act
        List<UserResponse> responses = adminUserService.getUsers();

        // Assert
        assertEquals(2, responses.size());
        assertEquals("user1@example.com", responses.get(0).getEmail());
        assertEquals("user2@example.com", responses.get(1).getEmail());
        
        verify(userRepository, times(1)).findByDeletedAtIsNullOrderByCreatedAtDesc();
    }

    @Test
    void testDeleteUser_ShouldSoftDelete() {
        // Arrange
        UUID targetUserId = UUID.randomUUID();
        User targetUser = new User();
        targetUser.setId(targetUserId);
        targetUser.setRole(User.Role.user);

        when(userRepository.findById(targetUserId)).thenReturn(Optional.of(targetUser));
        when(passwordEncoder.matches("Admin123", "hash")).thenReturn(true);

        // Act
        adminUserService.deleteUser(targetUserId, "Admin123");

        // Assert
        verify(userRepository, times(1)).save(targetUser);
        verify(documentRepository, times(1)).softDeleteByUserId(eq(targetUserId), any());
    }
}
