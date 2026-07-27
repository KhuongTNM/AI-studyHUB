package com.aistudyhub.backend.controller;

import com.aistudyhub.backend.dto.VectorSearchRequest;
import com.aistudyhub.backend.security.AuthUserPrincipal;
import com.aistudyhub.backend.service.ChatService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RequestCallback;
import org.springframework.web.client.ResponseExtractor;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/v1/vector")
public class VectorSearchController {

    private final RestTemplate aiServiceRestTemplate;
    private final ChatService chatService;

    @Value("${ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public VectorSearchController(RestTemplate aiServiceRestTemplate, ChatService chatService) {
        this.aiServiceRestTemplate = aiServiceRestTemplate;
        this.chatService = chatService;
    }

    @PostMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN','SUB_ADMIN','USER')")
    public void search(@Valid @RequestBody VectorSearchRequest request,
                        @AuthenticationPrincipal AuthUserPrincipal principal,
                        HttpServletResponse response) throws IOException {
        // CHAT-101: chặn NGAY DÒNG ĐẦU, trước setContentType() bên dưới — response chưa commit
        // nên GlobalExceptionHandler còn có thể ghi đè status/body 400 khi vượt hạn mức.
        chatService.checkDailyChatQuota(principal.getId());

        String searchUrl = aiServiceUrl + "/search";
        response.setContentType("text/event-stream");
        response.setCharacterEncoding("UTF-8");

        try {
            RequestCallback requestCallback = req -> {
                req.getHeaders().setContentType(MediaType.APPLICATION_JSON);
                Map<String, Object> aiPayload = new HashMap<>();
                aiPayload.put("query", request.getQuery());
                // CHAT-SEC-01: user_id gửi xuống AI Service LUÔN lấy từ JWT (principal), không
                // bao giờ từ Client — chống IDOR/mạo danh truy vấn tài liệu người khác (GAP-4).
                aiPayload.put("user_id", principal.getId().toString());
                aiPayload.put("document_id", request.getDocumentId());
                aiPayload.put("top_k", request.getTopK());
                new ObjectMapper().writeValue(req.getBody(), aiPayload);
            };

            ResponseExtractor<Void> responseExtractor = res -> {
                InputStream is = res.getBody();
                OutputStream os = response.getOutputStream();
                byte[] buffer = new byte[1024];
                int bytesRead;
                while ((bytesRead = is.read(buffer)) != -1) {
                    os.write(buffer, 0, bytesRead);
                    os.flush();
                }
                return null;
            };

            aiServiceRestTemplate.execute(searchUrl, HttpMethod.POST, requestCallback, responseExtractor);
        } catch (Exception e) {
            // GAP-2: trước đây chỉ set status 500 mà không kèm body, khiến FE hiển thị lỗi HTTP
            // chung chung. Chỉ có tác dụng khi response CHƯA commit (đúng tình huống chính GAP-2
            // mô tả: AI Service down ngay khi kết nối); nếu lỗi xảy ra giữa chừng stream thì
            // response đã ở dạng text/event-stream và không thể ghi đè JSON sạch được nữa.
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("application/json");
            response.getWriter().write("{\"message\":\"Không thể kết nối tới AI Service. Vui lòng thử lại sau.\"}");
        }
    }
}
