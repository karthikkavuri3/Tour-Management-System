package com.tour.auth.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppBeansConfig {
    @Bean
    RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
