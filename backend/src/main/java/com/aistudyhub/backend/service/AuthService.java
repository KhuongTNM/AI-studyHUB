package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.AuthResponse;
import com.aistudyhub.backend.dto.ChangePasswordRequest;
import com.aistudyhub.backend.dto.GoogleLoginRequest;
import com.aistudyhub.backend.dto.LoginRequest;
import com.aistudyhub.backend.dto.RegisterRequest;
import com.aistudyhub.backend.dto.ResendOtpRequest;
import com.aistudyhub.backend.dto.StorageUsageResponse;
import com.aistudyhub.backend.dto.UpdateLanguagePreferenceRequest;
import com.aistudyhub.backend.dto.UpdateProfileRequest;
import com.aistudyhub.backend.dto.UpdateThemePreferenceRequest;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.dto.VerifyOtpRequest;
import com.aistudyhub.backend.entity.EmailOtpToken;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.exception.BusinessException;
import com.aistudyhub.backend.exception.ErrorCode;
import com.aistudyhub.backend.repository.EmailOtpTokenRepository;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.security.JwtService;
import java.security.SecureRandom;
import java.time.Duration;
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

@Service
public class AuthService {

    // BR-095/096: mã OTP hết hạn sau 10 phút, tối đa 5 lần thử sai.
    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final int MAX_OTP_ATTEMPTS = 5;
    // BR-098: chỉ cho phép gửi lại OTP tối đa 1 lần mỗi 60 giây.
    private static final int OTP_RESEND_COOLDOWN_SECONDS = 60;
    private static final Map<String, String> OTP_RESEND_GENERIC_RESPONSE =
            Map.of("message", "Nếu email tồn tại, mã xác thực đã được gửi.");

    private static final SecureRandom OTP_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final EmailOtpTokenRepository emailOtpTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final int maxLoginAttempts;
    private final GoogleAuthService googleAuthService;

    public AuthService(
            UserRepository userRepository,
            SubscriptionPlanRepository subscriptionPlanRepository,
            EmailOtpTokenRepository emailOtpTokenRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailService emailService,
            @Value("${app.auth.max-login-attempts}") int maxLoginAttempts,
            GoogleAuthService googleAuthService) {
        this.userRepository = userRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.emailOtpTokenRepository = emailOtpTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailService = emailService;
        this.maxLoginAttempts = maxLoginAttempts;
        this.googleAuthService = googleAuthService;
    }

    @Transactional(rollbackFor = Exception.class)
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
        // BR-095: tài khoản đăng ký qua form luôn bắt đầu ở trạng thái chưa xác thực email.
        user.setEmailVerified(false);
        user.setStorageLimitBytes(freePlan.getDefaultStorageBytes());
        user.setStorageUsedBytes(0L);
        user.setSubscriptionPlanId(freePlan.getId());
        user.setSubscriptionExpiresAt(null);
        user.setLanguagePreference(User.LanguagePreference.vi);
        user.setThemePreference(User.ThemePreference.light);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        userRepository.save(user);

        // BR-095: sinh + gửi mã OTP ngay sau khi tạo user, trong cùng transaction.
        generateAndSendOtp(user);

        UserResponse userResponse = UserResponse.from(user);
        AuthResponse response = new AuthResponse(userResponse);
        response.setPasswordStrength(PasswordPolicyValidator.calculateStrength(request.getPassword()));
        response.setRequiresVerification(true);
        response.setOtpExpiresInSeconds(OTP_EXPIRY_MINUTES * 60);
        return response;
    }

    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {
        return googleAuthService.loginWithGoogle(request);
    }

    private SubscriptionPlan getFreePlan() {
        return subscriptionPlanRepository.findByNameIgnoreCase(SubscriptionPlan.FREE_PLAN_NAME)
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

        // BR-097: email/mật khẩu đúng nhưng chưa xác thực OTP -> chặn ngay, KHÔNG tăng loginAttempts
        // và KHÔNG khoá tài khoản dù thử lại bao nhiêu lần (khác cơ chế brute-force hiện tại).
        if (!user.isEmailVerified()) {
            throw new BusinessException(ErrorCode.ACCOUNT_NOT_VERIFIED, Map.of("email", user.getEmail()));
        }

        user.setLoginAttempts((short) 0);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        UserResponse userResponse = UserResponse.from(user);
        // FIX: dùng user.getRole().name() ("sub_admin") thay vì userResponse.getRole() ("sub-admin")
        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, userResponse);
    }

    /** BR-096: xác thực mã OTP người dùng nhập; thành công thì kích hoạt tài khoản và tự động đăng nhập. */
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse verifyOtp(VerifyOtpRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (user.isEmailVerified()) {
            throw new BusinessException(ErrorCode.EMAIL_ALREADY_VERIFIED);
        }

        EmailOtpToken token = emailOtpTokenRepository
                .findFirstByUserIdAndUsedFalseOrderByCreatedAtDesc(user.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.OTP_NOT_FOUND));

        if (LocalDateTime.now().isAfter(token.getExpiry())) {
            // REQUIRES_NEW: commit ngay, không để bị rollback theo throw OTP_EXPIRED bên dưới.
            emailOtpTokenRepository.markUsed(token.getId());
            throw new BusinessException(ErrorCode.OTP_EXPIRED);
        }

        if (token.getAttemptCount() >= MAX_OTP_ATTEMPTS) {
            throw new BusinessException(ErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED);
        }

        if (!passwordEncoder.matches(request.getOtpCode(), token.getOtpCodeHash())) {
            // REQUIRES_NEW: commit ngay số lượt thử sai, không để bị rollback theo throw bên dưới
            // (nếu chỉ save() trong transaction chính, verifyOtp() sẽ rollback toàn bộ vì kết thúc
            // bằng exception -> attemptCount không bao giờ thực sự tăng trong DB).
            emailOtpTokenRepository.incrementAttemptCount(token.getId());
            int attemptsRemaining = MAX_OTP_ATTEMPTS - (token.getAttemptCount() + 1);
            throw new BusinessException(ErrorCode.OTP_INVALID_CODE, Map.of("attemptsRemaining", attemptsRemaining));
        }

        token.setUsed(true);
        emailOtpTokenRepository.save(token);

        user.setEmailVerified(true);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        UserResponse userResponse = UserResponse.from(user);
        String jwt = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(jwt, userResponse);
    }

    /** BR-098: gửi lại mã OTP, chống spam (cooldown 60s) và chống dò email (user enumeration). */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, String> resendOtp(ResendOtpRequest request) {
        String email = request.getEmail().trim().toLowerCase();

        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(email);
        if (userOpt.isEmpty()) {
            return OTP_RESEND_GENERIC_RESPONSE;
        }

        User user = userOpt.get();
        if (user.isEmailVerified()) {
            // Không tiết lộ trạng thái tài khoản; cũng không gửi OTP thừa cho tài khoản đã xác thực.
            return OTP_RESEND_GENERIC_RESPONSE;
        }

        Optional<EmailOtpToken> latest = emailOtpTokenRepository.findFirstByUserIdOrderByCreatedAtDesc(user.getId());
        if (latest.isPresent()) {
            long secondsSinceLast = Duration.between(latest.get().getCreatedAt(), LocalDateTime.now()).getSeconds();
            if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
                long retryAfterSeconds = OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast;
                throw new BusinessException(ErrorCode.OTP_RESEND_COOLDOWN,
                        Map.of("retryAfterSeconds", retryAfterSeconds));
            }
        }

        generateAndSendOtp(user);
        return OTP_RESEND_GENERIC_RESPONSE;
    }

    /** BR-095/098: vô hiệu hoá OTP cũ, sinh mã 6 số mới, hash + lưu, rồi gửi email bất đồng bộ. */
    private void generateAndSendOtp(User user) {
        emailOtpTokenRepository.invalidateActiveTokens(user.getId());

        String otpCode = String.format("%06d", OTP_RANDOM.nextInt(1_000_000));
        LocalDateTime now = LocalDateTime.now();

        EmailOtpToken token = new EmailOtpToken();
        token.setId(UUID.randomUUID());
        token.setUser(user);
        token.setEmail(user.getEmail());
        token.setOtpCodeHash(passwordEncoder.encode(otpCode));
        token.setExpiry(now.plusMinutes(OTP_EXPIRY_MINUTES));
        token.setAttemptCount(0);
        token.setUsed(false);
        token.setCreatedAt(now);
        emailOtpTokenRepository.save(token);

        emailService.sendOtpEmail(user.getEmail(), otpCode);
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

    @Transactional(readOnly = true)
    public StorageUsageResponse getStorageUsage() {
        User user = getAuthenticatedUser();
        return StorageUsageResponse.from(user);
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