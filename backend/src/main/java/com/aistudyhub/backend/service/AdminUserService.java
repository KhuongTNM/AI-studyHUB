package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.UpdateUserStorageLimitRequest;
import com.aistudyhub.backend.dto.UserResponse;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminUserService {

    private static final BigDecimal BYTES_PER_GB = BigDecimal.valueOf(1024L * 1024L * 1024L);

    private final UserRepository userRepository;

    public AdminUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> getUsers() {
        requireAdminOrSubAdmin();
        return userRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional
    public UserResponse updateStorageLimit(UUID userId, UpdateUserStorageLimitRequest request) {
        User actor = requireAdminOrSubAdmin();
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy người dùng."));

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

    private User requireAdminOrSubAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập bằng tài khoản Admin hoặc Sub-admin.");
        }
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        if (user.getRole() != User.Role.admin && user.getRole() != User.Role.sub_admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Chỉ Admin hoặc Sub-admin mới được chỉnh dung lượng.");
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
