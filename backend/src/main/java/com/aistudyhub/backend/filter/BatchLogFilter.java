package com.aistudyhub.backend.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.regex.Pattern;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Đọc header tùy chọn X-Batch-Id (BR-112, API Spec Mục 1 / Mục 6 Quyết định #3) — FE tự sinh
 * 1 UUID cho mỗi lượt upload nhiều file, gắn giống hệt vào toàn bộ N request cùng lượt đó.
 * Filter đẩy value vào MDC (key "batchId") để trace log/audit theo lượt, rồi clear ở finally.
 *
 * <p>KHÔNG lưu batchId vào DB — chỉ phục vụ logging. Chỉ chấp nhận giá trị đúng định dạng UUID;
 * giá trị khác bị bỏ qua (không đẩy vào MDC) để tránh log injection từ header do client tự set.
 */
@Component
public class BatchLogFilter extends OncePerRequestFilter {

    public static final String BATCH_ID_HEADER = "X-Batch-Id";
    public static final String MDC_KEY = "batchId";

    private static final Pattern UUID_PATTERN = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String batchId = request.getHeader(BATCH_ID_HEADER);
        boolean valid = batchId != null && UUID_PATTERN.matcher(batchId).matches();
        if (valid) {
            MDC.put(MDC_KEY, batchId);
        }
        try {
            filterChain.doFilter(request, response);
        } finally {
            if (valid) {
                MDC.remove(MDC_KEY);
            }
        }
    }
}
