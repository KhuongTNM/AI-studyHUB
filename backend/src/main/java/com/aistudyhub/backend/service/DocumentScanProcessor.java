package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.repository.DocumentRepository;
import java.time.LocalDateTime;
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
    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public DocumentScanProcessor(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
        this.restTemplate = new RestTemplate();
    }

    @Async
    @Transactional
    public void simulateScan(UUID documentId) {
        try {
            // Bước 1: SCANNING
            Thread.sleep(500);
            documentRepository.findById(documentId).ifPresent(doc -> {
                doc.setStatus(DocumentStatus.SCANNING);
                doc.setUpdatedAt(LocalDateTime.now());
                documentRepository.save(doc);
            });

            // Bước 2: READY / FAILED
            Thread.sleep(2000);

            boolean[] isReady = {false};
            documentRepository.findById(documentId).ifPresent(doc -> {
                boolean success = ThreadLocalRandom.current().nextDouble() < 0.8;
                doc.setStatus(success ? DocumentStatus.READY : DocumentStatus.FAILED);
                doc.setUpdatedAt(LocalDateTime.now());
                documentRepository.save(doc);
                isReady[0] = success;
            });

            // Bước 3: Gọi Python AI Service để xử lý vector
            if (isReady[0]) {
                LOGGER.info("Document {} READY → calling Python AI Service for ingestion", documentId);
                triggerPythonIngestion(documentId);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.error("Scan interrupted for document {}", documentId);
        }
    }

    /**
     * Gọi Python FastAPI endpoint POST /ingest
     * Python sẽ tự lo: extract text → chunk → embed → lưu pgvector.
     */
    private void triggerPythonIngestion(UUID documentId) {
        try {
            String url = aiServiceUrl + "/ingest";
            Map<String, String> body = Map.of("document_id", documentId.toString());
            ResponseEntity<String> response = restTemplate.postForEntity(url, body, String.class);
            LOGGER.info("Python ingestion triggered for {}, status={}", documentId, response.getStatusCode());
        } catch (Exception e) {
            LOGGER.error("Failed to call Python AI Service for document {}: {}", documentId, e.getMessage());
        }
    }
}
