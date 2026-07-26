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
import com.aistudyhub.backend.repository.UserRepository;
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
    private final UserRepository userRepository;

    public UploadSettingsService(
            UploadSettingsRepository uploadSettingsRepository,
            ActivityLogRepository activityLogRepository,
            ObjectMapper objectMapper,
            UserRepository userRepository) {
        this.uploadSettingsRepository = uploadSettingsRepository;
        this.activityLogRepository = activityLogRepository;
        this.objectMapper = objectMapper;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public UploadSettingsResponse getSettings() {
        return UploadSettingsResponse.from(loadOrThrow());
    }

    /** Dùng nội bộ bởi DocumentService khi enforce lúc upload. */
    @Transactional
    public UploadSettings loadOrThrow() {
        return uploadSettingsRepository.findById(UploadSettings.SINGLETON_ID)
                .orElseGet(() -> {
                    UploadSettings defaultSettings = new UploadSettings();
                    defaultSettings.setId(UploadSettings.SINGLETON_ID);
                    defaultSettings.setMaxFileSizeBytes(50L * 1024L * 1024L); // 50MB default
                    defaultSettings.setMaxFilesPerUpload(10);
                    defaultSettings.setUpdatedAt(LocalDateTime.now());
                    try {
                        return uploadSettingsRepository.save(defaultSettings);
                    } catch (Exception e) {
                        return defaultSettings;
                    }
                });
    }

    @Transactional
    public UploadSettingsResponse updateSettings(UUID actorId, UpdateUploadSettingsRequest request) {
        User actor = userRepository.findById(actorId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));

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
        log.setTargetId((UUID) null); // UUID overload -> null String
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
