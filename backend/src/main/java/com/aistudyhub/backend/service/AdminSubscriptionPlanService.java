package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.SubscriptionPlanResponse;
import com.aistudyhub.backend.dto.UpdatePackagePriceRequest;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminSubscriptionPlanService {

    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminSubscriptionPlanService(
            SubscriptionPlanRepository subscriptionPlanRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponse> getPlans() {
        return subscriptionPlanRepository.findAll().stream()
                .map(SubscriptionPlanResponse::from)
                .toList();
    }

    @Transactional
    public SubscriptionPlanResponse updatePrice(String planName, UpdatePackagePriceRequest request) {
        User admin = getCurrentAdmin();
        if (!passwordEncoder.matches(request.getAdminPassword(), admin.getPasswordHash())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Mật khẩu Admin không đúng.");
        }
        if (SubscriptionPlan.FREE_PLAN_NAME.equals(planName)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không được chỉnh giá gói Free.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findByName(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));
        plan.setPrice(request.getPrice());
        plan.setUpdatedAt(LocalDateTime.now());
        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
    }

    private User getCurrentAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập bằng tài khoản Admin.");
        }
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        if (user.getRole() != User.Role.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Chỉ Admin mới được chỉnh sửa giá gói.");
        }
        return user;
    }
}
