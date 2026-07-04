package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.SubscriptionPurchase;
import com.aistudyhub.backend.repository.SubscriptionPurchaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Job chạy ngầm dọn dẹp các đơn SubscriptionPurchase ở trạng thái EXPIRED
 * đã tồn tại quá lâu trong DB (quá 30 ngày kể từ createdAt).
 *
 * Tách riêng khỏi SubscriptionPurchaseService theo đúng nguyên tắc
 * Single Responsibility: Service xử lý nghiệp vụ mua gói, Job xử lý dọn dẹp định kỳ.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionJobService {

    private static final int RETENTION_DAYS = 30;
    private static final DateTimeFormatter LOG_TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final SubscriptionPurchaseRepository purchaseRepository;

    /**
     * Chạy vào 00:00 hàng ngày (giờ server).
     *
     * Test nhanh dưới local: comment dòng @Scheduled(cron=...) phía dưới lại,
     * và mở khóa dòng @Scheduled(fixedRate = 10000) để chạy mỗi 10 giây.
     */
    // @Scheduled(fixedRate = 10000)
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void purgeExpiredSubscriptionPurchases() {
        LocalDateTime startTime = LocalDateTime.now();
        log.info("[SubscriptionJobService] === BẮT ĐẦU job dọn dẹp đơn EXPIRED quá hạn lúc: {} ===",
                startTime.format(LOG_TIME_FORMAT));

        LocalDateTime threshold = startTime.minusDays(RETENTION_DAYS);

        int deletedCount = purchaseRepository.deleteByStatusAndCreatedAtBefore(
                SubscriptionPurchase.Status.EXPIRED, threshold);

        LocalDateTime endTime = LocalDateTime.now();
        log.info("[SubscriptionJobService] Đã xóa thành công {} bản ghi EXPIRED có createdAt trước {}.",
                deletedCount, threshold.format(LOG_TIME_FORMAT));
        log.info("[SubscriptionJobService] === KẾT THÚC job lúc: {} (thời gian chạy: {} ms) ===",
                endTime.format(LOG_TIME_FORMAT),
                java.time.Duration.between(startTime, endTime).toMillis());
    }
}