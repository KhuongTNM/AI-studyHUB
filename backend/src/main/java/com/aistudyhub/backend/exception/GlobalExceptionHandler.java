package com.aistudyhub.backend.exception;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, String>> handleApiException(ApiException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        FieldError fieldError = ex.getBindingResult().getFieldError();
        String message = fieldError != null ? fieldError.getDefaultMessage() : "Dữ liệu không hợp lệ.";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
    }

    // FIX: MaxGroupsLimitExceededException trước đây không có handler riêng nên rơi
    // vào handleGeneric() (Exception chung) -> luôn trả 500 kèm message chung chung,
    // ẩn mất message thật ("Bạn đã đạt giới hạn tạo nhóm..."). Bắt riêng để trả đúng
    // 400 kèm message thật, cùng convention với các lỗi nghiệp vụ khác trong module Group.
    @ExceptionHandler(MaxGroupsLimitExceededException.class)
    public ResponseEntity<Map<String, String>> handleMaxGroupsLimitExceeded(MaxGroupsLimitExceededException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<Map<String, String>> handleMissingHeader(MissingRequestHeaderException ex) {
        if ("X-Admin-Password".equals(ex.getHeaderName())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Thiếu Header xác thực X-Admin-Password."));
        }
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Thiếu Header yêu cầu: " + ex.getHeaderName()));
    }

    // FIX: Bắt AccessDeniedException từ Spring Security trong controller (nếu có)
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", "Bạn không có quyền truy cập tài nguyên này."));
    }

    // FIX: Bắt AuthenticationException từ Spring Security trong controller (nếu có)
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAuthentication(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", "Chưa đăng nhập hoặc phiên làm việc đã hết hạn."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGeneric(Exception ex) {
        LOGGER.error("Unhandled API exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau."));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ErrorResponse> handleBusinessException(BusinessException ex) {
        ErrorResponse body = ErrorResponse.of(
                ex.getErrorCode().name(), ex.getMessage(), ex.getDetails(), ex.getExtensions());
        return ResponseEntity.status(ex.getErrorCode().getStatus()).body(body);
    }

    // BR-112 / API Spec Mục 6 Quyết định #4: chốt chặn cuối cùng cho race condition khi 2
    // request đồng thời cùng lọt qua bước check trùng tên ở tầng Service (xem
    // DocumentService.upload()) và cùng đụng ràng buộc UNIQUE ux_docs_active_dup_name ở DB.
    // DocumentService đã tự bắt DataIntegrityViolationException tại chỗ để trả đúng schema 409
    // kèm tên file/folderId thật (xem duplicateFileNameException); handler này chỉ là lưới an
    // toàn chung cho các Service khác lỡ để lọt loại lỗi này ra ngoài mà chưa tự xử lý.
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        Throwable rootCause = ex.getMostSpecificCause();
        String rootMessage = rootCause != null ? rootCause.getMessage() : null;
        if (rootMessage != null && rootMessage.contains("ux_docs_active_dup_name")) {
            // Không có originalName ở tầng handler chung này (DocumentService đã tự bắt case
            // này với đầy đủ context ở trên) -> dùng message chung chung, KHÔNG gọi
            // getMessage() trực tiếp vì đó là template thô còn nguyên "%s" chưa format.
            ErrorResponse body = ErrorResponse.of(
                    ErrorCode.DUPLICATE_FILE_NAME.name(), "Tài liệu đã tồn tại trong thư mục này.", null, null);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
        }
        LOGGER.error("Unhandled data integrity violation", ex);
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("DATA_INTEGRITY_VIOLATION", "Dữ liệu vi phạm ràng buộc hệ thống."));
    }
}