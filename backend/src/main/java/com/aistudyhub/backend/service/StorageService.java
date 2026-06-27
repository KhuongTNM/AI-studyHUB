package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.web.multipart.MultipartFile;
import java.net.MalformedURLException;

@Slf4j
@Service
public class StorageService {

    private final UserRepository userRepository;

    @Value("${app.upload.dir:./uploads}")
    private String uploadDirPath;

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

    public void delete(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) return;
        try {
            Path uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
            String filename = Paths.get(fileUrl).getFileName().toString();
            Path filePath = uploadDir.resolve(filename);
            Files.deleteIfExists(filePath);
        } catch (Exception e) {
            log.warn("Failed to delete physical file: {}", fileUrl, e);
        }
    }

    // Load File As Resource
    public Resource loadAsResource(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Không tìm thấy đường dẫn tệp.");
        }
        try {
            Path uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
            String filename = Paths.get(fileUrl).getFileName().toString();
            Path filePath = uploadDir.resolve(filename);
            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                throw new ApiException(HttpStatus.NOT_FOUND, "Tệp không tồn tại hoặc không thể đọc được.");
            }
            return resource;
        } catch (MalformedURLException e) {
            log.warn("Failed to resolve physical file: {}", fileUrl, e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể truy xuất tệp.");
        }
    }

    // Store Group Image
    public String storeGroupImage(UUID groupId, MultipartFile file) {
        try {
            Path uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
            Files.createDirectories(uploadDir);

            String originalName = file.getOriginalFilename();
            String extension = "";
            if (originalName != null && originalName.contains(".")) {
                extension = originalName.substring(originalName.lastIndexOf('.'));
            }

            String storedFilename = UUID.randomUUID() + extension;
            Path destination = uploadDir.resolve(storedFilename);
            Files.copy(file.getInputStream(), destination);

            return storedFilename;
        } catch (Exception e) {
            log.warn("Failed to store group image for group {}", groupId, e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể lưu tệp ảnh.");
        }
    }
}