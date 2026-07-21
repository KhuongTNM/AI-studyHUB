package com.aistudyhub.backend.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        final String securitySchemeName = "bearerAuth";
        return new OpenAPI()
                .info(new Info()
                        .title("AI Study Hub# 1. Kích hoạt môi trường ảo bằng script của PowerShell\n" +
                                ".\\.venv\\Scripts\\Activate.ps1\n" +
                                "\n" +
                                "# 2. Khởi động lại server AI cổng 8000\n" +
                                "uvicorn main:app --reload --port 8000\n API")
                        .version("1.0.0")
                        .description("Tài liệu API tích hợp môi trường thử nghiệm"))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName,
                                new SecurityScheme()
                                        .name(securitySchemeName)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")));
    }
}