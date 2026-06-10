package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Document;
import com.aistudyhub.backend.entity.DocumentStatus;
import com.aistudyhub.backend.entity.Visibility;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    List<Document> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);

    List<Document> findByUserIdAndStatusAndDeletedAtIsNull(UUID userId, DocumentStatus status);

    List<Document> findByVisibilityAndDeletedAtIsNullAndStatus(Visibility visibility, DocumentStatus status);

    List<Document> findByStatusAndDeletedAtIsNull(DocumentStatus status);

    long countByUserIdAndDeletedAtIsNull(UUID userId);

    // ADDED FOR BR-022/023
    List<Document> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, DocumentStatus status);

    List<Document> findByStatusOrderByCreatedAtDesc(DocumentStatus status);
}
