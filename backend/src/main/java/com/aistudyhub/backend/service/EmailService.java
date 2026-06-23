package com.aistudyhub.backend.service;

public interface EmailService {
    void sendResetEmail(String to, String token);
}
