package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.repository.UserRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
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
    private final HttpClient httpClient = HttpClient.newHttpClient();

    // Giữ lại để tương thích ngược với các file cũ từng lưu local (nếu có)
    @Value("${app.upload.dir:./uploads}")
    private String uploadDirPath;

    // Cấu hình Supabase Storage — set qua Environment Variables trên Render
    @Value("${supabase.storage.url}")
    private String supabaseStorageUrl; // vd: https://qpwnqtvxthaybzqxjwnm.supabase.co/storage/v1

    @Value("${supabase.storage.bucket}")
    private String supabaseBucket; // vd: documents

    @Value("${supabase.storage.service-key}")
    private String supabaseServiceKey; // Supabase Service Role Key (KHÔNG phải anon key)

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

    /**
     * Upload file lên Supabase Storage. Trả về public URL để lưu vào Document.fileUrl.
     * Java và Python đều truy cập file qua URL này — không phụ thuộc ổ đĩa local của service nào.
     */
    public String uploadToSupabase(MultipartFile file, String storedName) {
        try {
            String encodedName = URLEncoder.encode(storedName, StandardCharsets.UTF_8).replace("+", "%20");
            String uploadUrl = supabaseStorageUrl + "/object/" + supabaseBucket + "/" + encodedName;
            String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(uploadUrl))
                    .header("Authorization", "Bearer " + supabaseServiceKey)
                    .header("Content-Type", contentType)
                    .header("x-upsert", "true")
                    .PUT(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.error("Supabase Storage upload failed [{}]: {}", response.statusCode(), response.body());
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể upload file lên Supabase Storage.");
            }

            return supabaseStorageUrl + "/object/public/" + supabaseBucket + "/" + encodedName;
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error uploading to Supabase Storage", e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Lỗi upload file: " + e.getMessage());
        }
    }

    public void delete(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) return;

        if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
            try {
                String filename = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
                String deleteUrl = supabaseStorageUrl + "/object/" + supabaseBucket + "/" + filename;
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(deleteUrl))
                        .header("Authorization", "Bearer " + supabaseServiceKey)
                        .DELETE()
                        .build();
                httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            } catch (Exception e) {
                log.warn("Failed to delete file on Supabase Storage: {}", fileUrl, e);
            }
            return;
        }

        // Tương thích ngược: file cũ từng lưu local
        try {
            Path uploadDir = Paths.get(uploadDirPath).toAbsolutePath().normalize();
            String filename = Paths.get(fileUrl).getFileName().toString();
            Path filePath = uploadDir.resolve(filename);
            Files.deleteIfExists(filePath);
        } catch (Exception e) {
            log.warn("Failed to delete physical file: {}", fileUrl, e);
        }
    }

    // Load File As Resource — chỉ dùng cho file cũ lưu local (tương thích ngược)
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

    // Store Group Image — vẫn giữ local vì không cần Python đọc tới
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
