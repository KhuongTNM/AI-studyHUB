package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateFlashcardRequest;
import com.aistudyhub.backend.dto.FlashcardResponse;
import com.aistudyhub.backend.dto.GenerateFlashcardsRequest;
import com.aistudyhub.backend.dto.UpdateFlashcardRequest;
import com.aistudyhub.backend.dto.UpdateFlashcardStatusRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.Flashcard;
import com.aistudyhub.backend.entity.FlashcardStatus;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.FlashcardRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class FlashcardService {

    private final FlashcardRepository flashcardRepository;
    private final DocumentRepository documentRepository;
    private final RestTemplate aiServiceRestTemplate;
    private final String aiServiceUrl;
    private final SubscriptionService subscriptionService;
    private final com.aistudyhub.backend.repository.SubscriptionPlanRepository subscriptionPlanRepository;
    private final com.aistudyhub.backend.repository.UserRepository userRepository;

    public FlashcardService(FlashcardRepository flashcardRepository,
                            DocumentRepository documentRepository,
                            @Qualifier("aiServiceRestTemplate") RestTemplate aiServiceRestTemplate,
                            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl,
                            SubscriptionService subscriptionService,
                            com.aistudyhub.backend.repository.SubscriptionPlanRepository subscriptionPlanRepository,
                            com.aistudyhub.backend.repository.UserRepository userRepository) {
        this.flashcardRepository = flashcardRepository;
        this.documentRepository = documentRepository;
        this.aiServiceRestTemplate = aiServiceRestTemplate;
        this.aiServiceUrl = aiServiceUrl;
        this.subscriptionService = subscriptionService;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public FlashcardResponse updateStatus(UUID id, UpdateFlashcardStatusRequest request) {
        Flashcard flashcard = flashcardRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Flashcard không tồn tại."));

        UUID currentUserId = getCurrentUserId();
        if (!flashcard.getUserId().equals(currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền cập nhật flashcard này.");
        }

        if (request.getStatus() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Trạng thái không được để trống.");
        }
        FlashcardStatus newStatus;
        try {
            newStatus = FlashcardStatus.fromString(request.getStatus());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Trạng thái không hợp lệ. Chỉ hỗ trợ: new, learning, mastered.");
        }

        flashcard.setStatus(newStatus);
        flashcard.setUpdatedAt(LocalDateTime.now());
        return FlashcardResponse.from(flashcardRepository.save(flashcard));
    }

    @Transactional
    public FlashcardResponse createFlashcard(CreateFlashcardRequest request) {
        UUID userId = getCurrentUserId();

        com.aistudyhub.backend.entity.User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        boolean isAdmin = user.getRole() == com.aistudyhub.backend.entity.User.Role.admin || user.getRole() == com.aistudyhub.backend.entity.User.Role.sub_admin;

        if (!isAdmin) {
            com.aistudyhub.backend.entity.Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(userId);
            com.aistudyhub.backend.entity.SubscriptionPlan plan = subscriptionPlanRepository.findById(activeSub.getPlanId())
                    .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Cấu hình gói không hợp lệ."));

            int maxCards = plan.getMaxFlashcards();
            if (maxCards != -1) {
                long currentCards = flashcardRepository.countByUserId(userId);
                if (currentCards >= maxCards) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Gói của bạn chỉ được tạo tối đa " + maxCards + " flashcards. Vui lòng nâng cấp gói.");
                }
            }
        }

        LocalDateTime now = LocalDateTime.now();

        Flashcard card = new Flashcard();
        card.setId(UUID.randomUUID());
        card.setUserId(userId);
        card.setDocumentId(request.getDocumentId());
        card.setQuestion(request.getQuestion().trim());
        card.setAnswer(request.getAnswer().trim());
        card.setStatus(FlashcardStatus.NEW);
        card.setAiGenerated(false);
        card.setCreatedAt(now);
        card.setUpdatedAt(now);

        return FlashcardResponse.from(flashcardRepository.save(card));
    }

    @Transactional
    public void deleteFlashcard(UUID id) {
        Flashcard flashcard = flashcardRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Flashcard không tồn tại."));

        UUID currentUserId = getCurrentUserId();
        if (!flashcard.getUserId().equals(currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xóa flashcard này.");
        }

        flashcardRepository.delete(flashcard);
    }

    /**
     * Xoá toàn bộ flashcard thuộc về một tài liệu, chỉ xoá những thẻ của user hiện tại.
     * Dùng cho endpoint DELETE /api/flashcards?documentId={id} (nút "Làm mới" phía FE).
     */
    @Transactional
    public int deleteAllFlashcardsForDocument(UUID documentId) {
        UUID currentUserId = getCurrentUserId();
        List<Flashcard> cards = flashcardRepository.findByDocumentIdOrderByCreatedAtAsc(documentId);
        List<Flashcard> ownedCards = cards.stream()
                .filter(c -> c.getUserId().equals(currentUserId))
                .toList();
        flashcardRepository.deleteAll(ownedCards);
        return ownedCards.size();
    }

    @Transactional
    public FlashcardResponse updateFlashcard(UUID id, UpdateFlashcardRequest request) {
        Flashcard flashcard = flashcardRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Flashcard không tồn tại."));

        UUID currentUserId = getCurrentUserId();
        if (!flashcard.getUserId().equals(currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền cập nhật flashcard này.");
        }

        flashcard.setQuestion(request.getQuestion().trim());
        flashcard.setAnswer(request.getAnswer().trim());
        flashcard.setUpdatedAt(LocalDateTime.now());

        return FlashcardResponse.from(flashcardRepository.save(flashcard));
    }

    @Transactional
    public List<FlashcardResponse> generateFlashcards(GenerateFlashcardsRequest request) {
        UUID userId = getCurrentUserId();

        com.aistudyhub.backend.entity.User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        boolean isAdmin = user.getRole() == com.aistudyhub.backend.entity.User.Role.admin || user.getRole() == com.aistudyhub.backend.entity.User.Role.sub_admin;

        int requestedCount = request.getCount() != null ? request.getCount() : 5;

        if (!isAdmin) {
            com.aistudyhub.backend.entity.Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(userId);
            com.aistudyhub.backend.entity.SubscriptionPlan plan = subscriptionPlanRepository.findById(activeSub.getPlanId())
                    .orElseThrow(() -> new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Cấu hình gói không hợp lệ."));

            int maxCards = plan.getMaxFlashcards();
            if (maxCards != -1) {
                long currentCards = flashcardRepository.countByUserId(userId);
                if (currentCards + requestedCount > maxCards) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Gói của bạn chỉ cho phép tạo tối đa " + maxCards + " flashcards. Bạn hiện có " + currentCards + " thẻ, không thể tạo thêm " + requestedCount + " thẻ.");
                }
            }
        }

        Document doc = documentRepository.findById(request.getDocumentId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found"));

        if (!doc.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You don't own this document");
        }

        if (!"done".equals(doc.getEmbeddingStatus())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Document not processed yet. Please try later.");
        }

        String url = aiServiceUrl + "/api/v1/flashcards/generate";

        Map<String, Object> payload = new HashMap<>();
        payload.put("document_id", request.getDocumentId().toString());
        payload.put("user_id", userId.toString());
        payload.put("count", requestedCount);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        FlashcardItem[] items;
        try {
            ResponseEntity<FlashcardItem[]> response = aiServiceRestTemplate.postForEntity(url, entity, FlashcardItem[].class);
            items = response.getBody();
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI service unavailable. Please try later.");
        }

        if (items == null || items.length == 0) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate flashcards.");
        }

        LocalDateTime now = LocalDateTime.now();
        List<Flashcard> cards = new ArrayList<>();
        for (FlashcardItem item : items) {
            cards.add(createCard(userId, request.getDocumentId(), now, item.getQuestion(), item.getAnswer()));
        }

        return flashcardRepository.saveAll(cards).stream()
                .map(FlashcardResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FlashcardResponse> listFlashcards(UUID documentId) {
        UUID userId = getCurrentUserId();

        if (documentId != null) {
            List<Flashcard> cards = flashcardRepository.findByDocumentIdOrderByCreatedAtAsc(documentId);
            if (cards.isEmpty()) return List.of();
            if (!cards.get(0).getUserId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Bạn không có quyền xem flashcards này.");
            }
            return cards.stream().map(FlashcardResponse::from).toList();
        }

        List<Flashcard> cards = flashcardRepository.findByUserIdOrderByCreatedAtDesc(userId);
        if (cards.isEmpty()) return List.of();
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

    public static class FlashcardItem {
        private String question;
        private String answer;

        public String getQuestion() { return question; }
        public void setQuestion(String question) { this.question = question; }
        public String getAnswer() { return answer; }
        public void setAnswer(String answer) { this.answer = answer; }
    }
}