package com.aistudyhub.backend.exception;

import java.util.Map;

/**
 * Exception nghiệp vụ chuẩn hoá theo ErrorCode.
 * Thay thế ApiException(HttpStatus, String) trong các Service.
 * GlobalExceptionHandler sẽ đọc status + message trực tiếp từ ErrorCode.
 *
 * <p>{@code extensions} cho phép đính kèm dữ liệu phụ tuỳ ErrorCode (ví dụ
 * {@code attemptsRemaining} của OTP_INVALID_CODE, {@code email} của ACCOUNT_NOT_VERIFIED)
 * — GlobalExceptionHandler sẽ trải phẳng map này ra cùng cấp với "message" trong response.
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;
    private final Map<String, Object> extensions;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, null);
    }

    public BusinessException(ErrorCode errorCode, Map<String, Object> extensions) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
        this.extensions = extensions;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public Map<String, Object> getExtensions() {
        return extensions;
    }
}