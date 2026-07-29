package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.FlashcardAiDailyUsage;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FlashcardAiDailyUsageRepository extends JpaRepository<FlashcardAiDailyUsage, UUID> {
    Optional<FlashcardAiDailyUsage> findByUserIdAndUsageDate(UUID userId, LocalDate usageDate);
}
