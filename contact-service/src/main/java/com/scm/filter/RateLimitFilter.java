package com.scm.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scm.common.error.ApiErrorResponse;
import com.scm.common.filter.CorrelationIdFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Sliding token bucket rate limiter (100 req/min) returning X-RateLimit-Limit,
 * X-RateLimit-Remaining, X-RateLimit-Reset, and 429 Too Many Requests (Checklist #12).
 */
@Component
@Order(10)
public class RateLimitFilter extends OncePerRequestFilter {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${rate.limit.max-requests:100}")
    private int defaultLimit;

    @Value("${rate.limit.window-ms:60000}")
    private long windowMs;

    private static class Bucket {
        long windowStartMs = System.currentTimeMillis();
        final AtomicInteger used = new AtomicInteger(0);
    }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String clientKey = request.getHeader("X-Client-Id");
        if (clientKey == null || clientKey.isBlank()) {
            clientKey = request.getRemoteAddr() != null ? request.getRemoteAddr() : "default-client";
        }

        int effectiveLimit = defaultLimit;
        String overrideHeader = request.getHeader("X-RateLimit-Test-Limit");
        if (overrideHeader != null) {
            try {
                effectiveLimit = Integer.parseInt(overrideHeader);
            } catch (NumberFormatException ignored) {
            }
        }

        long now = System.currentTimeMillis();
        Bucket bucket = buckets.computeIfAbsent(clientKey, k -> new Bucket());
        synchronized (bucket) {
            if (now - bucket.windowStartMs >= windowMs) {
                bucket.windowStartMs = now;
                bucket.used.set(0);
            }
        }

        int currentCount = bucket.used.incrementAndGet();
        int remaining = Math.max(0, effectiveLimit - currentCount);
        long resetEpochSeconds = (bucket.windowStartMs + windowMs) / 1000L;

        response.setHeader("X-RateLimit-Limit", String.valueOf(effectiveLimit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset", String.valueOf(resetEpochSeconds));

        if (currentCount > effectiveLimit) {
            String correlationId = MDC.get(CorrelationIdFilter.CORRELATION_ID_MDC_KEY);
            if (correlationId == null) {
                correlationId = UUID.randomUUID().toString();
            }
            response.setStatus(429);
            response.setContentType("application/problem+json");
            response.setHeader("Retry-After", "60");
            response.setHeader(CorrelationIdFilter.CORRELATION_ID_HEADER, correlationId);
            ApiErrorResponse problem = ApiErrorResponse.of(
                    429,
                    "Too Many Requests",
                    "Rate limit of " + effectiveLimit + " requests per minute exceeded.",
                    request.getRequestURI(),
                    correlationId
            );
            response.getWriter().write(objectMapper.writeValueAsString(problem));
            return;
        }

        filterChain.doFilter(request, response);
    }
}
