package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Flashcard;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FlashcardRepository extends JpaRepository<Flashcard, UUID> {
    java.util.List<Flashcard> findByDocumentIdOrderByCreatedAtAsc(UUID documentId);

    java.util.List<Flashcard> findByUserIdOrderByCreatedAtDesc(UUID userId);
}