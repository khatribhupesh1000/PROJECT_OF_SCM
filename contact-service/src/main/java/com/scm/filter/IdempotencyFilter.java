package com.scm.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Idempotency-Key filter that caches POST responses and replays them on repeated network submissions (Checklist #4).
 */
@Component
@Order(20)
public class IdempotencyFilter extends OncePerRequestFilter {

    public static final String IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
    public static final String IDEMPOTENT_REPLAYED_HEADER = "X-Idempotent-Replayed";

    private record CachedResponse(int status, String contentType, String location, String etag, byte[] body) {
    }

    private final Map<String, CachedResponse> cache = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String idempotencyKey = request.getHeader(IDEMPOTENCY_KEY_HEADER);
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        String cacheKey = request.getRequestURI() + "::" + idempotencyKey.trim();
        CachedResponse existing = cache.get(cacheKey);
        if (existing != null) {
            response.setStatus(existing.status());
            if (existing.contentType() != null) {
                response.setContentType(existing.contentType());
            }
            if (existing.location() != null) {
                response.setHeader("Location", existing.location());
            }
            if (existing.etag() != null) {
                response.setHeader("ETag", existing.etag());
            }
            response.setHeader(IDEMPOTENCY_KEY_HEADER, idempotencyKey.trim());
            response.setHeader(IDEMPOTENT_REPLAYED_HEADER, "true");
            response.getOutputStream().write(existing.body());
            return;
        }

        ContentCachingResponseWrapper wrapper = new ContentCachingResponseWrapper(response);
        filterChain.doFilter(request, wrapper);

        int status = wrapper.getStatus();
        byte[] bodyBytes = wrapper.getContentAsByteArray();
        if (status >= 200 && status < 300) {
            cache.put(cacheKey, new CachedResponse(
                    status,
                    wrapper.getContentType(),
                    wrapper.getHeader("Location"),
                    wrapper.getHeader("ETag"),
                    bodyBytes
            ));
            wrapper.setHeader(IDEMPOTENCY_KEY_HEADER, idempotencyKey.trim());
            wrapper.setHeader(IDEMPOTENT_REPLAYED_HEADER, "false");
        }
        wrapper.copyBodyToResponse();
    }
}
