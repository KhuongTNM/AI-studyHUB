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
    private String rawUrl;

    // Chỉ dùng cho LOCAL (không có embedded credentials trong URL)
    @Value("${app.datasource.username:}")
    private String username;

    @Value("${app.datasource.password:}")
    private String password;

    @Bean
    public DataSource dataSource() {
        // Bỏ prefix "jdbc:" nếu có để parse thống nhất
        String normalized = rawUrl.startsWith("jdbc:") ? rawUrl.substring(5) : rawUrl;

        String finalJdbcUrl;
        String finalUsername;
        String finalPassword;

        if (normalized.contains("@")) {
            // URL có embedded credentials, ví dụ:
            //   postgresql://postgres:MyPass@123@db.xxx.supabase.co:5432/postgres
            // Dùng lastIndexOf('@') để xử lý đúng password chứa ký tự '@'
            String withoutScheme = normalized.replaceFirst("^postgresql://", "");
            int lastAt = withoutScheme.lastIndexOf('@');
            String userInfo = withoutScheme.substring(0, lastAt);   // "postgres:MyPass@123"
            String hostPart = withoutScheme.substring(lastAt + 1);  // "db.xxx...:5432/postgres"

            int firstColon = userInfo.indexOf(':');
            finalUsername = userInfo.substring(0, firstColon);
            finalPassword = userInfo.substring(firstColon + 1);

            // Tự thêm sslmode=require nếu chưa có (Supabase bắt buộc SSL)
            if (!hostPart.contains("sslmode")) {
                hostPart += (hostPart.contains("?") ? "&" : "?") + "sslmode=require";
            }
            finalJdbcUrl = "jdbc:postgresql://" + hostPart;
        } else {
            // URL không có credentials — LOCAL (localhost)
            finalJdbcUrl  = "jdbc:" + normalized;
            finalUsername = username;
            finalPassword = password;
        }

        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(finalJdbcUrl);
        config.setUsername(finalUsername);
        config.setPassword(finalPassword);
        config.setDriverClassName("org.postgresql.Driver");
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setPoolName("AIStudyHubPool");

        // Set search_path để native queries trong TagRepository không cần schema prefix
        config.setConnectionInitSql(
            "SET search_path TO docs, core, ai, payment, group_chat, public"
        );

        // Cấu hình timeout cho production (quan trọng với Supabase pgBouncer)
        config.setConnectionTimeout(30_000);
        config.setIdleTimeout(600_000);
        config.setMaxLifetime(1_800_000);
        config.setKeepaliveTime(60_000);

        return new HikariDataSource(config);
    }
}
