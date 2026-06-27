package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.entity.ActivityLog;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.ActivityLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminActivityLogController {

    private final ActivityLogService activityLogService;

    @GetMapping("/activity-logs")
    public ResponseEntity<Page<ActivityLog>> getActivityLogs(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        if (page < 0 || size <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Tham số phân trang không hợp lệ.");
        }

        Page<ActivityLog> logs = activityLogService.getActivityLogs(
                principal.getId(),
                principal.getRole(),
                PageRequest.of(page, size)
        );

        return ResponseEntity.ok(logs);
    }
}
