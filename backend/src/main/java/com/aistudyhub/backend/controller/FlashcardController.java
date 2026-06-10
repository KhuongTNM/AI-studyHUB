package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.FlashcardResponse;
import com.aistudyhub.backend.dto.GenerateFlashcardsRequest;
import com.aistudyhub.backend.dto.UpdateFlashcardStatusRequest;
import com.aistudyhub.backend.service.FlashcardService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/flashcards")
public class FlashcardController {

    private final FlashcardService flashcardService;

    public FlashcardController(FlashcardService flashcardService) {
        this.flashcardService = flashcardService;
    }

    @PostMapping("/generate")
    public ResponseEntity<List<FlashcardResponse>> generate(
            @Valid @RequestBody GenerateFlashcardsRequest request) {
        return ResponseEntity.ok(flashcardService.generateFlashcards(request));
    }

    @GetMapping
    public ResponseEntity<List<FlashcardResponse>> list(
            @RequestParam UUID documentId) {
        return ResponseEntity.ok(flashcardService.listFlashcards(documentId));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<FlashcardResponse> updateStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateFlashcardStatusRequest request) {
        return ResponseEntity.ok(flashcardService.updateStatus(id, request));
    }
}
