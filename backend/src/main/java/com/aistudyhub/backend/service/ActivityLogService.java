package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.ActivityLog;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.ActivityLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    @Transactional(readOnly = true)
    public Page<ActivityLog> getActivityLogs(UUID userId, String role, Pageable pageable) {
        if (!"admin".equals(role) && !"sub_admin".equals(role)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập nhật ký hoạt động.");
        }
        return activityLogRepository.findAllByOrderByCreatedAtDesc(pageable);
    }
}
