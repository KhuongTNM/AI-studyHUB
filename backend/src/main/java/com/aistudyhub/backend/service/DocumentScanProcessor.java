package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.repository.DocumentRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

/**
 * Sau khi scan READY → gọi Python AI Service để bắt đầu pipeline
 * extract → chunk → embed → lưu vector DB.
 */
@Component
public class DocumentScanProcessor {

    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentScanProcessor.class);

    private final DocumentRepository documentRepository;
    private final RestTemplate aiServiceRestTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public DocumentScanProcessor(DocumentRepository documentRepository, RestTemplate aiServiceRestTemplate) {
        this.documentRepository = documentRepository;
        this.aiServiceRestTemplate = aiServiceRestTemplate;
    }

    @Async
    @Transactional
    public void simulateScan(UUID documentId) {
        documentRepository.findById(documentId).ifPresent(doc -> {
            doc.setStatus(DocumentStatus.READY);
            doc.setUpdatedAt(LocalDateTime.now());
            documentRepository.save(doc);
            triggerIngestCall(doc);
        });
    }

    /**
     * Re-trigger ingest cho một document đã sẵn có trạng thái READY.
     * Dùng khi embedding_status là 'none' hoặc 'failed' (ví dụ: tài liệu upload
     * trước khi AI service hoạt động).
     */
    @Async
    public void triggerIngest(UUID documentId) {
        documentRepository.findById(documentId).ifPresent(doc -> {
            if (doc.getStatus() != DocumentStatus.READY) {
                LOGGER.warn("Skipping reingest for doc {} — status is {}", documentId, doc.getStatus());
                return;
            }
            triggerIngestCall(doc);
        });
    }

    /**
     * Bulk re-ingest: tìm tất cả document của user có embedding_status IN ('none', 'failed')
     * và trigger lại pipeline embedding cho từng document.
     */
    @Async
    public void bulkReingestForUser(UUID userId) {
        List<Document> docs = documentRepository
                .findByUserIdAndEmbeddingStatusInAndDeletedAtIsNull(userId, List.of("none", "failed"));
        LOGGER.info("Bulk reingest: found {} documents to reprocess for user {}", docs.size(), userId);
        for (Document doc : docs) {
            if (doc.getStatus() == DocumentStatus.READY) {
                triggerIngestCall(doc);
            }
        }
    }

    private void triggerIngestCall(Document doc) {
        try {
            Map<String, String> payload = Map.of(
                "document_id", doc.getId().toString(),
                "file_url", doc.getFileUrl(),
                "user_id", doc.getUserId().toString(),
                "file_type", doc.getFileType()
            );
            String ingestUrl = aiServiceUrl + "/ingest";
            aiServiceRestTemplate.postForEntity(ingestUrl, payload, Void.class);
            LOGGER.info("Successfully triggered ingest for document {}", doc.getId());
        } catch (Exception e) {
            LOGGER.error("Failed to trigger ingest for document {}: {}", doc.getId(), e.getMessage());
        }
    }
}
