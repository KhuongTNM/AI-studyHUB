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
    public SubscriptionPlanResponse createPlan(com.aistudyhub.backend.dto.CreateSubscriptionPlanRequest request) {
        String formattedDisplayName = formatDisplayName(request.getDisplayName());

        if (subscriptionPlanRepository.existsByDisplayName(formattedDisplayName)) {
            throw new ApiException(HttpStatus.CONFLICT, "Tên gói đã tồn tại.");
        }

        String baseSlug = generateSlug(formattedDisplayName);
        if (baseSlug.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tên gói không hợp lệ (không chứa ký tự chữ/số).");
        }
        
        if (baseSlug.length() > 45) {
            baseSlug = baseSlug.substring(0, 45);
        }

        String finalSlug = baseSlug;
        int count = 1;
        while (subscriptionPlanRepository.existsByName(finalSlug)) {
            finalSlug = baseSlug + "_" + count;
            count++;
        }

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setName(finalSlug);
        plan.setDisplayName(formattedDisplayName);
        plan.setPrice(request.getPrice());
        plan.setMaxRoomMembers(request.getMaxRoomMembers());
        plan.setDefaultStorageBytes(request.getDefaultStorageBytes());
        plan.setCreateGroupLimit(request.getCreateGroupLimit());
        plan.setJoinGroupLimit(request.getJoinGroupLimit());
        plan.setCreatedAt(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());

        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
    }

    @Transactional
    public SubscriptionPlanResponse updatePlan(String planName, com.aistudyhub.backend.dto.UpdateSubscriptionPlanRequest request) {
        SubscriptionPlan plan = subscriptionPlanRepository.findByName(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));

        String formattedDisplayName = formatDisplayName(request.getDisplayName());

        if (!plan.getDisplayName().equalsIgnoreCase(formattedDisplayName) && subscriptionPlanRepository.existsByDisplayName(formattedDisplayName)) {
            throw new ApiException(HttpStatus.CONFLICT, "Tên gói đã tồn tại.");
        }

        plan.setDisplayName(formattedDisplayName);
        plan.setMaxRoomMembers(request.getMaxRoomMembers());
        plan.setDefaultStorageBytes(request.getDefaultStorageBytes());
        plan.setCreateGroupLimit(request.getCreateGroupLimit());
        plan.setJoinGroupLimit(request.getJoinGroupLimit());
        plan.setUpdatedAt(LocalDateTime.now());

        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
    }

    @Transactional
    public void deletePlan(String planName) {
        if (SubscriptionPlan.FREE_PLAN_NAME.equals(planName) || "plan_2_4".equals(planName) || "plan_5_plus".equals(planName)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không được xóa các gói mặc định.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findByName(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));

        if (userRepository.existsBySubscriptionPlanId(plan.getId())) {
            throw new ApiException(HttpStatus.CONFLICT, "Không thể xóa gói dịch vụ đang có người sử dụng.");
        }

        subscriptionPlanRepository.delete(plan);
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

    private String generateSlug(String displayName) {
        String slug = displayName.toLowerCase()
                .replaceAll("[àáạảãâầấậẩẫăằắặẳẵ]", "a")
                .replaceAll("[èéẹẻẽêềếệểễ]", "e")
                .replaceAll("[ìíịỉĩ]", "i")
                .replaceAll("[òóọỏõôồốộổỗơờớợởỡ]", "o")
                .replaceAll("[ùúụủũưừứựửữ]", "u")
                .replaceAll("[ỳýỵỷỹ]", "y")
                .replaceAll("đ", "d")
                .replaceAll("[^a-z0-9\\s-]", "")
                .trim()
                .replaceAll("\\s+", "_");
        return slug;
    }

    private String formatDisplayName(String input) {
        if (input == null || input.isBlank()) return input;
        String[] words = input.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String word = words[i];
            if (word.isEmpty()) continue;
            sb.append(Character.toUpperCase(word.charAt(0)));
            if (word.length() > 1) {
                sb.append(word.substring(1).toLowerCase());
            }
            if (i < words.length - 1) {
                sb.append(" ");
            }
        }
        return sb.toString();
    }
}
