package com.aistudyhub.backend.repository;

import com.aistudyhub.backend.entity.Document;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, UUID> {
}
