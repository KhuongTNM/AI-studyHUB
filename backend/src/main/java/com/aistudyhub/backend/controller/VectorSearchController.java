package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.VectorSearchRequest;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

/**
 * Nhận request tìm kiếm từ Frontend → forward sang Python AI Service.
 * Python lo: embed query → tìm pgvector → gọi LLM → trả kết quả.
 *
 * POST /api/v1/vector/search
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/vector")
@RequiredArgsConstructor
public class VectorSearchController {

    private final RestTemplate restTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @PostMapping("/search")
    public ResponseEntity<?> search(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody VectorSearchRequest request) {

        log.info("[VectorSearch] userId={} query='{}'", principal.getId(), request.getQuery());

        Map<String, Object> body = Map.of(
                "query",       request.getQuery(),
                "user_id",     principal.getId().toString(),
                "document_id", request.getDocumentId() != null ? request.getDocumentId().toString() : "",
                "top_k",       request.getTopK()
        );

        // Forward sang Python AI Service POST /search
        ResponseEntity<List> response = restTemplate.postForEntity(
                aiServiceUrl + "/search", body, List.class);

        return ResponseEntity.ok(response.getBody());
    }
}
