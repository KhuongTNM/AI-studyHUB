package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Flashcard;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FlashcardRepository extends JpaRepository<Flashcard, UUID> {
}
