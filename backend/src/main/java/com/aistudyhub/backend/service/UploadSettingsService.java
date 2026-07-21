package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.UpdateUploadSettingsRequest;
import com.aistudyhub.backend.dto.UploadSettingsResponse;
import com.aistudyhub.backend.entity.ActivityLog;
import com.aistudyhub.backend.entity.UploadSettings;
import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.exception.SystemConfigurationException;
import com.aistudyhub.backend.repository.ActivityLogRepository;
import com.aistudyhub.backend.repository.UploadSettingsRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cấu hình upload toàn hệ thống — hoàn toàn tách biệt khỏi SubscriptionPlan.
 * Admin/Sub-admin chỉnh sửa số lượng file & dung lượng tối đa mỗi file,
 * áp dụng cho MỌI user bất kể đang dùng gói nào.
 */
@Service
public class UploadSettingsService {

    private static final long BYTES_PER_MB = 1024L * 1024L;

    // Trần cứng cấp hệ thống — admin không thể vượt qua giá trị này
    // (đồng bộ với spring.servlet.multipart.max-file-size ở application.properties).
    private static final long HARD_CEILING_BYTES = 200L * 1024L * 1024L; // 200MB

    private final UploadSettingsRepository uploadSettingsRepository;
    private final ActivityLogRepository activityLogRepository;
    private final ObjectMapper objectMapper;

    public UploadSettingsService(
            UploadSettingsRepository uploadSettingsRepository,
            ActivityLogRepository activityLogRepository,
            ObjectMapper objectMapper) {
        this.uploadSettingsRepository = uploadSettingsRepository;
        this.activityLogRepository = activityLogRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public UploadSettingsResponse getSettings() {
        return UploadSettingsResponse.from(loadOrThrow());
    }

    /** Dùng nội bộ bởi DocumentService khi enforce lúc upload. */
    @Transactional(readOnly = true)
    public UploadSettings loadOrThrow() {
        return uploadSettingsRepository.findById(UploadSettings.SINGLETON_ID)
                .orElseThrow(() -> new SystemConfigurationException(
                        "Hệ thống chưa được cấu hình giới hạn upload."));
    }

    @Transactional
    public UploadSettingsResponse updateSettings(User actor, UpdateUploadSettingsRequest request) {
        long newMaxBytes = Math.round(request.getMaxFileSizeMb() * BYTES_PER_MB);
        if (newMaxBytes > HARD_CEILING_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Dung lượng tối đa mỗi file không được vượt quá 200MB (giới hạn hệ thống).");
        }

        UploadSettings settings = loadOrThrow();
        long oldMaxBytes = settings.getMaxFileSizeBytes();
        int oldMaxFiles = settings.getMaxFilesPerUpload();

        settings.setMaxFileSizeBytes(newMaxBytes);
        settings.setMaxFilesPerUpload(request.getMaxFilesPerUpload());
        settings.setUpdatedAt(LocalDateTime.now());
        settings.setUpdatedByAdminId(actor.getId());

        UploadSettings saved = uploadSettingsRepository.save(settings);
        writeLog(actor, oldMaxBytes, oldMaxFiles, saved);
        return UploadSettingsResponse.from(saved);
    }

    private void writeLog(User actor, long oldMaxBytes, int oldMaxFiles, UploadSettings saved) {
        ActivityLog log = new ActivityLog();
        log.setId(UUID.randomUUID());
        log.setUserId(actor.getId());
        log.setAction(ActivityLog.Action.UPDATE_UPLOAD_SETTINGS);
        log.setTargetType(null);
        log.setTargetId(null);
        log.setDescription(toJson(Map.of(
                "maxFileSizeBytes", Map.of("old", oldMaxBytes, "new", saved.getMaxFileSizeBytes()),
                "maxFilesPerUpload", Map.of("old", oldMaxFiles, "new", saved.getMaxFilesPerUpload())
        )));
        log.setCreatedAt(LocalDateTime.now());
        activityLogRepository.save(log);
    }

    private String toJson(Map<String, Object> details) {
        try {
            return objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể ghi nhật ký hoạt động.");
        }
    }
}
