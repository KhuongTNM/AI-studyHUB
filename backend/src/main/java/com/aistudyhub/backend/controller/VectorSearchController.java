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
    public void search(@RequestBody Map<String, Object> searchRequest, jakarta.servlet.http.HttpServletResponse response) {
        String searchUrl = aiServiceUrl + "/search";
        response.setContentType("text/event-stream");
        response.setCharacterEncoding("UTF-8");
        
        try {
            org.springframework.web.client.RequestCallback requestCallback = request -> {
                request.getHeaders().setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                mapper.writeValue(request.getBody(), searchRequest);
            };
            
            org.springframework.web.client.ResponseExtractor<Void> responseExtractor = res -> {
                java.io.InputStream is = res.getBody();
                java.io.OutputStream os = response.getOutputStream();
                byte[] buffer = new byte[1024];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    os.write(buffer, 0, bytesRead);
                    os.flush();
                }
                return null;
            };
            
            aiServiceRestTemplate.execute(searchUrl, org.springframework.http.HttpMethod.POST, requestCallback, responseExtractor);
        } catch (Exception e) {
            response.setStatus(jakarta.servlet.http.HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }
}
