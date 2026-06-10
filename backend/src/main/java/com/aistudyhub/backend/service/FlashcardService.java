package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.FlashcardResponse;
import com.aistudyhub.backend.dto.GenerateFlashcardsRequest;
import com.aistudyhub.backend.dto.UpdateFlashcardStatusRequest;
import com.aistudyhub.backend.entity.Flashcard;
import com.aistudyhub.backend.entity.FlashcardStatus;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.FlashcardRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FlashcardService {

    private final FlashcardRepository flashcardRepository;
    private final DocumentRepository documentRepository;

    public FlashcardService(FlashcardRepository flashcardRepository,
                            DocumentRepository documentRepository) {
        this.flashcardRepository = flashcardRepository;
        this.documentRepository = documentRepository;
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

    @Transactional
    public List<FlashcardResponse> generateFlashcards(GenerateFlashcardsRequest request) {
        UUID userId = getCurrentUserId();

        documentRepository.findById(request.getDocumentId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Tài liệu không tồn tại."));

        LocalDateTime now = LocalDateTime.now();
        List<Flashcard> cards = List.of(
                createCard(userId, request.getDocumentId(), now, "What is the main topic of this document?", "The main topic is..."),
                createCard(userId, request.getDocumentId(), now, "Explain the key concept discussed.", "The key concept is..."),
                createCard(userId, request.getDocumentId(), now, "What are the important takeaways?", "The important takeaways are...")
        );
        return flashcardRepository.saveAll(cards).stream()
                .map(FlashcardResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FlashcardResponse> listFlashcards(UUID documentId) {
        UUID userId = getCurrentUserId();
        List<Flashcard> cards = flashcardRepository.findByDocumentIdOrderByCreatedAtAsc(documentId);
        if (cards.isEmpty()) return List.of();
        if (!cards.getFirst().getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem flashcards này.");
        }
        return cards.stream().map(FlashcardResponse::from).toList();
    }

    private Flashcard createCard(UUID userId, UUID documentId, LocalDateTime now, String question, String answer) {
        Flashcard card = new Flashcard();
        card.setId(UUID.randomUUID());
        card.setUserId(userId);
        card.setDocumentId(documentId);
        card.setQuestion(question);
        card.setAnswer(answer);
        card.setStatus(FlashcardStatus.NEW);
        card.setAiGenerated(true);
        card.setCreatedAt(now);
        card.setUpdatedAt(now);
        return card;
    }

    private UUID getCurrentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập.");
        }
        return principal.getId();
    }
}
