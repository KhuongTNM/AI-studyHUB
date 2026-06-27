package com.aistudyhub.backend.exception;

import org.springframework.http.HttpStatus;

/**
 * Tập trung toàn bộ mã lỗi nghiệp vụ của module Group (và có thể mở rộng cho module khác).
 * Mỗi ErrorCode gắn với 1 HttpStatus + message mặc định, để GlobalExceptionHandler
 * không cần biết logic nghiệp vụ, chỉ cần đọc từ đây.
 */
public enum ErrorCode {

    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_NOT_FOUND"),

    GROUP_NOT_FOUND(HttpStatus.NOT_FOUND, "GROUP_NOT_FOUND"),
    GROUP_ACCESS_DENIED(HttpStatus.FORBIDDEN, "GROUP_ACCESS_DENIED"),
    GROUP_CREATE_NOT_ALLOWED(HttpStatus.FORBIDDEN, "GROUP_CREATE_NOT_ALLOWED"),
    GROUP_CREATE_LIMIT_REACHED(HttpStatus.BAD_REQUEST, "GROUP_CREATE_LIMIT_REACHED"),
    GROUP_JOIN_LIMIT_REACHED(HttpStatus.BAD_REQUEST, "GROUP_JOIN_LIMIT_REACHED"),
    GROUP_CODE_ALREADY_EXISTS(HttpStatus.BAD_REQUEST, "GROUP_CODE_ALREADY_EXISTS"),
    GROUP_ALREADY_JOINED(HttpStatus.BAD_REQUEST, "GROUP_ALREADY_JOINED"),
    GROUP_PASSWORD_INVALID(HttpStatus.FORBIDDEN, "GROUP_PASSWORD_INVALID"),
    GROUP_FULL(HttpStatus.BAD_REQUEST, "GROUP_FULL"),
    GROUP_OWNER_REQUIRED(HttpStatus.FORBIDDEN, "GROUP_OWNER_REQUIRED"),
    GROUP_OWNER_CANNOT_LEAVE(HttpStatus.BAD_REQUEST, "GROUP_OWNER_CANNOT_LEAVE"),

    DOCUMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND"),
    DOCUMENT_NOT_PUBLIC(HttpStatus.FORBIDDEN, "DOCUMENT_NOT_PUBLIC"),
    DOCUMENT_NOT_READY(HttpStatus.BAD_REQUEST, "DOCUMENT_NOT_READY"),
    DOCUMENT_DELETED(HttpStatus.GONE, "DOCUMENT_DELETED"),

    INVALID_IMAGE_TYPE(HttpStatus.BAD_REQUEST, "INVALID_IMAGE_TYPE"),
    IMAGE_TOO_LARGE(HttpStatus.BAD_REQUEST, "IMAGE_TOO_LARGE");

    private final HttpStatus status;
    private final String message;

    ErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getMessage() {
        return message;
    }
}