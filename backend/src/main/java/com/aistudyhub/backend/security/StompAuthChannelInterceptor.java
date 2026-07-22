package com.aistudyhub.backend.security;

import io.jsonwebtoken.JwtException;
import java.security.Principal;
import java.util.UUID;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

/**
 * Xác thực JWT ở bước STOMP CONNECT (không dùng JwtAuthFilter vì trình duyệt không cho gắn
 * header tùy ý vào request upgrade WebSocket). Client phải gửi header STOMP "Authorization:
 * Bearer <token>" trong frame CONNECT; nếu thiếu/invalid thì từ chối kết nối ngay tại đây.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;

    public StompAuthChannelInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String header = accessor.getFirstNativeHeader("Authorization");
            if (header == null || !header.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Thiếu Authorization Bearer token khi kết nối WebSocket.");
            }

            try {
                UUID userId = jwtService.extractUserId(header.substring(7));
                accessor.setUser((Principal) () -> userId.toString());
            } catch (JwtException | IllegalArgumentException ex) {
                throw new IllegalArgumentException("Token không hợp lệ hoặc đã hết hạn.");
            }
        }

        return message;
    }
}
