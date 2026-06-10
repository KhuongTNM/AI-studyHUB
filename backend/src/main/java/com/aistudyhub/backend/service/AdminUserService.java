package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.GrantSubscriptionRequest;
import com.aistudyhub.backend.dto.ResetUserPasswordRequest;
import com.aistudyhub.backend.dto.UpdateUserStorageLimitRequest;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
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

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SubscriptionPlanRepository subscriptionPlanRepository;

    public AdminUserService(UserRepository userRepository, PasswordEncoder passwordEncoder, SubscriptionPlanRepository subscriptionPlanRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getUsers() {
        requireAdminOrSubAdmin();
        return userRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(UserResponse::from)
                .toList();
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

        String dbPlanName = switch (request.getPlan()) {
            case "FREE" -> "free";
            case "2-4" -> "plan_2_4";
            case "5+" -> "plan_5_plus";
            default -> throw new ApiException(HttpStatus.BAD_REQUEST, "Gói không hợp lệ. Chỉ hỗ trợ: FREE, 2-4, 5+.");
        };

        SubscriptionPlan plan = subscriptionPlanRepository.findByName(dbPlanName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));

        target.setSubscriptionPlanId(plan.getId());
        target.setStorageLimitBytes(plan.getDefaultStorageBytes());

        if ("free".equals(dbPlanName)) {
            target.setSubscriptionExpiresAt(null);
        } else {
            int months = request.getDurationMonths() != null ? request.getDurationMonths() : 0;
            if (months < 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Thời hạn phải lớn hơn 0 tháng.");
            }
            target.setSubscriptionExpiresAt(LocalDateTime.now().plusMonths(months));
        }

        target.setUpdatedAt(LocalDateTime.now());
        return UserResponse.from(userRepository.save(target));
    }

    @Transactional
    public UserResponse updateStorageLimit(UUID userId, UpdateUserStorageLimitRequest request) {
        User actor = requireAdminOrSubAdmin();
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

        validateNotAdmin(actor, target);

        if (target.getRole() != User.Role.user) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Chỉ được chỉnh dung lượng của tài khoản user.");
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

    private long toBytes(BigDecimal storageLimitGb) {
        BigDecimal bytes = storageLimitGb.multiply(BYTES_PER_GB).setScale(0, RoundingMode.HALF_UP);
        try {
            return bytes.longValueExact();
        } catch (ArithmeticException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giới hạn dung lượng không hợp lệ.");
        }
    }
}
