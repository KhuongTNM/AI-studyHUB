package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.AuthResponse;
import com.aistudyhub.backend.dto.GoogleLoginRequest;
import com.aistudyhub.backend.dto.RegisterRequest;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    /** Client ID giả dùng trong môi trường test — không kết nối Google thật. */
    private static final String TEST_GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

    @Mock private UserRepository userRepository;
    @Mock private SubscriptionPlanRepository subscriptionPlanRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private RestTemplate restTemplate;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        // Khởi tạo AuthService với đầy đủ 7 tham số, bao gồm RestTemplate và googleClientId
        authService = new AuthService(
                userRepository,
                subscriptionPlanRepository,
                passwordEncoder,
                jwtService,
                5,
                restTemplate,
                TEST_GOOGLE_CLIENT_ID
        );
    }

    // -------------------------------------------------------------------------
    // Phương thức hỗ trợ dùng chung
    // -------------------------------------------------------------------------

    private RegisterRequest buildRequest(String password, String confirmPassword) {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("user@example.com");
        req.setDisplayName("Test User");
        req.setPassword(password);
        req.setConfirmPassword(confirmPassword);
        return req;
    }

    private void stubHappyPath(String rawPassword) {
        SubscriptionPlan freePlan = mock(SubscriptionPlan.class);
        when(freePlan.getId()).thenReturn(1);
        when(freePlan.getDefaultStorageBytes()).thenReturn(1_073_741_824L);

        when(userRepository.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(subscriptionPlanRepository.findByName(SubscriptionPlan.FREE_PLAN_NAME))
                .thenReturn(Optional.of(freePlan));
        when(passwordEncoder.encode(rawPassword)).thenReturn("hashed_" + rawPassword);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(jwtService.generateToken(any(UUID.class), anyString(), anyString()))
                .thenReturn("mock.jwt.token");
    }

    /**
     * Tạo payload Google giả hợp lệ để mock phản hồi của RestTemplate,
     * tránh gọi mạng thật trong môi trường test.
     */
    private Map<String, Object> buildValidGooglePayload(String email, boolean emailVerified) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("aud", TEST_GOOGLE_CLIENT_ID);
        payload.put("iss", "https://accounts.google.com");
        // email_verified được Google trả về dạng String "true"/"false", không phải Boolean
        payload.put("email_verified", String.valueOf(emailVerified));
        payload.put("email", email);
        payload.put("name", "Google Test User");
        return payload;
    }

    /**
     * Tạo User entity mô phỏng bản ghi đã có sẵn trong DB với trạng thái cho trước.
     */
    private User buildExistingUser(String email, boolean locked) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail(email);
        user.setPasswordHash("existing-hashed-password");
        user.setDisplayName("Existing User");
        user.setRole(User.Role.user);
        user.setLocked(locked);
        user.setLoginAttempts((short) 0);
        user.setStorageLimitBytes(1_073_741_824L);
        user.setStorageUsedBytes(0L);
        user.setSubscriptionPlanId(1);
        user.setSubscriptionExpiresAt(null);
        user.setLanguagePreference(User.LanguagePreference.vi);
        user.setThemePreference(User.ThemePreference.light);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return user;
    }

    // -------------------------------------------------------------------------
    // BR-006 — Xác nhận mật khẩu
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("register() — BR-006: xác nhận mật khẩu khi đăng ký")
    class Br006PasswordConfirmationTests {

        @Test
        @DisplayName("Mật khẩu và xác nhận mật khẩu giống nhau hoàn toàn thì đăng ký thành công")
        void register_passwordMatchesConfirm_returnsAuthResponse() {
            String password = "ValidPass1";
            stubHappyPath(password);

            RegisterRequest request = buildRequest(password, password);

            AuthResponse response = assertDoesNotThrow(() -> authService.register(request));

            assertNotNull(response);
            assertNotNull(response.getAccessToken());
            assertNotNull(response.getUser());
            assertEquals("mock.jwt.token", response.getAccessToken());
            verify(userRepository).save(any(User.class));
        }

        @Test
        @DisplayName("Mật khẩu và xác nhận mật khẩu không trùng khớp thì ném BAD_REQUEST")
        void register_passwordMismatch_throwsBadRequest() {
            RegisterRequest request = buildRequest("ValidPass1", "DifferentPass2");

            ApiException ex = assertThrows(ApiException.class,
                    () -> authService.register(request));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertEquals("Mật khẩu xác nhận không trùng khớp.", ex.getMessage());
            verifyNoInteractions(userRepository, subscriptionPlanRepository, passwordEncoder, jwtService);
        }

        @Test
        @DisplayName("Xác nhận mật khẩu là null thì ném BAD_REQUEST")
        void register_nullConfirmPassword_throwsBadRequest() {
            RegisterRequest request = buildRequest("ValidPass1", null);

            ApiException ex = assertThrows(ApiException.class,
                    () -> authService.register(request));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertEquals("Mật khẩu xác nhận không trùng khớp.", ex.getMessage());
            verifyNoInteractions(userRepository, subscriptionPlanRepository, passwordEncoder, jwtService);
        }

        @Test
        @DisplayName("Xác nhận mật khẩu là chuỗi rỗng thì ném BAD_REQUEST")
        void register_emptyConfirmPassword_throwsBadRequest() {
            RegisterRequest request = buildRequest("ValidPass1", "");

            ApiException ex = assertThrows(ApiException.class,
                    () -> authService.register(request));

            assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
            assertEquals("Mật khẩu xác nhận không trùng khớp.", ex.getMessage());
            verifyNoInteractions(userRepository, subscriptionPlanRepository, passwordEncoder, jwtService);
        }
    }

    // -------------------------------------------------------------------------
    // FR-25 — Đăng nhập bằng Google
    // -------------------------------------------------------------------------

    @Nested
    @DisplayName("loginWithGoogle() — FR-25: đăng nhập bằng Google ID Token")
    class GoogleLoginTests {

        @Test
        @DisplayName("Email chưa tồn tại trong DB → tạo mới user với cấu hình mặc định và trả về JWT hợp lệ")
        void loginWithGoogle_NewUser_Success() {
            // Chuẩn bị payload Google giả cho email hoàn toàn mới, chưa có trong hệ thống
            String newEmail = "newuser@gmail.com";
            Map<String, Object> payload = buildValidGooglePayload(newEmail, true);

            // Mock RestTemplate trả về payload hợp lệ — tuyệt đối không gọi mạng thật
            doReturn(payload).when(restTemplate)
                    .getForObject(anyString(), eq(Map.class), anyString());

            // Giả lập DB chưa có user với email này
            when(userRepository.findByEmailIgnoreCase(newEmail)).thenReturn(Optional.empty());

            // Stub các phụ thuộc cần thiết khi tạo user mới (giống luồng register)
            SubscriptionPlan freePlan = mock(SubscriptionPlan.class);
            when(freePlan.getId()).thenReturn(1);
            when(freePlan.getDefaultStorageBytes()).thenReturn(1_073_741_824L);
            when(subscriptionPlanRepository.findByName(SubscriptionPlan.FREE_PLAN_NAME))
                    .thenReturn(Optional.of(freePlan));
            // Mật khẩu ngẫu nhiên được mã hóa — user Google sẽ không bao giờ dùng trường này
            when(passwordEncoder.encode(anyString())).thenReturn("hashed-random-uuid-password");
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
            when(jwtService.generateToken(any(UUID.class), anyString(), anyString()))
                    .thenReturn("new-user.jwt.token");

            // Thực thi
            GoogleLoginRequest request = new GoogleLoginRequest();
            request.setIdToken("valid-id-token-new-user");
            AuthResponse response = authService.loginWithGoogle(request);

            // Kiểm tra response đúng format như luồng login truyền thống
            assertNotNull(response);
            assertEquals("new-user.jwt.token", response.getAccessToken());
            assertEquals("Bearer", response.getTokenType());
            assertNotNull(response.getUser());
            assertEquals(newEmail, response.getUser().getEmail());

            // Phải lưu user mới xuống DB đúng 1 lần duy nhất
            verify(userRepository, times(1)).save(any(User.class));
            // Phải cấp phát free plan cho user mới
            verify(subscriptionPlanRepository).findByName(SubscriptionPlan.FREE_PLAN_NAME);
        }

        @Test
        @DisplayName("Email đã tồn tại trong DB → đăng nhập thẳng, không tạo user trùng lặp, không đổi mật khẩu cũ")
        void loginWithGoogle_ExistingUser_Success() {
            // Chuẩn bị payload Google cho email đã có sẵn trong hệ thống
            String existingEmail = "existing@gmail.com";
            Map<String, Object> payload = buildValidGooglePayload(existingEmail, true);

            // Mock RestTemplate trả về payload hợp lệ
            doReturn(payload).when(restTemplate)
                    .getForObject(anyString(), eq(Map.class), anyString());

            // Giả lập DB đã có user với email này, tài khoản không bị khóa
            User existingUser = buildExistingUser(existingEmail, false);
            when(userRepository.findByEmailIgnoreCase(existingEmail))
                    .thenReturn(Optional.of(existingUser));
            when(jwtService.generateToken(any(UUID.class), anyString(), anyString()))
                    .thenReturn("existing-user.jwt.token");

            // Thực thi
            GoogleLoginRequest request = new GoogleLoginRequest();
            request.setIdToken("valid-id-token-existing-user");
            AuthResponse response = authService.loginWithGoogle(request);

            // Kiểm tra trả về đúng thông tin user cũ
            assertNotNull(response);
            assertEquals("existing-user.jwt.token", response.getAccessToken());
            assertEquals("Bearer", response.getTokenType());
            assertEquals(existingEmail, response.getUser().getEmail());

            // Quan trọng: không được gọi save() vì user đã tồn tại — không tạo user trùng
            verify(userRepository, never()).save(any(User.class));
            // Không tra cứu free plan vì không cần tạo mới user
            verifyNoInteractions(subscriptionPlanRepository);
        }

        @Test
        @DisplayName("Google API trả về lỗi (token hết hạn hoặc sai mã ứng dụng) → ném 401 UNAUTHORIZED")
        void loginWithGoogle_InvalidToken_Throws401() {
            // Mock RestTemplate ném RestClientException — mô phỏng Google từ chối token
            // (token hết hạn, bị giả mạo, hoặc mất kết nối mạng đến Google)
            doThrow(new RestClientException("Google API từ chối: token không hợp lệ"))
                    .when(restTemplate)
                    .getForObject(anyString(), eq(Map.class), anyString());

            GoogleLoginRequest request = new GoogleLoginRequest();
            request.setIdToken("expired-or-tampered-token");

            // Hệ thống phải chặn ngay lập tức và trả về 401
            ApiException ex = assertThrows(ApiException.class,
                    () -> authService.loginWithGoogle(request));

            assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
            assertEquals("Tài khoản Google không hợp lệ hoặc đã hết hạn.", ex.getMessage());

            // Không được truy vấn DB khi token đã bị từ chối ngay bước xác thực đầu tiên
            verifyNoInteractions(userRepository, subscriptionPlanRepository);
        }

        @Test
        @DisplayName("Google trả về email_verified = false → chặn đăng nhập, ném 401 UNAUTHORIZED")
        void loginWithGoogle_EmailNotVerified_Throws401() {
            // Payload có trường email_verified = false — email chưa qua xác minh của Google
            String unverifiedEmail = "unverified@gmail.com";
            Map<String, Object> payload = buildValidGooglePayload(unverifiedEmail, false);

            // Mock RestTemplate trả về payload với email chưa được xác minh
            doReturn(payload).when(restTemplate)
                    .getForObject(anyString(), eq(Map.class), anyString());

            GoogleLoginRequest request = new GoogleLoginRequest();
            request.setIdToken("unverified-email-token");

            // Hệ thống phải từ chối vì chính sách bảo mật yêu cầu email phải được Google xác minh
            ApiException ex = assertThrows(ApiException.class,
                    () -> authService.loginWithGoogle(request));

            assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatus());
            assertEquals("Email Google chưa được xác minh.", ex.getMessage());

            // Không được tạo mới hay truy vấn user khi email chưa xác minh
            verifyNoInteractions(userRepository, subscriptionPlanRepository);
        }

        @Test
        @DisplayName("Token hợp lệ nhưng tài khoản bị khóa trong DB → ném 403 FORBIDDEN")
        void loginWithGoogle_LockedUser_Throws403() {
            // Payload Google hoàn toàn hợp lệ, nhưng Admin đã khóa tài khoản này
            String lockedEmail = "locked@gmail.com";
            Map<String, Object> payload = buildValidGooglePayload(lockedEmail, true);

            // Mock RestTemplate trả về payload hợp lệ
            doReturn(payload).when(restTemplate)
                    .getForObject(anyString(), eq(Map.class), anyString());

            // Giả lập DB: user tồn tại nhưng đang ở trạng thái bị khóa (locked = true)
            User lockedUser = buildExistingUser(lockedEmail, true);
            when(userRepository.findByEmailIgnoreCase(lockedEmail))
                    .thenReturn(Optional.of(lockedUser));

            GoogleLoginRequest request = new GoogleLoginRequest();
            request.setIdToken("valid-token-but-locked-account");

            // Hệ thống phải từ chối dù Google xác thực thành công — tài khoản bị Admin khóa
            ApiException ex = assertThrows(ApiException.class,
                    () -> authService.loginWithGoogle(request));

            assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
            assertEquals("Tài khoản của bạn đã bị khóa.", ex.getMessage());

            // Không được tạo mới user hay tra cứu free plan
            verifyNoInteractions(subscriptionPlanRepository);
        }
    }
}
