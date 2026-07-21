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
        return subscriptionPlanRepository.findAll().stream()
                .map(SubscriptionPlanResponse::from)
                .toList();
    }

    @Transactional
    public SubscriptionPlanResponse createPlan(CreateSubscriptionPlanRequest request) {
        if (request.getPrice() == null || request.getPrice().compareTo(java.math.BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giá gói cước phải lớn hơn 0.");
        }

        String planName = request.getName();
        if (planName == null || planName.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tên gói không được để trống.");
        }
        planName = planName.trim();

        if (subscriptionPlanRepository.existsByNameIgnoreCaseAndIsDeletedFalse(planName)) {
            throw new PlanAlreadyExistsException("Tên gói dịch vụ đã tồn tại.");
        }

        SubscriptionPlan plan = new SubscriptionPlan();
        plan.setName(planName);
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

        String newName = request.getEffectiveName();
        if (newName != null && !newName.isBlank() && !newName.equalsIgnoreCase(plan.getName())) {
            if (subscriptionPlanRepository.existsByNameIgnoreCaseAndIsDeletedFalse(newName.trim())) {
                throw new PlanAlreadyExistsException("Tên gói dịch vụ đã tồn tại.");
            }
            plan.setName(newName.trim());
        }

        if (request.getPrice() != null) {
            if (request.getPrice().compareTo(java.math.BigDecimal.ZERO) <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Giá gói cước phải lớn hơn 0.");
            }
            plan.setPrice(request.getPrice());
        }

        if (request.getMaxRoomMembers() != null) {
            plan.setMaxRoomMembers(request.getMaxRoomMembers());
        }

        if (request.getDefaultStorageBytes() != null) {
            plan.setDefaultStorageBytes(request.getDefaultStorageBytes());
        }
        
        if (request.getCreateGroupLimit() != null) {
            plan.setCreateGroupLimit(request.getCreateGroupLimit());
        }

        if (request.getJoinGroupLimit() != null) {
            plan.setJoinGroupLimit(request.getJoinGroupLimit());
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
        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));
                
        if (plan.isDeleted()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Gói dịch vụ này đã bị xóa.");
        }

        if (request.getPrice() == null || request.getPrice().compareTo(java.math.BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giá gói cước phải lớn hơn 0.");
        }

        plan.setPrice(request.getPrice());
        plan.setUpdatedAt(LocalDateTime.now());
        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
    }
}

