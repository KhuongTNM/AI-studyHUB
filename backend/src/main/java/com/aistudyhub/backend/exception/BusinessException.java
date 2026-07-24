package com.aistudyhub.backend.exception;

import java.util.Map;

/**
 * Exception nghiệp vụ chuẩn hoá theo ErrorCode.
 * Thay thế ApiException(HttpStatus, String) trong các Service.
 * GlobalExceptionHandler sẽ đọc status + message trực tiếp từ ErrorCode.
 *
 * <p>{@code extensions} cho phép đính kèm dữ liệu phụ tuỳ ErrorCode (ví dụ
 * {@code attemptsRemaining} của OTP_INVALID_CODE, {@code email} của ACCOUNT_NOT_VERIFIED)
 * — GlobalExceptionHandler sẽ trải phẳng map này ra cùng cấp với "message" trong response
 * (giữ nguyên hành vi cũ, KHÔNG đổi để tránh gãy các module đang đọc field phẳng này ở FE).
 *
 * <p>{@code details} là cơ chế MỚI (BR-112, API Spec Mục 6 Quyết định #2): 1 object có cấu
 * trúc, gắn vào field "details" lồng nhau trong response thay vì trải phẳng — dùng cho các
 * ErrorCode cần message động (chèn dữ liệu thực tế, vd tên file) kèm dữ liệu chi tiết đi cùng.
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;
    private final Map<String, Object> extensions;
    private final Object details;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, errorCode.getMessage(), null, null);
    }

    public BusinessException(ErrorCode errorCode, Map<String, Object> extensions) {
        this(errorCode, errorCode.getMessage(), extensions, null);
    }

    /** Dùng khi cần message động (vd đã chèn tên file thực tế) kèm 1 object details có cấu trúc. */
    public BusinessException(ErrorCode errorCode, String message, Object details) {
        this(errorCode, message, null, details);
    }

    private BusinessException(ErrorCode errorCode, String message, Map<String, Object> extensions, Object details) {
        super(message);
        this.errorCode = errorCode;
        this.extensions = extensions;
        this.details = details;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public Map<String, Object> getExtensions() {
        return extensions;
    }

    public Object getDetails() {
        return details;
    }
}