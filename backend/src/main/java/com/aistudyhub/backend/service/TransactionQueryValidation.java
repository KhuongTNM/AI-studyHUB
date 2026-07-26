package com.aistudyhub.backend.service;

import com.aistudyhub.backend.exception.ApiException;
import org.springframework.http.HttpStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;

/**
 * Validate/chuẩn hoá tham số page/size/month/year/keyword dùng chung cho 2 endpoint danh sách
 * Lịch sử Giao dịch (User: TXN-101/102, Admin: TXN-201/202) — đúng quyết định GAP-3/4/5 đã chốt
 * tại TransactionHistory_API_Contract.docx (v1.1) Mục 6.
 */
final class TransactionQueryValidation {

    private static final int MIN_YEAR = 2020;
    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 100;
    private static final int MIN_KEYWORD_LENGTH = 2;
    private static final String INVALID_PAGE_MESSAGE = "Tham số phân trang không hợp lệ.";
    private static final String INVALID_MONTH_YEAR_MESSAGE = "Tháng hoặc năm không hợp lệ.";

    // Cận "không lọc theo thời gian" — dùng sentinel thay vì NULL. Lý do: Postgres qua Hibernate
    // không suy ra được kiểu dữ liệu cho pattern "(:param IS NULL OR sp.paidAt >= :param)"
    // (lỗi JDBC "could not determine data type of parameter"), xảy ra kể cả khi giá trị KHÔNG
    // null — đây là giới hạn của cách JDBC driver chuẩn bị statement, không phải lỗi do giá trị
    // null. Dùng khoảng luôn cụ thể [1970-01-01, 9999-01-01) để tránh hẳn "IS NULL" trong SQL.
    private static final LocalDateTime NO_FILTER_RANGE_START = LocalDateTime.of(1970, 1, 1, 0, 0);
    private static final LocalDateTime NO_FILTER_RANGE_END = LocalDateTime.of(9999, 1, 1, 0, 0);

    private TransactionQueryValidation() {
    }

    /** GAP-3 (giữ nguyên pattern cũ cho "page"): page < 0 -> 400. */
    static void validatePage(int page) {
        if (page < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_PAGE_MESSAGE);
        }
    }

    /** GAP-4 (đã chốt): size ngoài [1,100] -> BE tự clamp về 10 hoặc 100, KHÔNG lỗi 400. */
    static int clampSize(int size) {
        if (size <= 0) {
            return DEFAULT_SIZE;
        }
        return Math.min(size, MAX_SIZE);
    }

    /**
     * GAP-3 (đã chốt): month bắt buộc 1-12, year bắt buộc [2020, năm hiện tại+1] nếu có truyền.
     * @return mảng 2 phần tử [rangeStart inclusive, rangeEnd exclusive] theo paidAt — LUÔN khác
     *         NULL; nếu không lọc theo thời gian (không truyền cả month lẫn year) trả về
     *         sentinel bao trọn mọi giá trị thực tế có thể có (xem NO_FILTER_RANGE_*).
     */
    static LocalDateTime[] resolveDateRange(Integer month, Integer year) {
        int currentYear = LocalDate.now().getYear();
        if (month != null && (month < 1 || month > 12)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_MONTH_YEAR_MESSAGE);
        }
        if (year != null && (year < MIN_YEAR || year > currentYear + 1)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, INVALID_MONTH_YEAR_MESSAGE);
        }
        if (month == null && year == null) {
            return new LocalDateTime[] { NO_FILTER_RANGE_START, NO_FILTER_RANGE_END };
        }

        // Chỉ truyền month, không truyền year -> mặc định năm hiện tại (API Contract Mục 1.1).
        int effectiveYear = year != null ? year : currentYear;

        if (month != null) {
            YearMonth yearMonth = YearMonth.of(effectiveYear, month);
            LocalDateTime start = yearMonth.atDay(1).atStartOfDay();
            LocalDateTime end = yearMonth.plusMonths(1).atDay(1).atStartOfDay();
            return new LocalDateTime[] { start, end };
        }

        // Chỉ truyền year, không truyền month -> lọc theo cả năm đó.
        LocalDateTime start = LocalDate.of(effectiveYear, 1, 1).atStartOfDay();
        LocalDateTime end = LocalDate.of(effectiveYear + 1, 1, 1).atStartOfDay();
        return new LocalDateTime[] { start, end };
    }

    /**
     * GAP-5 (đã chốt): keyword.trim().length < 2 -> bỏ qua hoàn toàn, coi như không truyền.
     * Trả về "" (KHÔNG phải null) khi bỏ qua — cùng lý do sentinel ở resolveDateRange():
     * LIKE CONCAT('%', '', '%') = '%%' khớp với mọi giá trị, nhờ đó tránh được pattern
     * "(:keyword IS NULL OR ...)" gây lỗi suy kiểu tham số ở Postgres.
     */
    static String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return "";
        }
        String trimmed = keyword.trim();
        return trimmed.length() >= MIN_KEYWORD_LENGTH ? trimmed : "";
    }
}
