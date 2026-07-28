package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.*;
import com.aistudyhub.backend.service.AdminSubscriptionPlanService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

/**
 * Controller cho các thao tác quản trị Subscription Plan.
 * RBAC (GAP-1): việc xoá AdminSecurityService.verifyAdminPassword() (nơi trước đây
 * đồng thời chặn Sub-Admin không được đụng vào Subscription Plan) lấy đi rào chắn phân quyền
 * cũ, nên toàn bộ 4 endpoint thay đổi dữ liệu (Tạo/Sửa toàn bộ/Sửa giá/Xoá) bắt buộc phải có
 * @PreAuthorize("hasRole('ADMIN')") — chỉ Role ADMIN cấp cao nhất mới được thao tác,
 * Sub-Admin gọi vào sẽ nhận 403 Forbidden.
 */
@RestController
@RequestMapping("/api/admin/subscription-plans")
public class AdminSubscriptionPlanController {

    private final AdminSubscriptionPlanService adminSubscriptionPlanService;

    public AdminSubscriptionPlanController(AdminSubscriptionPlanService adminSubscriptionPlanService) {
        this.adminSubscriptionPlanService = adminSubscriptionPlanService;
    }

    @GetMapping
    public ResponseEntity<List<SubscriptionPlanResponse>> getPlans() {
        return ResponseEntity.ok(adminSubscriptionPlanService.getPlans());
    }

    // SUB-201/SUB-302: dùng chung cho Pop-up xác nhận Xoá và Pop-up xác nhận Sửa gói dịch vụ.
    @GetMapping("/{planName}/active-user-count")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ActiveUserCountResponse> getActiveUserCount(@PathVariable String planName) {
        return ResponseEntity.ok(new ActiveUserCountResponse(adminSubscriptionPlanService.getActiveUserCount(planName)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SubscriptionPlanResponse> createPlan(
            @Valid @RequestBody CreateSubscriptionPlanRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminSubscriptionPlanService.createPlan(request));
    }

    @PutMapping("/{planName}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SubscriptionPlanResponse> updatePlan(
            @PathVariable String planName,
            @Valid @RequestBody UpdatePlanRequest request) {
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePlan(planName, request));
    }

    @PatchMapping("/{planName}/price")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SubscriptionPlanResponse> updatePrice(
            @PathVariable String planName,
            @Valid @RequestBody UpdatePackagePriceRequest request) {
        return ResponseEntity.ok(adminSubscriptionPlanService.updatePrice(planName, request));
    }

    @DeleteMapping("/{planName}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deletePlan(@PathVariable String planName) {
        adminSubscriptionPlanService.deletePlan(planName);
        return ResponseEntity.noContent().build();
    }
}
