package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.AuthResponse;
import com.aistudyhub.backend.dto.ChangePasswordRequest;
import com.aistudyhub.backend.dto.GoogleLoginRequest;
import com.aistudyhub.backend.dto.LoginRequest;
import com.aistudyhub.backend.dto.RegisterRequest;
import com.aistudyhub.backend.dto.UpdateLanguagePreferenceRequest;
import com.aistudyhub.backend.dto.UpdateProfileRequest;
import com.aistudyhub.backend.dto.UpdateThemePreferenceRequest;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.security.JwtService;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class AuthService {

    /** Endpoint Google dùng để xác thực ID Token. */
    private static final String GOOGLE_TOKENINFO_URL =
            "https://oauth2.googleapis.com/tokeninfo?id_token={idToken}";

    private final UserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final int maxLoginAttempts;
    private final RestTemplate restTemplate;
    private final String googleClientId;

    public AuthService(
            UserRepository userRepository,
            SubscriptionPlanRepository subscriptionPlanRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            @Value("${app.auth.max-login-attempts}") int maxLoginAttempts,
            RestTemplate restTemplate,
            @Value("${app.google.client-id}") String googleClientId) {
        this.userRepository = userRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.maxLoginAttempts = maxLoginAttempts;
        this.restTemplate = restTemplate;
        this.googleClientId = googleClientId;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        String displayName = request.getDisplayName().trim();

        if (displayName.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tên hiển thị không được để trống.");
        }
        // BR-006: xác nhận mật khẩu phải khớp hoàn toàn với mật khẩu gốc
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu xác nhận không trùng khớp.");
        }
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email này đã được đăng ký.");
        }

        PasswordPolicyValidator.validate(request.getPassword());
        SubscriptionPlan freePlan = getFreePlan();

        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setDisplayName(displayName);
        user.setRole(User.Role.user);
        user.setLocked(false);
        user.setLoginAttempts((short) 0);
        user.setStorageLimitBytes(freePlan.getDefaultStorageBytes());
        user.setStorageUsedBytes(0L);
        user.setSubscriptionPlanId(freePlan.getId());
        user.setSubscriptionExpiresAt(null);
        user.setLanguagePreference(User.LanguagePreference.vi);
        user.setThemePreference(User.ThemePreference.light);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);

        UserResponse userResponse = UserResponse.from(user);
        // FIX: dùng user.getRole().name() ("sub_admin") thay vì userResponse.getRole() ("sub-admin")
        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        AuthResponse response = new AuthResponse(token, userResponse);
        response.setPasswordStrength(PasswordPolicyValidator.calculateStrength(request.getPassword()));
        return response;
    }

    /**
     * FR-25: Đăng nhập bằng Google thông qua luồng ID Token.
     * Xác thực token với Google, tra cứu hoặc tạo mới user, sau đó cấp JWT nội bộ.
     */
    @Transactional
    @SuppressWarnings("unchecked")
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {

        // Bước 1: Gửi request đến Google để xác thực ID Token
        Map<String, Object> payload;
        try {
            payload = restTemplate.getForObject(
                    GOOGLE_TOKENINFO_URL,
                    Map.class,
                    request.getIdToken()
            );
        } catch (RestClientException e) {
            // Google trả về lỗi hoặc mất kết nối — token không hợp lệ hoặc đã hết hạn
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Tài khoản Google không hợp lệ hoặc đã hết hạn.");
        }

        // Bước 2a: Kiểm tra payload không null (trường hợp phòng thủ)
        if (payload == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Tài khoản Google không hợp lệ hoặc đã hết hạn.");
        }

        // Bước 2b: Kiểm tra claim "aud" — phải khớp với Client ID của ứng dụng
        String aud = String.valueOf(payload.getOrDefault("aud", ""));
        String iss = String.valueOf(payload.getOrDefault("iss", ""));
        if (!googleClientId.equals(aud)
                || (!iss.equals("https://accounts.google.com") && !iss.equals("accounts.google.com"))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Token không hợp lệ (Mã ứng dụng không trùng khớp).");
        }

        // Bước 2c: Kiểm tra email đã được Google xác minh chưa (hỗ trợ cả String lẫn Boolean)
        Object emailVerifiedRaw = payload.get("email_verified");
        boolean emailVerified = Boolean.TRUE.equals(emailVerifiedRaw)
                || "true".equalsIgnoreCase(String.valueOf(emailVerifiedRaw));
        if (!emailVerified) {
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Email Google chưa được xác minh.");
        }

        // Bước 3: Lấy thông tin user từ payload và chuẩn hóa email
        String email = String.valueOf(payload.getOrDefault("email", "")).trim().toLowerCase();
        String name  = String.valueOf(payload.getOrDefault("name", "")).trim();

        // Bước 3a: Tìm kiếm user trong CSDL theo email (không phân biệt hoa/thường)
        Optional<User> existingUser = userRepository.findByEmailIgnoreCase(email);

        User user;
        if (existingUser.isPresent()) {
            // Bước 3b: User đã tồn tại — kiểm tra trạng thái khóa tài khoản
            user = existingUser.get();
            if (user.isLocked()) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Tài khoản của bạn đã bị khóa.");
            }
        } else {
            // Bước 3c: User chưa tồn tại — tạo mới với cấu hình mặc định
            user = buildGoogleUser(email, name);
            userRepository.save(user);
        }

        // Bước 4: Sinh JWT nội bộ và trả kết quả về client
        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, UserResponse.from(user));
    }

    /**
     * Khởi tạo entity User mới từ thông tin Google.
     * Mật khẩu được mã hóa từ UUID ngẫu nhiên để thỏa mãn ràng buộc NOT NULL của DB
     * mà không cần migration thêm cột.
     */
    private User buildGoogleUser(String email, String name) {
        SubscriptionPlan freePlan = getFreePlan();
        LocalDateTime now = LocalDateTime.now();

        // Nếu Google không trả về trường "name", dùng phần trước "@" của email làm tên hiển thị
        String displayName = (name == null || name.isEmpty())
                ? email.substring(0, email.indexOf('@'))
                : name;

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        // Mật khẩu ngẫu nhiên — user đăng nhập Google sẽ không bao giờ dùng trường này
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setDisplayName(displayName);
        user.setRole(User.Role.user);
        user.setLocked(false);
        user.setLoginAttempts((short) 0);
        user.setStorageLimitBytes(freePlan.getDefaultStorageBytes());
        user.setStorageUsedBytes(0L);
        user.setSubscriptionPlanId(freePlan.getId());
        user.setSubscriptionExpiresAt(null);
        user.setLanguagePreference(User.LanguagePreference.vi);
        user.setThemePreference(User.ThemePreference.light);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return user;
    }

    private SubscriptionPlan getFreePlan() {
        return subscriptionPlanRepository.findByName(SubscriptionPlan.FREE_PLAN_NAME)
                .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Gói Free chưa được cấu hình."));
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
        // FIX: dùng user.getRole().name() ("sub_admin") thay vì userResponse.getRole() ("sub-admin")
        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, userResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        User user = getAuthenticatedUser();
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateLanguagePreference(UpdateLanguagePreferenceRequest request) {
        User user = getAuthenticatedUser();
        User.LanguagePreference languagePreference;
        try {
            languagePreference = User.LanguagePreference.valueOf(request.getLanguage());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Ngôn ngữ chỉ hỗ trợ vi hoặc en.");
        }
        user.setLanguagePreference(languagePreference);
        user.setUpdatedAt(LocalDateTime.now());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateThemePreference(UpdateThemePreferenceRequest request) {
        User user = getAuthenticatedUser();
        user.setThemePreference(parseThemePreference(request.getThemePreference()));
        user.setUpdatedAt(LocalDateTime.now());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public UserResponse updateProfile(UpdateProfileRequest request) {
        User user = getAuthenticatedUser();
        String displayName = request.getDisplayName().trim();
        if (displayName.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tên hiển thị không được để trống.");
        }
        user.setDisplayName(displayName);
        if (request.getThemePreference() != null && !request.getThemePreference().isBlank()) {
            user.setThemePreference(parseThemePreference(request.getThemePreference()));
        }
        user.setUpdatedAt(LocalDateTime.now());
        return UserResponse.from(userRepository.save(user));
    }

    private User.ThemePreference parseThemePreference(String themePreference) {
        try {
            return User.ThemePreference.valueOf(themePreference.trim().toLowerCase());
        } catch (IllegalArgumentException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giao diện chỉ hỗ trợ light hoặc dark.");
        }
    }

    @Transactional
    public Map<String, String> changePassword(ChangePasswordRequest request) {
        User user = getAuthenticatedUser();

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Mật khẩu cũ không đúng.");
        }

        PasswordPolicyValidator.validate(request.getNewPassword());

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        return Map.of("message", "Đổi mật khẩu thành công.");
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
