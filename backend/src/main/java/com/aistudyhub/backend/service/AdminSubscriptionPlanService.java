package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateSubscriptionPlanRequest;
import com.aistudyhub.backend.dto.SubscriptionPlanResponse;
import com.aistudyhub.backend.dto.UpdatePackagePriceRequest;
import com.aistudyhub.backend.dto.UpdatePlanRequest;
import com.aistudyhub.backend.entity.SubscriptionPlan;
import com.aistudyhub.backend.entity.SubscriptionStatus;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.exception.PlanAlreadyExistsException;
import com.aistudyhub.backend.repository.SubscriptionPlanRepository;
import com.aistudyhub.backend.repository.SubscriptionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AdminSubscriptionPlanService {

    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final SubscriptionRepository subscriptionRepository;

    public AdminSubscriptionPlanService(
            SubscriptionPlanRepository subscriptionPlanRepository,
            SubscriptionRepository subscriptionRepository) {
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.subscriptionRepository = subscriptionRepository;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponse> getPlans() {
        // Admin gets all plans, or maybe just all? The user says Admin API returns normal + flag.
        // We will return all.
        return subscriptionPlanRepository.findAll().stream()
                .map(SubscriptionPlanResponse::from)
                .toList();
    }

    @Transactional
    public SubscriptionPlanResponse createPlan(CreateSubscriptionPlanRequest request) {
        String formattedDisplayName = formatDisplayName(request.getDisplayName());

        if (subscriptionPlanRepository.existsByDisplayName(formattedDisplayName)) {
            throw new PlanAlreadyExistsException("Tên gói (hiển thị) đã tồn tại.");
        }

        String baseSlug = generateSlug(formattedDisplayName);
        if (baseSlug.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tên gói không hợp lệ (không chứa ký tự chữ/số).");
        }
        
        if (baseSlug.length() > 20) {
            baseSlug = baseSlug.substring(0, 20);
        }

        String finalSlug = baseSlug;
        int count = 1;
        while (subscriptionPlanRepository.existsByNameIgnoreCaseAndIsDeletedFalse(finalSlug)) {
            String suffix = "_" + count;
            int remainingLength = 20 - suffix.length();
            if (baseSlug.length() > remainingLength) {
                finalSlug = baseSlug.substring(0, remainingLength) + suffix;
            } else {
                finalSlug = baseSlug + suffix;
            }
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
        plan.setDailyAiChatLimit(request.getDailyAiChatLimit());
        plan.setMaxFlashcards(request.getMaxFlashcards());
        plan.setDeleted(false);
        plan.setCreatedAt(LocalDateTime.now());
        plan.setUpdatedAt(LocalDateTime.now());

        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
    }

    @Transactional
    public SubscriptionPlanResponse updatePlan(String planName, UpdatePlanRequest request) {
        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));
                
        if (plan.isDeleted()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Gói dịch vụ này đã bị xóa.");
        }

        plan.setDescription(request.getDescription());
        plan.setPrice(request.getPrice());
        
        // Handle maxGroups / createGroupLimit
        if (request.getCreateGroupLimit() == null || request.getCreateGroupLimit() == -1) {
            plan.setCreateGroupLimit(-1); // Infinite
        } else {
            plan.setCreateGroupLimit(request.getCreateGroupLimit());
        }

        if (request.getDailyAiChatLimit() != null) {
            plan.setDailyAiChatLimit(request.getDailyAiChatLimit());
        }
        if (request.getMaxFlashcards() != null) {
            plan.setMaxFlashcards(request.getMaxFlashcards());
        }

        plan.setUpdatedAt(LocalDateTime.now());

        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
    }

    @Transactional
    public void deletePlan(String planName) {
        if (SubscriptionPlan.FREE_PLAN_NAME.equalsIgnoreCase(planName) || 
            "plan_2_4".equalsIgnoreCase(planName) || 
            "plan_5_plus".equalsIgnoreCase(planName)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không được xóa các gói mặc định.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));

        if (plan.isDeleted()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Gói này đã bị xóa rồi.");
        }

        if (subscriptionRepository.existsByPlanIdAndStatus(plan.getId(), SubscriptionStatus.ACTIVE)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể xóa gói dịch vụ đang có người sử dụng ACTIVE.");
        }

        plan.setDeleted(true);
        plan.setName(plan.getName() + "_DELETED_" + UUID.randomUUID().toString().substring(0, 8));
        plan.setUpdatedAt(LocalDateTime.now());
        subscriptionPlanRepository.save(plan);
    }

    @Transactional
    public SubscriptionPlanResponse updatePrice(String planName, UpdatePackagePriceRequest request) {
        if (SubscriptionPlan.FREE_PLAN_NAME.equalsIgnoreCase(planName)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không được chỉnh giá gói Free.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));
                
        if (plan.isDeleted()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Gói dịch vụ này đã bị xóa.");
        }

        plan.setPrice(request.getPrice());
        plan.setUpdatedAt(LocalDateTime.now());
        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
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
