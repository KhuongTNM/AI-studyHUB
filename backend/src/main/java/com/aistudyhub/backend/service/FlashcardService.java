package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.FlashcardResponse;
import com.aistudyhub.backend.dto.UpdateFlashcardStatusRequest;
import com.aistudyhub.backend.entity.Flashcard;
import com.aistudyhub.backend.entity.FlashcardStatus;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.FlashcardRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FlashcardService {

    private final FlashcardRepository flashcardRepository;

    public FlashcardService(FlashcardRepository flashcardRepository) {
        this.flashcardRepository = flashcardRepository;
    }

    @Transactional
    public FlashcardResponse updateStatus(UUID id, UpdateFlashcardStatusRequest request) {
        Flashcard flashcard = flashcardRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Flashcard không tồn tại."));

        UUID currentUserId = getCurrentUserId();
        if (!flashcard.getUserId().equals(currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền cập nhật flashcard này.");
        }

        FlashcardStatus newStatus;
        try {
            newStatus = FlashcardStatus.valueOf(request.getStatus().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Trạng thái không hợp lệ. Chỉ hỗ trợ: new, learning, mastered.");
        }

        flashcard.setStatus(newStatus);
        flashcard.setUpdatedAt(LocalDateTime.now());
        return FlashcardResponse.from(flashcardRepository.save(flashcard));
    }

    private UUID getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        return principal.getId();
    }
}
