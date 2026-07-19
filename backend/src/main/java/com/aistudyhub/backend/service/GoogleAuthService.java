package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.AuthResponse;
import com.aistudyhub.backend.dto.GoogleLoginRequest;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.JwtService;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

/**
 * Service xử lý luồng đăng nhập bằng tài khoản Google OAuth2 (FR-25).
 *
 * <p>Thay vì verify ID Token, service gọi Google userinfo API với access token
 * để lấy thông tin user (email, name, email_verified).
 */
@Service
@RequiredArgsConstructor
public class GoogleAuthService {

    private static final String GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
    private static final int DISPLAY_NAME_MAX_LENGTH = 50;

    private final RestTemplate restTemplate;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final SubscriptionService subscriptionService;

    /**
     * FR-25 / BR-088 → BR-094: Đăng nhập bằng Google thông qua OAuth2 access token.
     *
     * @param request DTO chứa access token nhận từ phía client.
     * @return {@link AuthResponse} gồm JWT nội bộ và thông tin tài khoản.
     */
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {

        // ── Bước 1 (BR-089) ──────────────────────────────────────────────────
        // Gọi Google userinfo API để xác thực access token và lấy thông tin user.
        Map<String, Object> userInfo = fetchGoogleUserInfo(request.getAccessToken());

        // ── Bước 2 (BR-088) ──────────────────────────────────────────────────
        String email = ((String) userInfo.get("email")).trim().toLowerCase();
        String name = ((String) userInfo.get("name")).trim();

        // ── Bước 3 (BR-088) ──────────────────────────────────────────────────
        if (Boolean.FALSE.equals(userInfo.get("email_verified"))) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Tài khoản Google này chưa được xác thực (email_verified=false).");
        }

        // ── Bước 4 ───────────────────────────────────────────────────────────
        Optional<User> existing = userRepository.findByEmailIgnoreCase(email);

        User user;
        if (existing.isPresent()) {
            // BR-090: Email đã tồn tại — đăng nhập vào tài khoản hiện tại.
            user = existing.get();

            // BR-092: Kiểm tra trạng thái khóa trước khi cho đăng nhập.
            if (user.isLocked()) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.");
            }
            // BR-093: Không ảnh hưởng loginAttempts khi đăng nhập qua Google.
        } else {
            // BR-091: Email chưa tồn tại — tự động tạo tài khoản mới.
            user = buildGoogleUser(email, name);
            userRepository.save(user);
        }

        // Đồng bộ gói cước thực tế (nếu hết hạn thì trả về gói Free ảo và cập nhật core.users)
        subscriptionService.getActiveSubscriptionOrDefault(user.getId());
        User updatedUser = userRepository.findById(user.getId()).orElse(user);

        // ── Bước 5 ───────────────────────────────────────────────────────────
        // Sinh JWT nội bộ đồng bộ với luồng đăng nhập email/password.
        String token = jwtService.generateToken(
                updatedUser.getId(), updatedUser.getEmail(), updatedUser.getRole().name());
        return new AuthResponse(token, UserResponse.from(updatedUser));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helper: gọi Google userinfo API để xác thực access token.
    // ─────────────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchGoogleUserInfo(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    GOOGLE_USERINFO_URL,
                    HttpMethod.GET,
                    entity,
                    Map.class
            );
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            }
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Access token Google không hợp lệ hoặc đã hết hạn.");
        } catch (HttpClientErrorException e) {
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Access token Google không hợp lệ hoặc đã hết hạn.");
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Không thể kết nối đến máy chủ Google. Vui lòng thử lại.");
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helper: khởi tạo User mới từ thông tin Google userinfo.
    // ─────────────────────────────────────────────────────────────────────────

    private User buildGoogleUser(String email, String rawName) {
        SubscriptionPlan freePlan = subscriptionPlanRepository
                .findByNameIgnoreCase(SubscriptionPlan.FREE_PLAN_NAME)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Gói Free chưa được cấu hình trong hệ thống."));

        String displayName = rawName.isEmpty()
                ? email.substring(0, email.indexOf('@'))
                : rawName;

        if (displayName.length() > DISPLAY_NAME_MAX_LENGTH) {
            displayName = displayName.substring(0, DISPLAY_NAME_MAX_LENGTH);
        }

        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        // BR-094: Băm UUID ngẫu nhiên để thỏa ràng buộc NOT NULL của DB.
        // Tài khoản Google sẽ không bao giờ dùng trường mật khẩu này.
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
}
