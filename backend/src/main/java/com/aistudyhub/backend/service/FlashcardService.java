package com.aistudyhub.backend.service;

import com.aistudyhub.backend.dto.CreateFlashcardRequest;
import com.aistudyhub.backend.dto.FlashcardQuotaResponse;
import com.aistudyhub.backend.dto.FlashcardResponse;
import com.aistudyhub.backend.dto.GenerateFlashcardsRequest;
import com.aistudyhub.backend.dto.GenerateFlashcardsResponse;
import com.aistudyhub.backend.dto.UpdateFlashcardRequest;
import com.aistudyhub.backend.dto.UpdateFlashcardStatusRequest;
import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.Flashcard;
import com.aistudyhub.backend.entity.FlashcardAiDailyUsage;
import com.aistudyhub.backend.entity.FlashcardStatus;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.exception.BusinessException;
import com.aistudyhub.backend.exception.ErrorCode;
import com.aistudyhub.backend.repository.DocumentRepository;
import com.aistudyhub.backend.repository.FlashcardAiDailyUsageRepository;
import com.aistudyhub.backend.repository.FlashcardRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import java.net.SocketTimeoutException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

@Service
public class FlashcardService {

    /**
     * Kích thước cố định của 1 batch gọi AI (BR-100). Đây là HẰNG SỐ KỸ THUẬT bảo vệ quota
     * Gemini dùng chung — KHÔNG phải tham số cấu hình theo gói, không đọc động từ SubscriptionPlan.
     */
    private static final int BATCH_SIZE = 5;

    /**
     * BR-110/Gap 4: mốc "một ngày" của hạn mức tạo Flashcard bằng AI BẮT BUỘC ép cứng theo
     * giờ Việt Nam, KHÔNG được suy ra từ ZoneId.systemDefault() của server (hạ tầng hiện tại
     * nhiều khả năng chạy UTC — xem Flashcard_AI_Daily_Quota_API_Contract.docx Mục 8, Gap 4).
     */
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final FlashcardRepository flashcardRepository;
    private final FlashcardAiDailyUsageRepository flashcardAiDailyUsageRepository;
    private final DocumentRepository documentRepository;
    private final RestTemplate aiServiceRestTemplate;
    private final String aiServiceUrl;
    private final SubscriptionService subscriptionService;
    private final com.aistudyhub.backend.repository.UserRepository userRepository;

    public FlashcardService(FlashcardRepository flashcardRepository,
                            FlashcardAiDailyUsageRepository flashcardAiDailyUsageRepository,
                            DocumentRepository documentRepository,
                            @Qualifier("aiServiceRestTemplate") RestTemplate aiServiceRestTemplate,
                            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl,
                            SubscriptionService subscriptionService,
                            com.aistudyhub.backend.repository.UserRepository userRepository) {
        this.flashcardRepository = flashcardRepository;
        this.flashcardAiDailyUsageRepository = flashcardAiDailyUsageRepository;
        this.documentRepository = documentRepository;
        this.aiServiceRestTemplate = aiServiceRestTemplate;
        this.aiServiceUrl = aiServiceUrl;
        this.subscriptionService = subscriptionService;
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

        if (request.getDocumentId() != null) {
            Document doc = documentRepository.findById(request.getDocumentId())
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Document not found"));

            if (!doc.getUserId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "You don't own this document");
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

    /**
     * Sinh flashcard bằng AI theo cơ chế Batching (BR-100).
     *
     * <p>CHÚ Ý: phương thức này KHÔNG bọc {@code @Transactional} một cách có chủ đích.
     * Mỗi batch phải được lưu (saveAll) và commit ngay khi xử lý xong (BR-100, BR-103) — nếu
     * một batch sau đó thất bại, các thẻ đã lưu ở batch trước KHÔNG được rollback. Do
     * {@link org.springframework.data.jpa.repository.JpaRepository} tự quản lý transaction
     * riêng cho mỗi lời gọi khi không có transaction bao ngoài, việc bỏ {@code @Transactional}
     * ở đây là cách đơn giản nhất để đạt đúng hành vi "lưu ngay, không mất trắng" mà không cần
     * thêm propagation REQUIRES_NEW thủ công.
     */
    public GenerateFlashcardsResponse generateFlashcards(GenerateFlashcardsRequest request) {
        UUID userId = getCurrentUserId();

        com.aistudyhub.backend.entity.User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        boolean isAdmin = user.getRole() == com.aistudyhub.backend.entity.User.Role.admin || user.getRole() == com.aistudyhub.backend.entity.User.Role.sub_admin;

        int requestedCount = request.getCount() != null ? request.getCount() : 5;

        if (!isAdmin) {
            com.aistudyhub.backend.entity.Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(userId);

            // BR-099: trần per-click. Luôn kiểm tra TRƯỚC hạn mức ngày (per-click cap luôn chặt
            // hơn hoặc bằng hạn mức ngày — BR-101, trường hợp ngoại lệ).
            int requestedCountForCheck = requestedCount;
            resolvePerClickLimit().ifPresent(limit -> {
                if (requestedCountForCheck > limit) {
                    throw new BusinessException(ErrorCode.FLASHCARD_PER_CLICK_LIMIT_EXCEEDED, Map.of(
                            "perClickLimit", limit,
                            "requestedCount", requestedCountForCheck));
                }
            });

            // BR-110: hạn mức tạo Flashcard bằng AI theo NGÀY — THAY THẾ HOÀN TOÀN quota tổng
            // (BR-103 cũ đã bị bãi bỏ, xem Flashcard_AI_Daily_Quota_Business_Logic.docx Mục 0.4).
            // SUB-301: đọc từ snapshot đã chốt tại thời điểm kích hoạt Subscription.
            int dailyLimit = activeSub.getDailyMaxFlashcardsSnapshot();
            if (dailyLimit != -1) {
                int usedToday = flashcardAiDailyUsageRepository.findByUserIdAndUsageDate(userId, LocalDate.now(VN_ZONE))
                        .map(FlashcardAiDailyUsage::getCount)
                        .orElse(0);
                if (usedToday + requestedCount > dailyLimit) {
                    throw new BusinessException(ErrorCode.FLASHCARD_DAILY_LIMIT_EXCEEDED, Map.of(
                            "dailyLimit", dailyLimit,
                            "usedToday", usedToday,
                            "requestedCount", requestedCount));
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

        return runBatchedGeneration(userId, request.getDocumentId(), requestedCount);
    }

    /**
     * GET /api/flashcards/quota — BR-112: tái sử dụng ĐÚNG nguồn dữ liệu
     * (FlashcardAiDailyUsageRepository) với khối kiểm tra hạn mức ngày trong generateFlashcards()
     * (BR-110), để chỉ số hiển thị không bao giờ lệch pha với bước chặn thực tế.
     */
    @Transactional(readOnly = true)
    public FlashcardQuotaResponse getFlashcardQuota() {
        UUID userId = getCurrentUserId();
        com.aistudyhub.backend.entity.User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        boolean isAdmin = user.getRole() == com.aistudyhub.backend.entity.User.Role.admin || user.getRole() == com.aistudyhub.backend.entity.User.Role.sub_admin;

        long used = flashcardAiDailyUsageRepository.findByUserIdAndUsageDate(userId, LocalDate.now(VN_ZONE))
                .map(FlashcardAiDailyUsage::getCount)
                .orElse(0);

        if (isAdmin) {
            return FlashcardQuotaResponse.builder()
                    .limit(-1).used(used).remaining(null).unlimited(true).build();
        }

        // SUB-301: đọc hạn mức từ snapshot đã chốt tại thời điểm kích hoạt Subscription.
        com.aistudyhub.backend.entity.Subscription activeSub = subscriptionService.getActiveSubscriptionOrDefault(userId);
        int limit = activeSub.getDailyMaxFlashcardsSnapshot();
        boolean unlimited = limit == -1;
        Long remaining = unlimited ? null : Math.max(0, limit - used);
        return FlashcardQuotaResponse.builder()
                .limit(limit).used(used).remaining(remaining).unlimited(unlimited).build();
    }

    /**
     * Đọc trần per-click (BR-099). Trường cấu hình này thuộc phạm vi module
     * Quản lý gói dịch vụ (mục 0.1 - Scope Boundaries) và CHƯA tồn tại trên entity
     * SubscriptionPlan tại thời điểm viết code này. Áp dụng fallback an toàn: trả về rỗng
     * (không áp trần riêng, chỉ dùng quota tổng hiện có) cho tới khi trường đó được bổ sung —
     * khi đó chỉ cần sửa lại đúng phương thức này (ví dụ đọc từ snapshot per-click tương ứng),
     * phần logic validate còn lại không cần thay đổi.
     */
    private Optional<Integer> resolvePerClickLimit() {
        return Optional.empty();
    }

    /**
     * Điều phối tạo Flashcard theo cơ chế Batching (BR-100): chia N thẻ thành các batch cố định
     * {@link #BATCH_SIZE} thẻ, gọi AI tuần tự từng batch, lọc trùng lặp và lưu ngay sau mỗi batch
     * thành công (BR-102, BR-103), dừng sớm và giữ lại kết quả từng phần nếu gặp lỗi (BR-104, BR-105).
     */
    private GenerateFlashcardsResponse runBatchedGeneration(UUID userId, UUID documentId, int requestedCount) {
        // Tập câu hỏi đã chuẩn hoá — dùng để lọc trùng cả 2 phạm vi (a) trong cùng lượt và
        // (b) với flashcard đã tồn tại từ trước của cùng tài liệu (BR-102).
        Set<String> seenNormalizedQuestions = flashcardRepository.findByDocumentIdOrderByCreatedAtAsc(documentId).stream()
                .map(Flashcard::getQuestion)
                .map(FlashcardService::normalizeQuestion)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        int totalBatches = (int) Math.ceil(requestedCount / (double) BATCH_SIZE);
        List<FlashcardResponse> createdCards = new ArrayList<>();
        int carriedDeficit = 0;
        String failureReason = null;

        for (int batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            boolean isLastBatch = batchIndex == totalBatches - 1;
            int plannedBatchSize = isLastBatch
                    ? requestedCount - BATCH_SIZE * (totalBatches - 1)
                    : BATCH_SIZE;
            // Số thiếu của batch trước được cộng dồn vào số cần sinh của batch này (BR-102).
            int batchTarget = plannedBatchSize + carriedDeficit;

            List<FlashcardItem> items;
            try {
                items = callAiForBatch(documentId, userId, batchTarget, seenNormalizedQuestions);
            } catch (AiBatchFailure failure) {
                if (createdCards.isEmpty()) {
                    // Lỗi ngay từ batch đầu tiên -> chưa có thẻ nào, không trừ quota (BR-104 ngoại lệ).
                    throw new BusinessException(failure.getErrorCode(), Map.of(
                            "createdCount", 0,
                            "requestedCount", requestedCount));
                }
                // Đã có thẻ từ (các) batch trước -> dừng lượt, giữ kết quả từng phần (BR-104/BR-105).
                failureReason = failure.getErrorCode().getMessage();
                break;
            }

            List<Flashcard> uniqueCardsToSave = new ArrayList<>();
            LocalDateTime now = LocalDateTime.now();
            for (FlashcardItem item : items) {
                String normalized = normalizeQuestion(item.getQuestion());
                // seenNormalizedQuestions.add(...) trả về false nếu đã tồn tại -> đây là điểm lọc
                // trùng lặp duy nhất, áp dụng chung cho cả trùng-trong-lượt và trùng-với-thẻ-cũ.
                if (normalized.isEmpty() || !seenNormalizedQuestions.add(normalized)) {
                    continue;
                }
                uniqueCardsToSave.add(createCard(userId, documentId, now, item.getQuestion().trim(), item.getAnswer().trim()));
            }

            // Lưu ngay sau khi batch xử lý xong (BR-100, BR-103). Vì generateFlashcards() không
            // bọc @Transactional, saveAll() ở đây commit độc lập ngay lập tức.
            List<Flashcard> saved = uniqueCardsToSave.isEmpty()
                    ? List.of()
                    : flashcardRepository.saveAll(uniqueCardsToSave);
            saved.stream().map(FlashcardResponse::from).forEach(createdCards::add);

            // BR-110/Gap 3: tăng bộ đếm LƯỢT ĐÃ SINH trong ngày ngay sau khi batch lưu thành
            // công — bộ đếm này CHỈ TĂNG, không bao giờ giảm dù thẻ sau đó bị xoá.
            if (!saved.isEmpty()) {
                incrementDailyUsage(userId, LocalDate.now(VN_ZONE), saved.size());
            }

            // Thẻ bị loại do trùng lặp cũng được coi là "thiếu" (BR-102) -> dồn tiếp sang batch sau.
            carriedDeficit = batchTarget - saved.size();
        }

        int createdCount = createdCards.size();
        if (createdCount == 0) {
            // Không batch nào lỗi cứng (AiBatchFailure) nhưng toàn bộ thẻ sinh ra đều bị loại do
            // trùng lặp -> vẫn không được trả 200 với mảng rỗng (API Contract Mục 1).
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to generate flashcards.");
        }

        if (failureReason != null || createdCount < requestedCount) {
            return GenerateFlashcardsResponse.partial(requestedCount, createdCount, failureReason, createdCards);
        }
        return GenerateFlashcardsResponse.completed(requestedCount, createdCount, createdCards);
    }

    /**
     * BR-110/Gap 3: tăng bộ đếm lượt-đã-sinh của (userId, usageDate) lên thêm {@code delta} —
     * increment-only, KHÔNG có thao tác giảm nào tương ứng ở bất kỳ nơi nào khác trong hệ thống
     * (kể cả khi Flashcard bị xoá sau đó), theo đúng quyết định Gap 3 đã chốt.
     */
    private void incrementDailyUsage(UUID userId, LocalDate usageDate, int delta) {
        FlashcardAiDailyUsage usage = flashcardAiDailyUsageRepository.findByUserIdAndUsageDate(userId, usageDate)
                .orElseGet(() -> {
                    FlashcardAiDailyUsage created = new FlashcardAiDailyUsage();
                    created.setUserId(userId);
                    created.setUsageDate(usageDate);
                    created.setCount(0);
                    return created;
                });
        usage.setCount(usage.getCount() + delta);
        usage.setUpdatedAt(LocalDateTime.now());
        flashcardAiDailyUsageRepository.save(usage);
    }

    /**
     * Gọi AI service cho đúng 1 batch, phân loại lỗi theo BR-104. AI service (Python) nay đã
     * phân biệt rõ 3 nhóm lỗi bằng HTTP status riêng (xem backend/AI/routers/flashcards.py +
     * services/llm_service.py: LLMQuotaExhaustedError, LLMContentSafetyBlockedError):
     * - Timeout thật sự (đọc nguyên nhân gốc SocketTimeoutException của ResourceAccessException)
     *   -> AI_GENERATION_TIMEOUT. Các lỗi kết nối khác (service không khởi động được...) giữ
     *   nguyên pattern lỗi cũ (502 ApiException) — không đổi hành vi ĐÃ CÓ.
     * - 429 (Too Many Requests) -> AI_RATE_LIMIT_EXCEEDED: toàn bộ provider Gemini/Cerebras
     *   trong chuỗi fallback ở tầng Python đều bị từ chối (LLMQuotaExhaustedError).
     * - 422 (Unprocessable Entity) -> AI_CONTENT_SAFETY_BLOCKED: nội dung bị chặn bởi chính
     *   sách an toàn (LLMContentSafetyBlockedError) — KHÔNG còn bị lẫn với lỗi parse JSON
     *   thông thường như trước khi Python được refactor.
     * - Mọi lỗi khác từ AI service (Python trả 500 cho lỗi parse JSON/hạ tầng chưa phân loại)
     *   -> gộp vào cùng nhóm xử lý với timeout (BR-104: "lỗi hạ tầng tạm thời" — dừng lượt, giữ
     *   kết quả từng phần), vì đây chỉ còn là lỗi thật sự không rõ nguyên nhân.
     */
    private List<FlashcardItem> callAiForBatch(UUID documentId, UUID userId, int count, Set<String> existingNormalizedQuestions) {
        String url = aiServiceUrl + "/api/v1/flashcards/generate";

        Map<String, Object> payload = new HashMap<>();
        payload.put("document_id", documentId.toString());
        payload.put("user_id", userId.toString());
        payload.put("count", count);
        // Danh sách câu hỏi đã sinh ở các batch trước, gửi kèm để Gemini tránh sinh nội dung
        // trùng lặp giữa các batch (BR-100, BR-102) — Python đã đọc field này và đưa vào
        // system_prompt (xem llm_service.py:_build_dedup_instruction).
        payload.put("existing_questions", List.copyOf(existingNormalizedQuestions));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

        try {
            ResponseEntity<FlashcardItem[]> response = aiServiceRestTemplate.postForEntity(url, entity, FlashcardItem[].class);
            FlashcardItem[] items = response.getBody();
            return items == null ? List.of() : List.of(items);
        } catch (ResourceAccessException e) {
            if (e.getCause() instanceof SocketTimeoutException) {
                throw new AiBatchFailure(ErrorCode.AI_GENERATION_TIMEOUT);
            }
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI service unavailable. Please try later.");
        } catch (HttpClientErrorException.TooManyRequests e) {
            throw new AiBatchFailure(ErrorCode.AI_RATE_LIMIT_EXCEEDED);
        } catch (HttpClientErrorException.UnprocessableEntity e) {
            throw new AiBatchFailure(ErrorCode.AI_CONTENT_SAFETY_BLOCKED);
        } catch (RestClientException e) {
            throw new AiBatchFailure(ErrorCode.AI_GENERATION_TIMEOUT);
        }
    }

    /**
     * Chuẩn hoá câu hỏi để so khớp trùng lặp (BR-102): chuyển thường, bỏ dấu câu, gộp khoảng
     * trắng thừa. Không bỏ dấu tiếng Việt — chỉ chuẩn hoá định dạng, không chuẩn hoá ngôn ngữ.
     */
    private static String normalizeQuestion(String question) {
        if (question == null) {
            return "";
        }
        String lower = question.trim().toLowerCase();
        String withoutPunctuation = lower.replaceAll("\\p{Punct}", "");
        return withoutPunctuation.replaceAll("\\s+", " ").trim();
    }

    /**
     * Lỗi nội bộ của 1 lời gọi AI batch, mang theo đúng ErrorCode cần trả cho client (BR-104).
     * Được callAiForBatch() ném ra và runBatchedGeneration() bắt lại để quyết định dừng lượt +
     * trả partial success hay lỗi cứng, tuỳ đã có thẻ nào được tạo trước đó hay chưa.
     */
    private static final class AiBatchFailure extends RuntimeException {
        private final ErrorCode errorCode;

        AiBatchFailure(ErrorCode errorCode) {
            super(errorCode.getMessage());
            this.errorCode = errorCode;
        }

        ErrorCode getErrorCode() {
            return errorCode;
        }
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