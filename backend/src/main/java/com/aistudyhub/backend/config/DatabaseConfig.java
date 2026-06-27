package com.aistudyhub.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DatabaseConfig {

    @Value("${app.datasource.url}")
    private String jdbcUrl;

    @Value("${app.datasource.username}")
    private String username;

    @Value("${app.datasource.password}")
    private String password;

    @Bean
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setUsername(username);
        config.setPassword(password);
        // Đã đổi từ SQLServerDriver sang PostgreSQL driver
        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setPoolName("AIStudyHubPool");

        // [FIX] Set search_path để native queries trong TagRepository không cần
        // viết đầy đủ schema prefix (docs.tags, docs.document_tags, docs.documents).
        // Bao gồm tất cả 5 schema đang dùng + public để fallback.
        config.setConnectionInitSql(
            "SET search_path TO docs, core, ai, payment, group_chat, public"
        );

        // [FIX] Cấu hình timeout cho production (Render / Supabase pgBouncer).
        // maxLifetime đặc biệt quan trọng: pgBouncer kill connection sau ~1h,
        // nếu không set thì app sẽ gặp lỗi "connection closed unexpectedly".
        config.setConnectionTimeout(30_000);   // 30s: thời gian tối đa chờ lấy connection từ pool
        config.setIdleTimeout(600_000);        // 10 phút: connection nhàn rỗi bị đóng
        config.setMaxLifetime(1_800_000);      // 30 phút: vòng đời tối đa của một connection
        config.setKeepaliveTime(60_000);       // 1 phút: ping giữ connection sống qua firewall/NAT

        return new HikariDataSource(config);
    }
}
