package com.aistudyhub.backend.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Mã hoá/giải mã 2 chiều (AES-GCM) cho dữ liệu cần xem lại nguyên bản (VD: password nhóm).
 * Key được nạp từ biến môi trường (application.yml -> ENV), KHÔNG bao giờ lưu trong DB
 * hay hardcode trong source code, nhằm đảm bảo dù DB bị lộ, dữ liệu mã hoá vẫn không
 * thể giải mã được nếu không có key riêng này.
 */
@Component
public class AesEncryptionUtil {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;   // 96 bit - chuẩn khuyến nghị cho GCM
    private static final int GCM_TAG_LENGTH = 128; // bit

    private final SecretKeySpec secretKey;

    public AesEncryptionUtil(@Value("${app.security.group-password-encryption-key}") String base64Key) {
        byte[] keyBytes = Base64.getDecoder().decode(base64Key);
        this.secretKey = new SecretKeySpec(keyBytes, "AES");
    }

    public String encrypt(String plainText) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));

            byte[] cipherText = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));

            // Ghép IV + cipherText để lưu chung 1 cột; giải mã sẽ tách lại theo đúng độ dài IV.
            byte[] combined = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(cipherText, 0, combined, iv.length, cipherText.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("Lỗi mã hoá dữ liệu mật khẩu nhóm", e);
        }
    }

    public String decrypt(String encryptedBase64) {
        try {
            byte[] combined = Base64.getDecoder().decode(encryptedBase64);

            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] cipherText = new byte[combined.length - GCM_IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, GCM_IV_LENGTH);
            System.arraycopy(combined, GCM_IV_LENGTH, cipherText, 0, cipherText.length);

            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, iv));

            byte[] plainText = cipher.doFinal(cipherText);
            return new String(plainText, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Lỗi giải mã dữ liệu mật khẩu nhóm", e);
        }
    }
}