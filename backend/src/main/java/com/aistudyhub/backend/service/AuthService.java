package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.AuthResponse;
import com.aistudyhub.backend.dto.LoginRequest;
import com.aistudyhub.backend.dto.RegisterRequest;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.security.JwtService;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final int maxLoginAttempts;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            @Value("${app.auth.max-login-attempts}") int maxLoginAttempts) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.maxLoginAttempts = maxLoginAttempts;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String displayName = request.getDisplayName().trim();

        if (displayName.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tên hiển thị không được để trống.");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email này đã được đăng ký.");
        }

        PasswordPolicyValidator.validate(request.getPassword());

        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setDisplayName(displayName);
        user.setRole(User.Role.user);
        user.setLocked(false);
        user.setLoginAttempts((short) 0);
        user.setStorageLimitBytes(536870912L);
        user.setStorageUsedBytes(0L);
        user.setLanguagePreference(User.LanguagePreference.vi);
        user.setThemePreference(User.ThemePreference.light);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);

        UserResponse userResponse = UserResponse.from(user);
        String token = jwtService.generateToken(user.getId(), user.getEmail(), userResponse.getRole());
        return new AuthResponse(token, userResponse);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Email không tồn tại trong hệ thống."));

        if (user.isLocked()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Tài khoản đã bị khóa. Liên hệ Admin.");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            short attempts = (short) (user.getLoginAttempts() + 1);
            user.setLoginAttempts(attempts);
            if (attempts >= maxLoginAttempts) {
                user.setLocked(true);
            }
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Sai mật khẩu.");
        }

        user.setLoginAttempts((short) 0);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        UserResponse userResponse = UserResponse.from(user);
        String token = jwtService.generateToken(user.getId(), user.getEmail(), userResponse.getRole());
        return new AuthResponse(token, userResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        User user = getAuthenticatedUser();
        return UserResponse.from(user);
    }

    public void logout() {
        SecurityContextHolder.clearContext();
    }

    private User getAuthenticatedUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof AuthUserPrincipal authPrincipal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ.");
        }
        return userRepository.findById(authPrincipal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
    }
}
