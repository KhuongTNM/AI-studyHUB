package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateSubAdminRequest;
import com.aistudyhub.backend.dto.GrantSubscriptionRequest;
import com.aistudyhub.backend.dto.ResetUserPasswordRequest;
import com.aistudyhub.backend.dto.UpdateUserStorageLimitRequest;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.entity.ActivityLog;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.ActivityLogRepository;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminUserService {

    private static final BigDecimal BYTES_PER_GB = BigDecimal.valueOf(1024L * 1024L * 1024L);
    private static final long SUB_ADMIN_STORAGE_LIMIT_BYTES = 1024L * 1024L * 1024L;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final SubscriptionService subscriptionService;
    private final ActivityLogRepository activityLogRepository;
    private final ObjectMapper objectMapper;
    private final DocumentRepository documentRepository;

    public AdminUserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            SubscriptionPlanRepository subscriptionPlanRepository,
            SubscriptionService subscriptionService,
            ActivityLogRepository activityLogRepository,
            ObjectMapper objectMapper,
            DocumentRepository documentRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.subscriptionService = subscriptionService;
        this.activityLogRepository = activityLogRepository;
        this.objectMapper = objectMapper;
        this.documentRepository = documentRepository;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getUsers() {
        requireAdminOrSubAdmin();
        return userRepository.findByDeletedAtIsNullOrderByCreatedAtDesc().stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse createSubAdmin(CreateSubAdminRequest request) {
        User admin = requireAdmin();

        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "Email này đã được đăng ký.");
        }
        PasswordPolicyValidator.validate(request.getPassword());

        SubscriptionPlan freePlan = subscriptionPlanRepository.findByNameIgnoreCase(SubscriptionPlan.FREE_PLAN_NAME)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói Free."));
        LocalDateTime now = LocalDateTime.now();

        User subAdmin = new User();
        subAdmin.setId(UUID.randomUUID());
        subAdmin.setEmail(email);
        subAdmin.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        subAdmin.setDisplayName(request.getDisplayName().trim());
        subAdmin.setRole(User.Role.sub_admin);
        subAdmin.setLocked(false);
        subAdmin.setLoginAttempts((short) 0);
        // BR-097: tài khoản do Admin tạo trực tiếp (không qua form đăng ký) được coi là đã xác thực,
        // không bắt phải qua bước nhập OTP.
        subAdmin.setEmailVerified(true);
        subAdmin.setStorageUsedBytes(0L);
        subAdmin.setStorageLimitBytes(SUB_ADMIN_STORAGE_LIMIT_BYTES);
        subAdmin.setSubscriptionPlanId(freePlan.getId());
        subAdmin.setSubscriptionExpiresAt(null);
        subAdmin.setLanguagePreference(User.LanguagePreference.vi);
        subAdmin.setThemePreference(User.ThemePreference.light);
        subAdmin.setCreatedByAdminId(admin.getId());
        subAdmin.setCreatedAt(now);
        subAdmin.setUpdatedAt(now);

        User saved = userRepository.save(subAdmin);
        writeCreateSubAdminLog(admin, saved, now);
        return UserResponse.from(saved);
    }

    // ADDED FOR BR-067
    private void validateNotAdmin(User actor, User target) {
        if (actor.getRole() == User.Role.sub_admin && target.getRole() == User.Role.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Cannot operate on Admin accounts.");
        }
    }

    // ADDED FOR BR-063
    @Transactional
    public UserResponse grantSubscription(UUID userId, GrantSubscriptionRequest request) {
        User actor = requireAdminOrSubAdmin();
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

        validateNotAdmin(actor, target);

        if (actor.getRole() == User.Role.sub_admin && target.getRole() != User.Role.user) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Sub-admin chỉ được cấp subscription cho tài khoản user.");
        }

        // BR-063 fix: tra gói theo tên thật trong DB thay vì switch cứng chỉ nhận free/plan_2_4/
        // plan_5_plus — nhờ vậy các gói do Admin tự thêm (SUB-2xx) cũng cấp được qua "Cấp gói",
        // đồng bộ với luồng mua qua PayOS (xem SubscriptionPurchaseService.storageLimitBytesFor).
        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(request.getPlan().trim())
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Gói không hợp lệ."));
        boolean isFreePlan = SubscriptionPlan.FREE_PLAN_NAME.equalsIgnoreCase(plan.getName());

        target.setSubscriptionPlanId(plan.getId());
        target.setStorageLimitBytes(storageLimitBytesFor(plan));

        LocalDateTime grantedAt = LocalDateTime.now();
        if (isFreePlan) {
            target.setSubscriptionExpiresAt(null);
        } else {
            int months = request.getDurationMonths() != null ? request.getDurationMonths() : 0;
            if (months < 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Thời hạn phải lớn hơn 0 tháng.");
            }
            target.setSubscriptionExpiresAt(grantedAt.plusMonths(months));
        }

        target.setUpdatedAt(grantedAt);
        User saved = userRepository.save(target);

        // SUB-101: ghi nhận vào nguồn giao dịch chính (payment.subscriptions) cho mọi gói trả phí,
        // để đồng bộ với luồng mua qua PayOS — trừ gói Free (GAP-T1, không có "thời điểm kích hoạt"
        // mang tính giao dịch nên không tạo Subscription record).
        if (!isFreePlan) {
            subscriptionService.activateNewSubscription(
                    saved.getId(), plan, grantedAt, saved.getSubscriptionExpiresAt());
        } else {
            // Hạ cấp về Free: không tạo bản ghi mới, nhưng PHẢI kết thúc mọi bản ghi trả phí
            // đang ACTIVE — nếu không, getActiveSubscriptionOrDefault() vẫn thấy bản ghi cũ còn
            // hiệu lực (chưa hết hạn) và trả về gói đó thay vì Free, bỏ qua quyết định của Admin.
            subscriptionService.supersedeActiveSubscriptions(saved.getId());
        }

        return UserResponse.from(saved);
    }

    @Transactional
    public UserResponse updateStorageLimit(UUID userId, UpdateUserStorageLimitRequest request) {
        User actor = requireAdminOrSubAdmin();
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

        validateNotAdmin(actor, target);

        if (target.getRole() == User.Role.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Không thể chỉnh dung lượng của tài khoản Admin.");
        }
        if (actor.getRole() == User.Role.sub_admin && target.getRole() != User.Role.user) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Sub-admin chỉ được chỉnh dung lượng của tài khoản user.");
        }
        if (target.getId().equals(actor.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể tự chỉnh dung lượng tài khoản hiện tại.");
        }

        long storageLimitBytes = toBytes(request.getStorageLimitGb());
        if (storageLimitBytes < target.getStorageUsedBytes()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giới hạn mới không được nhỏ hơn dung lượng đã sử dụng.");
        }

        target.setStorageLimitBytes(storageLimitBytes);
        target.setUpdatedAt(LocalDateTime.now());
        return UserResponse.from(userRepository.save(target));
    }

    @Transactional
    public UserResponse setLockStatus(UUID userId, boolean locked) {
        User actor = requireAdminOrSubAdmin();
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

        validateNotAdmin(actor, target);

        if (target.getId().equals(actor.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể tự khóa/mở khóa tài khoản hiện tại.");
        }
        if (actor.getRole() == User.Role.sub_admin && target.getRole() != User.Role.user) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Sub-admin chỉ được khóa/mở khóa tài khoản user.");
        }

        target.setLocked(locked);
        if (!locked) {
            // Reset login attempts on unlock so user doesn't get re-locked on first wrong password
            target.setLoginAttempts((short) 0);
        }
        target.setUpdatedAt(LocalDateTime.now());
        return UserResponse.from(userRepository.save(target));
    }

    /**
     * BR-062: Admin/Sub-admin reset mật khẩu của user bất kỳ, ngoại trừ tài khoản Admin.
     * Mật khẩu mới phải đáp ứng BR-002 (≥8 ký tự, có chữ và số).
     */
    @Transactional
    public UserResponse resetPassword(UUID userId, ResetUserPasswordRequest request) {
        User actor = requireAdminOrSubAdmin();
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

        validateNotAdmin(actor, target);

        // BR-062: không được reset mật khẩu của tài khoản Admin (kể cả Admin reset Admin khác)
        if (target.getRole() == User.Role.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Không được phép reset mật khẩu tài khoản Admin.");
        }
        // Sub-admin chỉ được reset mật khẩu tài khoản user
        if (actor.getRole() == User.Role.sub_admin && target.getRole() != User.Role.user) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Sub-admin chỉ được reset mật khẩu tài khoản user.");
        }
        if (target.getId().equals(actor.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Vui lòng dùng trang Profile để đổi mật khẩu của chính bạn.");
        }

        // BR-002: validate password policy
        PasswordPolicyValidator.validate(request.getNewPassword());

        target.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        // Reset login attempts so the user is not stuck locked out
        target.setLoginAttempts((short) 0);
        target.setUpdatedAt(LocalDateTime.now());
        return UserResponse.from(userRepository.save(target));
    }

    @Transactional
    public void deleteUser(UUID userId) {
        User actor = requireAdminOrSubAdmin();
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

        validateNotAdmin(actor, target);

        if (target.getId().equals(actor.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể tự xóa tài khoản hiện tại.");
        }

        LocalDateTime now = LocalDateTime.now();
        target.setDeletedAt(now);
        target.setUpdatedAt(now);
        userRepository.save(target);

        documentRepository.softDeleteByUserId(userId, now);
    }

    private User requireAdminOrSubAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập bằng tài khoản Admin hoặc Sub-admin.");
        }
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        if (user.getRole() != User.Role.admin && user.getRole() != User.Role.sub_admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Chỉ Admin hoặc Sub-admin mới được thực hiện thao tác này.");
        }
        return user;
    }

    private User requireAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập bằng tài khoản Admin.");
        }
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        if (user.getRole() != User.Role.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Chỉ Admin mới được tạo tài khoản sub-admin.");
        }
        return user;
    }

    private void writeCreateSubAdminLog(User admin, User subAdmin, LocalDateTime createdAt) {
        ActivityLog log = new ActivityLog();
        log.setId(UUID.randomUUID());
        log.setUserId(admin.getId());
        log.setAction(ActivityLog.Action.CREATE_SUB_ADMIN);
        log.setTargetType(ActivityLog.TargetType.USER);
        log.setTargetId(subAdmin.getId()); // helper method converts UUID -> String
        log.setDescription(toJson(Map.of(
                "email", subAdmin.getEmail(),
                "displayName", subAdmin.getDisplayName(),
                "storageLimitBytes", subAdmin.getStorageLimitBytes()
        )));
        log.setCreatedAt(createdAt);
        activityLogRepository.save(log);
    }

    private String toJson(Map<String, Object> details) {
        try {
            return objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể ghi nhật ký hoạt động.");
        }
    }

    private long storageLimitBytesFor(SubscriptionPlan plan) {
        long bytes = plan.getDefaultStorageBytes();
        if (bytes <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Gói dịch vụ chưa được cấu hình dung lượng lưu trữ.");
        }
        return bytes;
    }

    private long toBytes(BigDecimal storageLimitGb) {
        BigDecimal bytes = storageLimitGb.multiply(BYTES_PER_GB).setScale(0, RoundingMode.HALF_UP);
        try {
            return bytes.longValueExact();
        } catch (ArithmeticException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giới hạn dung lượng không hợp lệ.");
        }
    }
}
