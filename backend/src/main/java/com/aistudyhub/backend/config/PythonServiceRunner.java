package com.aistudyhub.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;
import org.springframework.boot.web.client.RestTemplateBuilder;
import java.time.Duration;

@Configuration
public class PythonServiceRunner {

    @Bean
    public RestTemplate aiServiceRestTemplate(RestTemplateBuilder builder) {
        return builder
            .setConnectTimeout(Duration.ofMillis(5000))
            .setReadTimeout(Duration.ofMillis(60000))
            .build();
    }
}
