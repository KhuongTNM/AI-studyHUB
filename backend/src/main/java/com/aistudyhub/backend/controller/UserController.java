package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.StorageUsageResponse;
import com.aistudyhub.backend.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/me/storage")
    public ResponseEntity<StorageUsageResponse> getStorage() {
        return ResponseEntity.ok(authService.getStorageUsage());
    }
}
