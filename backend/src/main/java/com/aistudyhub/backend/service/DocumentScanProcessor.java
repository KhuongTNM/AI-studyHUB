package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.repository.DocumentRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DocumentScanProcessor {

    private static final Logger LOGGER = LoggerFactory.getLogger(DocumentScanProcessor.class);

    private final DocumentRepository documentRepository;

    public DocumentScanProcessor(DocumentRepository documentRepository) {
        this.documentRepository = documentRepository;
    }

    @Async
    @Transactional
    public void simulateScan(UUID documentId) {
        try {
            Thread.sleep(500);
            documentRepository.findById(documentId).ifPresent(doc -> {
                doc.setStatus(DocumentStatus.SCANNING);
                doc.setUpdatedAt(LocalDateTime.now());
                documentRepository.save(doc);
            });

            Thread.sleep(2000);

            documentRepository.findById(documentId).ifPresent(doc -> {
                boolean success = ThreadLocalRandom.current().nextDouble() < 0.8;
                doc.setStatus(success ? DocumentStatus.READY : DocumentStatus.FAILED);
                doc.setUpdatedAt(LocalDateTime.now());
                documentRepository.save(doc);
            });
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.error("Scan simulation interrupted for document {}", documentId);
        }
    }
}
