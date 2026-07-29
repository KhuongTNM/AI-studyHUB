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
        plan.setDailyMaxFlashcards(request.getDailyMaxFlashcards());
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

        boolean isFreePlan = SubscriptionPlan.FREE_PLAN_NAME.equalsIgnoreCase(plan.getName());

        String newName = request.getName();
        if (newName != null && !newName.isBlank() && !newName.equalsIgnoreCase(plan.getName())) {
            if (isFreePlan) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể đổi tên gói Miễn phí.");
            }
            if (subscriptionPlanRepository.existsByNameIgnoreCaseAndIsDeletedFalse(newName.trim())) {
                throw new PlanAlreadyExistsException("Tên gói dịch vụ đã tồn tại.");
            }
            plan.setName(newName.trim());
        }

        if (request.getPrice() != null && request.getPrice().compareTo(plan.getPrice()) != 0) {
            if (isFreePlan) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể thay đổi giá gói Miễn phí.");
            }
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
        if (request.getDailyMaxFlashcards() != null) {
            plan.setDailyMaxFlashcards(request.getDailyMaxFlashcards());
        }

        plan.setUpdatedAt(LocalDateTime.now());

        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
    }

    @Transactional
    public void deletePlan(String planName) {
        if (SubscriptionPlan.FREE_PLAN_NAME.equalsIgnoreCase(planName)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể xoá gói Miễn phí.");
        }

        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));

        if (plan.isDeleted()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Gói này đã bị xóa rồi.");
        }

        // SUB-201: không còn chặn xoá theo số người đang dùng — xoá mềm luôn thành công, đúng
        // nguyên tắc Bảo lưu quyền lợi (Grandfathering). Admin xem cảnh báo số người bị ảnh
        // hưởng qua getActiveUserCount() TRƯỚC khi gọi hàm này (Mục 2, API Contract).
        plan.setDeleted(true);
        plan.setName(plan.getName() + "_DELETED_" + UUID.randomUUID().toString().substring(0, 8));
        plan.setUpdatedAt(LocalDateTime.now());
        subscriptionPlanRepository.save(plan);
    }

    /**
     * SUB-201/SUB-302: số User đang thực sự dùng gói này (còn hiệu lực), dùng cho cảnh báo
     * trước khi Admin xoá hoặc sửa gói. Không chặn theo plan.isDeleted() — vẫn cho xem số liệu
     * của gói đã xoá, để Admin biết còn bao nhiêu người đang được bảo lưu quyền lợi.
     */
    @Transactional(readOnly = true)
    public long getActiveUserCount(String planName) {
        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));
        return subscriptionRepository.countByPlanIdAndStatusAndEndDateAfter(
                plan.getId(), SubscriptionStatus.ACTIVE, LocalDateTime.now());
    }

    @Transactional
    public SubscriptionPlanResponse updatePrice(String planName, UpdatePackagePriceRequest request) {
        SubscriptionPlan plan = subscriptionPlanRepository.findByNameIgnoreCase(planName)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy gói dịch vụ."));
                
        if (plan.isDeleted()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Gói dịch vụ này đã bị xóa.");
        }

        if (SubscriptionPlan.FREE_PLAN_NAME.equalsIgnoreCase(plan.getName())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Không thể thay đổi giá gói Miễn phí.");
        }

        if (request.getPrice() == null || request.getPrice().compareTo(java.math.BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Giá gói cước phải lớn hơn 0.");
        }

        plan.setPrice(request.getPrice());
        plan.setUpdatedAt(LocalDateTime.now());
        return SubscriptionPlanResponse.from(subscriptionPlanRepository.save(plan));
    }
}

