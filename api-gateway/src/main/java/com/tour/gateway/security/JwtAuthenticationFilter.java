package com.tour.gateway.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Set;

@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {
    private static final Set<String> MANAGEMENT_ROLES = Set.of("ADMIN", "TRAVEL_MANAGER", "STAFF");
    private static final Set<String> CUSTOMER_ROLES = Set.of("CUSTOMER", "ADMIN", "TRAVEL_MANAGER", "STAFF");

    @Value("${app.jwt.secret}")
    private String secret;

    private SecretKey key;

    @PostConstruct
    void init() {
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        String method = exchange.getRequest().getMethod() != null ? exchange.getRequest().getMethod().name() : "GET";

        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        String header = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            return unauthorized(exchange, "Missing or invalid Authorization header");
        }

        Claims claims;
        try {
            claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(header.substring(7)).getPayload();
        } catch (Exception ex) {
            return unauthorized(exchange, "Invalid or expired token");
        }

        Object rawRoles = claims.get("roles");
        Set<String> roles = rawRoles instanceof Collection<?> roleCollection
                ? roleCollection.stream().map(String::valueOf).collect(java.util.stream.Collectors.toSet())
                : Set.of();
        String userEmail = claims.getSubject();
        String userId = String.valueOf(claims.get("userId"));

        if (!hasAccess(path, method, roles)) {
            return forbidden(exchange, "Access denied for your role");
        }

        ServerHttpRequest enrichedRequest = exchange.getRequest().mutate()
                .header("X-User-Email", userEmail == null ? "" : userEmail)
                .header("X-User-Id", userId)
                .header("X-User-Roles", String.join(",", roles))
                .build();
        return chain.filter(exchange.mutate().request(enrichedRequest).build());
    }

    @Override
    public int getOrder() {
        return -100;
    }

    private boolean isPublicPath(String path) {
        return path.startsWith("/auth/login")
                || path.startsWith("/auth/register")
                || path.startsWith("/auth/forgot-password/")
                || path.startsWith("/actuator");
    }

    private boolean hasAccess(String path, String method, Set<String> roles) {
        if (path.startsWith("/users/me")) {
            return hasAnyRole(roles, CUSTOMER_ROLES);
        }
        if (path.startsWith("/users")) {
            return hasAnyRole(roles, MANAGEMENT_ROLES);
        }
        if (path.startsWith("/admin")) {
            return hasAnyRole(roles, MANAGEMENT_ROLES);
        }
        if (path.startsWith("/bookings")) {
            return hasAnyRole(roles, CUSTOMER_ROLES);
        }
        if (path.startsWith("/payments") || path.startsWith("/invoices")) {
            return hasAnyRole(roles, CUSTOMER_ROLES);
        }
        if (path.startsWith("/destinations") || path.startsWith("/tours") || path.startsWith("/schedules")) {
            if ("GET".equalsIgnoreCase(method)) {
                return hasAnyRole(roles, CUSTOMER_ROLES);
            }
            return hasAnyRole(roles, MANAGEMENT_ROLES);
        }
        return hasAnyRole(roles, CUSTOMER_ROLES);
    }

    private boolean hasAnyRole(Set<String> userRoles, Set<String> allowed) {
        return userRoles.stream().anyMatch(allowed::contains);
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String error) {
        return writeError(exchange.getResponse(), HttpStatus.UNAUTHORIZED, error);
    }

    private Mono<Void> forbidden(ServerWebExchange exchange, String error) {
        return writeError(exchange.getResponse(), HttpStatus.FORBIDDEN, error);
    }

    private Mono<Void> writeError(ServerHttpResponse response, HttpStatus status, String error) {
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        String payload = """
                {"timestamp":"%s","status":%d,"error":"%s"}
                """.formatted(LocalDateTime.now(), status.value(), error);
        DataBuffer buffer = response.bufferFactory().wrap(payload.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }
}
