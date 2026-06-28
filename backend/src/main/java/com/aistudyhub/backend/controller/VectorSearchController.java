package com.aistudyhub.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/vector")
public class VectorSearchController {

    private final RestTemplate aiServiceRestTemplate;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public VectorSearchController(RestTemplate aiServiceRestTemplate) {
        this.aiServiceRestTemplate = aiServiceRestTemplate;
    }

    @PostMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN','SUB_ADMIN','USER')")
    public ResponseEntity<Object> search(@RequestBody Map<String, Object> searchRequest) {
        String searchUrl = aiServiceUrl + "/search";
        try {
            ResponseEntity<Object> response = aiServiceRestTemplate.postForEntity(searchUrl, searchRequest, Object.class);
            return ResponseEntity.status(response.getStatusCode()).body(response.getBody());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("message", "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau."));
        }
    }
}
