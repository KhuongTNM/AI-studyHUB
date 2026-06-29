package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.repository.DocumentRepository;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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

            try {
                Map<String, String> payload = Map.of(
                    "document_id", doc.getId().toString(),
                    "file_url", doc.getFileUrl(),
                    "user_id", doc.getUserId().toString(),
                    "file_type", doc.getFileType()
                );
                
                String ingestUrl = aiServiceUrl + "/ingest";
                aiServiceRestTemplate.postForEntity(ingestUrl, payload, Void.class);
                LOGGER.info("Successfully triggered ingest for document {}", documentId);
            } catch (Exception e) {
                LOGGER.error("Failed to trigger ingest for document {}: {}", documentId, e.getMessage());
            }
        });
    }
}
