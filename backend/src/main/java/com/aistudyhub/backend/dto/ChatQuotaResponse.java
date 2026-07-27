package com.aistudyhub.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** GET /api/v1/chat/quota — CHAT-102: số lượt Chat AI còn lại trong ngày theo gói hiện tại. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatQuotaResponse {
    private int limit;
    private long used;
    private Long remaining;
    private boolean unlimited;
}
