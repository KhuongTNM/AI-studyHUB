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
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service xử lý luồng đăng nhập bằng tài khoản Google (FR-25).
 *
 * <p>Tất cả các phụ thuộc được khai báo là {@code private final} và được
 * Spring inject qua constructor sinh bởi {@code @RequiredArgsConstructor},
 * đảm bảo tái sử dụng instance, không khởi tạo object thừa trong thân hàm.
 */
@Service
@RequiredArgsConstructor
public class GoogleAuthService {

    /** BR-003: Độ dài tối đa của tên hiển thị. */
    private static final int DISPLAY_NAME_MAX_LENGTH = 50;

    private final GoogleIdTokenVerifier googleIdTokenVerifier;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final SubscriptionPlanRepository subscriptionPlanRepository;

    /**
     * FR-25 / BR-088 → BR-094: Đăng nhập bằng Google thông qua ID Token.
     *
     * <p>Luồng xử lý theo nguyên tắc Fail-Fast: mọi kiểm tra đều ném
     * {@link ApiException} ngay lập tức khi phát hiện vi phạm, tránh chọc
     * xuống DB rồi mới báo lỗi.
     *
     * @param request DTO chứa ID Token nhận từ phía Client.
     * @return {@link AuthResponse} gồm JWT nội bộ và thông tin tài khoản.
     */
    @Transactional(rollbackFor = Exception.class)
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {

        // ── Bước 1 (BR-089) ──────────────────────────────────────────────────
        // Xác thực ID Token bằng thư viện chính thức Google.
        // Thư viện kiểm tra: chữ ký số RSA, audience, issuer và thời hạn token.
        GoogleIdToken googleIdToken = verifyIdToken(request.getIdToken());

        GoogleIdToken.Payload payload = googleIdToken.getPayload();

        // ── Bước 2 (BR-088) ──────────────────────────────────────────────────
        // Từ chối ngay nếu email Google chưa được xác minh.
        if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Tài khoản Google này chưa được xác minh email.");
        }

        // ── Bước 3 ───────────────────────────────────────────────────────────
        // Chuẩn hóa email, lấy tên an toàn chống NullPointerException.
        // getEmail() đã được Google đảm bảo không null sau khi verify() thành công.
        String email = payload.getEmail().trim().toLowerCase();

        // payload.get("name") trả về Object, ép kiểu an toàn để tránh NPE.
        Object rawName = payload.get("name");
        String name = (rawName instanceof String s) ? s.trim() : "";

        // ── Bước 4 (BR-090 / BR-091) ─────────────────────────────────────────
        // Tìm tài khoản theo email (không phân biệt hoa/thường).
        Optional<User> existing = userRepository.findByEmailIgnoreCase(email);

        User user;
        if (existing.isPresent()) {
            // BR-090: Email đã tồn tại — đăng nhập vào tài khoản hiện tại.
            user = existing.get();

            // BR-092: Kiểm tra trạng thái khóa tài khoản trước khi cho đăng nhập.
            if (user.isLocked()) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.");
            }
            // BR-093: Tuyệt đối không tăng hoặc làm ảnh hưởng đến loginAttempts
            //         khi đăng nhập qua Google.
        } else {
            // BR-091: Email chưa tồn tại — tự động tạo tài khoản mới.
            user = buildGoogleUser(email, name);
            userRepository.save(user);
        }

        // ── Bước 5 ───────────────────────────────────────────────────────────
        // Sinh JWT nội bộ đồng bộ với luồng đăng nhập email/password.
        String token = jwtService.generateToken(
                user.getId(), user.getEmail(), user.getRole().name());
        return new AuthResponse(token, UserResponse.from(user));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helper: xác thực ID Token với Google.
    // Tách riêng để giữ luồng chính sạch và dễ kiểm thử.
    // ─────────────────────────────────────────────────────────────────────────

    private GoogleIdToken verifyIdToken(String rawToken) {
        GoogleIdToken verified;
        try {
            verified = googleIdTokenVerifier.verify(rawToken);
        } catch (Exception e) {
            // Bắt mọi checked/unchecked exception từ thư viện Google
            // (GeneralSecurityException, IOException, IllegalArgumentException...).
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Google ID Token không hợp lệ hoặc đã hết hạn.");
        }
        // verify() trả về null khi token không hợp lệ (sai chữ ký, sai audience...).
        if (verified == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED,
                    "Google ID Token không hợp lệ hoặc đã hết hạn.");
        }
        return verified;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helper: khởi tạo User mới từ thông tin lấy được trong Google Token.
    // ─────────────────────────────────────────────────────────────────────────

    private User buildGoogleUser(String email, String rawName) {
        // Lấy gói Free — ném lỗi rõ ràng nếu Admin chưa seed dữ liệu.
        SubscriptionPlan freePlan = subscriptionPlanRepository
                .findByName(SubscriptionPlan.FREE_PLAN_NAME)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.INTERNAL_SERVER_ERROR,
                        "Gói Free chưa được cấu hình trong hệ thống."));

        // BR-003: Tên hiển thị lấy từ trường "name" trong token Google.
        // Nếu Google không trả về tên, dùng phần trước "@" của email làm fallback.
        String displayName = rawName.isEmpty()
                ? email.substring(0, email.indexOf('@'))
                : rawName;

        // BR-003: Cắt tên nếu vượt giới hạn 50 ký tự.
        if (displayName.length() > DISPLAY_NAME_MAX_LENGTH) {
            displayName = displayName.substring(0, DISPLAY_NAME_MAX_LENGTH);
        }

        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        // BR-094: Cơ chế Hybrid Auth — băm UUID ngẫu nhiên để thỏa ràng buộc
        //         NOT NULL của DB mà không ảnh hưởng đến schema hiện tại.
        //         Tài khoản Google sẽ không bao giờ dùng trường mật khẩu này.
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setDisplayName(displayName);
        // BR-007: Cấp vai trò người dùng thông thường — dùng Enum, không hardcode chuỗi.
        user.setRole(User.Role.user);
        user.setLocked(false);
        user.setLoginAttempts((short) 0);
        // BR-008: Cấp dung lượng mặc định theo định nghĩa trong gói Free.
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
