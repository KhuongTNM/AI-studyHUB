package com.aistudyhub.backend.config;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Cấu hình Spring Bean cho GoogleIdTokenVerifier.
 *
 * <p>Verifier được khởi tạo một lần duy nhất khi ứng dụng khởi động
 * và tái sử dụng cho toàn bộ vòng đời ứng dụng, tránh tạo thừa object
 * gây áp lực lên Garbage Collection (GC).
 *
 * <p>Thư viện tự động cache public key của Google theo HTTP cache-control headers,
 * nên chỉ gọi mạng khi key hết hạn, không gọi lại mỗi request.
 */
@Configuration
public class GoogleAuthConfig {

    /**
     * Tạo {@link GoogleIdTokenVerifier} đã được cấu hình audience.
     *
     * <p>Audience phải khớp với {@code app.google.client-id} trong application.properties.
     * Thư viện sẽ tự kiểm tra chữ ký số, issuer và thời hạn token.
     */
    @Bean
    public GoogleIdTokenVerifier googleIdTokenVerifier(
            @Value("${app.google.client-id}") String clientId)
            throws GeneralSecurityException, IOException {
        return new GoogleIdTokenVerifier.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance())
                .setAudience(Collections.singletonList(clientId))
                .build();
    }
}
