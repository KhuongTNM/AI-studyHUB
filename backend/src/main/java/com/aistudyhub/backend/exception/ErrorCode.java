package com.aistudyhub.backend.exception;

import org.springframework.http.HttpStatus;

/**
 * Tập trung toàn bộ mã lỗi nghiệp vụ của module Group (và có thể mở rộng cho module khác).
 * Mỗi ErrorCode gắn với 1 HttpStatus + message mặc định, để GlobalExceptionHandler
 * không cần biết logic nghiệp vụ, chỉ cần đọc từ đây.
 */
public enum ErrorCode {

    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "USER_NOT_FOUND"),
    // Dùng khi request chưa xác thực (userId null từ @AuthenticationPrincipal) -> 401.
    // Khác với GROUP_ACCESS_DENIED (đã đăng nhập nhưng không đủ quyền/không phải thành viên) -> 403.
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED"),

    GROUP_NOT_FOUND(HttpStatus.NOT_FOUND, "GROUP_NOT_FOUND"),
    GROUP_ACCESS_DENIED(HttpStatus.FORBIDDEN, "GROUP_ACCESS_DENIED"),
    GROUP_CREATE_NOT_ALLOWED(HttpStatus.FORBIDDEN, "GROUP_CREATE_NOT_ALLOWED"),
    GROUP_CREATE_LIMIT_REACHED(HttpStatus.BAD_REQUEST, "GROUP_CREATE_LIMIT_REACHED"),
    GROUP_JOIN_LIMIT_REACHED(HttpStatus.BAD_REQUEST, "GROUP_JOIN_LIMIT_REACHED"),
    GROUP_CODE_ALREADY_EXISTS(HttpStatus.BAD_REQUEST, "GROUP_CODE_ALREADY_EXISTS"),
    // BR-109/BR-111: trùng tên nhóm trong phạm vi các nhóm của CÙNG một chủ sở hữu.
    GROUP_NAME_ALREADY_EXISTS(HttpStatus.BAD_REQUEST, "GROUP_NAME_ALREADY_EXISTS"),
    GROUP_ALREADY_JOINED(HttpStatus.BAD_REQUEST, "GROUP_ALREADY_JOINED"),
    GROUP_PASSWORD_INVALID(HttpStatus.FORBIDDEN, "GROUP_PASSWORD_INVALID"),
    GROUP_FULL(HttpStatus.BAD_REQUEST, "GROUP_FULL"),
    GROUP_OWNER_REQUIRED(HttpStatus.FORBIDDEN, "GROUP_OWNER_REQUIRED"),
    GROUP_OWNER_CANNOT_LEAVE(HttpStatus.BAD_REQUEST, "GROUP_OWNER_CANNOT_LEAVE"),
    GROUP_MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "GROUP_MEMBER_NOT_FOUND"),
    GROUP_CANNOT_KICK_SELF(HttpStatus.BAD_REQUEST, "GROUP_CANNOT_KICK_SELF"),

    // ==== Bổ sung cho tính năng Mời thành viên qua Email ====
    GROUP_CANNOT_INVITE_SELF(HttpStatus.BAD_REQUEST, "GROUP_CANNOT_INVITE_SELF"),
    GROUP_MEMBER_ALREADY_JOINED_OR_INVITED(HttpStatus.BAD_REQUEST, "GROUP_MEMBER_ALREADY_JOINED_OR_INVITED"),
    GROUP_INVITATION_NOT_FOUND(HttpStatus.NOT_FOUND, "GROUP_INVITATION_NOT_FOUND"),
    GROUP_INVITATION_NOT_PENDING(HttpStatus.BAD_REQUEST, "GROUP_INVITATION_NOT_PENDING"),

    DOCUMENT_NOT_FOUND(HttpStatus.NOT_FOUND, "DOCUMENT_NOT_FOUND"),
    DOCUMENT_NOT_PUBLIC(HttpStatus.FORBIDDEN, "DOCUMENT_NOT_PUBLIC"),
    DOCUMENT_NOT_READY(HttpStatus.BAD_REQUEST, "DOCUMENT_NOT_READY"),
    DOCUMENT_DELETED(HttpStatus.GONE, "DOCUMENT_DELETED"),

    INVALID_IMAGE_TYPE(HttpStatus.BAD_REQUEST, "INVALID_IMAGE_TYPE"),
    IMAGE_TOO_LARGE(HttpStatus.BAD_REQUEST, "IMAGE_TOO_LARGE"),

    CHAT_SESSION_NOT_FOUND(HttpStatus.NOT_FOUND, "CHAT_SESSION_NOT_FOUND"),

    // ==== Bổ sung cho tính năng Tạo Flashcard AI theo cơ chế Batching (BR-099 → BR-105) ====
    FLASHCARD_PER_CLICK_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "FLASHCARD_PER_CLICK_LIMIT_EXCEEDED"),
    AI_GENERATION_TIMEOUT(HttpStatus.SERVICE_UNAVAILABLE, "AI_GENERATION_TIMEOUT"),
    AI_RATE_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "AI_RATE_LIMIT_EXCEEDED"),
    AI_CONTENT_SAFETY_BLOCKED(HttpStatus.UNPROCESSABLE_ENTITY, "AI_CONTENT_SAFETY_BLOCKED"),

    // ==== Bổ sung cho hạn mức tạo Flashcard AI theo ngày (BR-110, thay thế quota tổng BR-103 cũ) ====
    FLASHCARD_DAILY_LIMIT_EXCEEDED(HttpStatus.BAD_REQUEST, "FLASHCARD_DAILY_LIMIT_EXCEEDED"),

    // ==== Bổ sung cho tính năng Xác thực Email bằng OTP (BR-095 → BR-098) ====
    ACCOUNT_NOT_VERIFIED(HttpStatus.FORBIDDEN, "ACCOUNT_NOT_VERIFIED"),
    EMAIL_ALREADY_VERIFIED(HttpStatus.BAD_REQUEST, "EMAIL_ALREADY_VERIFIED"),
    OTP_NOT_FOUND(HttpStatus.NOT_FOUND, "OTP_NOT_FOUND"),
    OTP_EXPIRED(HttpStatus.BAD_REQUEST, "OTP_EXPIRED"),
    OTP_INVALID_CODE(HttpStatus.BAD_REQUEST, "OTP_INVALID_CODE"),
    OTP_MAX_ATTEMPTS_EXCEEDED(HttpStatus.BAD_REQUEST, "OTP_MAX_ATTEMPTS_EXCEEDED"),
    OTP_RESEND_COOLDOWN(HttpStatus.TOO_MANY_REQUESTS, "OTP_RESEND_COOLDOWN"),

    // ==== Bổ sung cho tính năng Register-Overwrite khi Email chưa xác thực (BR-101) ====
    // TH1: email đã tồn tại và đã emailVerified = true -> từ chối đăng ký (không phải
    // EMAIL_ALREADY_VERIFIED, vì code đó dùng cho verify-otp và trả 400, không phù hợp ngữ cảnh 409 ở đây).
    EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT,
            "Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng chức năng Quên mật khẩu."),
    // BR-100/BR-101: vượt quá 5 lần sinh OTP (đăng ký mới lẫn ghi đè) trong cửa sổ trượt 24 giờ.
    OTP_DAILY_LIMIT_REACHED(HttpStatus.TOO_MANY_REQUESTS,
            "Bạn đã thao tác quá nhiều lần trong 24 giờ qua. Vui lòng thử lại sau."),

    // ==== BR-112: Chặn tải lên tài liệu trùng tên (Duplicate File Name Upload Guard) ====
    // Message dùng %s làm placeholder cho tên file thực tế — build qua formatMessage(originalName).
    // Trả về khi originalName (không phân biệt hoa/thường) trùng với 1 tài liệu Active khác
    // trong CÙNG folderId của CÙNG user — bao gồm cả trùng với dữ liệu cũ lẫn trùng với file
    // vừa upload thành công trước đó trong CHÍNH lượt batch hiện tại, và cả trường hợp
    // race-condition bị DB unique constraint (ux_docs_active_dup_name) chặn lại.
    DUPLICATE_FILE_NAME(HttpStatus.CONFLICT, "File '%s' đã tồn tại trong thư mục này."),
    FOLDER_NOT_FOUND(HttpStatus.NOT_FOUND, "Thư mục đích không tồn tại."),
    FOLDER_ACCESS_DENIED(HttpStatus.FORBIDDEN, "Bạn không có quyền upload vào thư mục này."),
    INVALID_FILE_TYPE(HttpStatus.BAD_REQUEST, "Chỉ hỗ trợ file PDF, DOCX, PPTX."),
    EMPTY_FILE(HttpStatus.BAD_REQUEST, "File không được để trống."),
    SUBJECT_REQUIRED(HttpStatus.BAD_REQUEST, "Môn học không được để trống."),
    INVALID_VISIBILITY(HttpStatus.BAD_REQUEST, "Visibility chỉ hỗ trợ private hoặc public."),
    // Message dùng %d làm placeholder cho hạn mức MB thực tế — build qua formatMessage(limitMB).
    FILE_TOO_LARGE(HttpStatus.PAYLOAD_TOO_LARGE, "File vượt quá dung lượng tối đa cho phép (%dMB)."),
    STORAGE_QUOTA_EXCEEDED(HttpStatus.PAYLOAD_TOO_LARGE, "Dung lượng lưu trữ không đủ.");

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

    /**
     * Build message thực tế từ template có placeholder kiểu String.format
     * (vd DUPLICATE_FILE_NAME dùng %s cho tên file, FILE_TOO_LARGE dùng %d cho MB).
     * Dùng khi cần chèn dữ liệu động vào message thay vì chỉ dùng {@link #getMessage()} tĩnh.
     */
    public String formatMessage(Object... args) {
        return String.format(message, args);
    }
}