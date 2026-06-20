package com.aistudyhub.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken {

    @Id
    private UUID id;

    /**
     * Khóa ngoại liên kết với users(id).
     * ON DELETE CASCADE: khi user bị xóa, tất cả token của họ cũng bị xóa tự động.
     * nullable = true để tương thích ngược với data cũ trong quá trình migration.
     */
    @ManyToOne
    @JoinColumn(name = "user_id", nullable = true)
    private User user;

    /**
     * Giữ lại email để tiện log và hiển thị (không dùng để tra cứu user nữa).
     */
    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "token", nullable = false, length = 36, unique = true)
    private String token;

    @Column(name = "expiry", nullable = false)
    private LocalDateTime expiry;

    @Column(name = "used", nullable = false)
    private boolean used = false;

    public PasswordResetToken() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public LocalDateTime getExpiry() {
        return expiry;
    }

    public void setExpiry(LocalDateTime expiry) {
        this.expiry = expiry;
    }

    public boolean isUsed() {
        return used;
    }

    public void setUsed(boolean used) {
        this.used = used;
    }
}
