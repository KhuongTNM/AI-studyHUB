package com.aistudyhub.backend.exception;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.time.Instant;
import java.util.Map;

/**
 * Khung response lỗi CHUNG cho toàn hệ thống (BR-112, API Spec Mục 3.2/6 Quyết định #2).
 * Giữ nguyên cấu trúc PHẲNG hiện có: "code" + "message" + "timestamp" là field top-level đơn
 * giản, KHÔNG lồng nhau — chỉ "details" là object lồng, TÙY CHỌN.
 *
 * <p>{@code extraFields} tái hiện đúng hành vi cũ của {@link BusinessException#getExtensions()}
 * (vd {@code attemptsRemaining}, {@code email} của module OTP/Group) — trải phẳng ra ngang hàng
 * với các field khác qua {@link JsonAnyGetter}, để KHÔNG đổi contract JSON của các module đã có
 * (FE các module đó đang đọc thẳng những field này ở top-level).
 */
@JsonPropertyOrder({"code", "message", "timestamp", "details"})
public class ErrorResponse {

    private final String code;
    private final String message;

    // API Spec Mục 6 Quyết định #1: chuẩn ISO-8601 UTC "Z" cố định 3 chữ số phần thập phân
    // (yyyy-MM-dd'T'HH:mm:ss.SSS'Z'). Mặc định Jackson serialize Instant theo full nanosecond
    // precision (9 chữ số) — không đúng chuẩn đã chốt — nên cần ép format tường minh.
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", timezone = "UTC")
    private final Instant timestamp;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private final Object details;

    private final Map<String, Object> extraFields;

    private ErrorResponse(String code, String message, Instant timestamp, Object details, Map<String, Object> extraFields) {
        this.code = code;
        this.message = message;
        this.timestamp = timestamp;
        this.details = details;
        this.extraFields = extraFields;
    }

    public static ErrorResponse of(String code, String message, Object details, Map<String, Object> extraFields) {
        return new ErrorResponse(code, message, Instant.now(), details, extraFields);
    }

    public static ErrorResponse of(String code, String message) {
        return of(code, message, null, null);
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public Object getDetails() {
        return details;
    }

    @JsonAnyGetter
    public Map<String, Object> getExtraFields() {
        return extraFields;
    }
}
