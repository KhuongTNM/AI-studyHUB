package com.aistudyhub.backend.config;

import com.aistudyhub.backend.security.JwtAuthFilter;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
// GAP-1: bắt buộc phải có annotation này để @PreAuthorize trên các Controller
// (AdminUserController, AdminSubscriptionPlanController, AdminUploadSettingsController,
// VectorSearchController) thực sự được Spring Security enforce — trước đây chưa được khai báo
// nên các @PreAuthorize đã viết sẵn trong code chỉ mang tính khai báo, không có tác dụng chặn.
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final CorsConfigurationSource corsConfigurationSource;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, CorsConfigurationSource corsConfigurationSource) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.corsConfigurationSource = corsConfigurationSource;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // FIX: Trả về JSON thay vì Whitelabel HTML khi bị chặn ở filter level
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"message\":\"Chưa đăng nhập hoặc phiên làm việc đã hết hạn.\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write("{\"message\":\"Bạn không có quyền truy cập tài nguyên này.\"}");
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/login", "/api/auth/register", "/api/auth/google", "/api/auth/forgot-password", "/api/auth/reset-password", "/api/auth/verify-otp", "/api/auth/resend-otp").permitAll()
                        // /api/documents/public phải permitAll TRƯỚC rule /api/documents/**
                        .requestMatchers(HttpMethod.GET, "/api/documents/public").permitAll()
                        // Public pricing info — intentionally open
                        .requestMatchers(HttpMethod.GET, "/api/subscription-plans/**").permitAll()
                        // Public upload limits — FE dùng để hiển thị/validate, không nhạy cảm
                        .requestMatchers(HttpMethod.GET, "/api/upload-settings").permitAll()
                        // PayOS webhook — không gửi JWT, xác thực bằng HMAC checksum riêng
                        .requestMatchers("/api/payos/webhook").permitAll()
                        // Bank sync — no JWT, authenticated at network level
                        .requestMatchers("/bank/api/transaction-sync").permitAll()
                        // WebSocket/STOMP handshake (SockJS) — browser can't attach a Bearer header
                        // to the upgrade request, so auth happens in the STOMP CONNECT frame
                        // (see StompAuthChannelInterceptor), not at this HTTP layer.
                        .requestMatchers("/ws/**").permitAll()
                        // Swagger UI / OpenAPI docs — chỉ mở giao diện xem/thử API, các endpoint
                        // thật sự phía dưới (vd /api/flashcards/**) vẫn yêu cầu Bearer token như cũ.
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()

                        // ── Authenticated user endpoints ───────────────────────────────────────
                        .requestMatchers("/api/auth/**").authenticated()
                        .requestMatchers("/api/users/**").authenticated()
                        .requestMatchers("/api/documents/**").authenticated()
                        .requestMatchers("/api/flashcards/**").authenticated()
                        .requestMatchers("/api/folders/**").authenticated()
                        .requestMatchers("/api/groups/**").authenticated()
                        .requestMatchers("/api/study-rooms/**").authenticated()
                        .requestMatchers("/api/subscription-purchases/**").authenticated()
                        // SUB-202: GET /api/subscriptions/me — mọi role đã đăng nhập đều gọi được
                        .requestMatchers("/api/subscriptions/**").authenticated()
                        .requestMatchers("/api/v1/chat/**").authenticated()
                        // Vector search has @PreAuthorize but also needs filter-level guard
                        .requestMatchers("/api/v1/vector/**").authenticated()

                        // ── Admin/Sub-admin only endpoints ────────────────────────────────────
                        // Defense-in-depth: block at filter level BEFORE reaching service layer.
                        // Service layer has its own requireAdminOrSubAdmin() checks as well.
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN", "SUB_ADMIN")

                        // ── Secure default ────────────────────────────────────────────────────
                        // Any new endpoint NOT listed above is denied by default.
                        // Developers must explicitly whitelist new routes here.
                        .anyRequest().denyAll())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Bean RestTemplate dùng chung để gọi các API bên ngoài (ví dụ: Google tokeninfo). */
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}