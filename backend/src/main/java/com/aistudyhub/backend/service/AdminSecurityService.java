package com.aistudyhub.backend.service;

import com.aistudyhub.backend.entity.User;
import com.aistudyhub.backend.exception.ApiException;
import com.aistudyhub.backend.exception.InvalidCredentialsException;
import com.aistudyhub.backend.repository.UserRepository;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AdminSecurityService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AdminSecurityService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User verifyAdminPassword(String password) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Vui lòng đăng nhập bằng tài khoản Admin.");
        }
        User admin = userRepository.findById(principal.getId())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Người dùng không tồn tại."));
        if (admin.getRole() != User.Role.admin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Chỉ Admin mới được thực hiện hành động này.");
        }
        
        if (password == null || password.isBlank() || !passwordEncoder.matches(password, admin.getPasswordHash())) {
            throw new InvalidCredentialsException("Mật khẩu Admin không chính xác.");
        }
        return admin;
    }
}
