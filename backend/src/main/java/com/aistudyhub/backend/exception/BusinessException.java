package com.aistudyhub.backend.exception;

/**
 * Exception nghiệp vụ chuẩn hoá theo ErrorCode.
 * Thay thế ApiException(HttpStatus, String) trong các Service.
 * GlobalExceptionHandler sẽ đọc status + message trực tiếp từ ErrorCode.
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;

    public BusinessException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }
}