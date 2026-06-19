package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StorageService {

    private final UserRepository userRepository;

    public StorageService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public void addUsed(UUID userId, long bytes) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại."));
        user.setStorageUsedBytes(user.getStorageUsedBytes() + bytes);
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    @Transactional
    public void subtractUsed(UUID userId, long bytes) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Người dùng không tồn tại."));
        long newValue = user.getStorageUsedBytes() - bytes;
        user.setStorageUsedBytes(Math.max(0, newValue));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);
    }
}
