package com.scm.common;

import com.scm.common.error.ApiErrorResponse;
import com.scm.common.resilience.CircuitBreaker;
import com.scm.common.resilience.RetryExecutor;
import com.scm.common.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class CommonLibTest {

    @Test
    void shouldCreateRfc7807ProblemDetails() {
        ApiErrorResponse problem = ApiErrorResponse.of(
                422,
                "Unprocessable Entity",
                "Invalid phone number format",
                "/v1/contacts",
                "corr-123"
        );
        assertEquals("https://scm.enterprise.io/problems/unprocessable-entity", problem.getType());
        assertEquals("Unprocessable Entity", problem.getTitle());
        assertEquals(422, problem.getStatus());
        assertEquals("Invalid phone number format", problem.getDetail());
        assertEquals("/v1/contacts", problem.getInstance());
        assertEquals("corr-123", problem.getCorrelationId());
        assertNotNull(problem.getTimestamp());
    }

    @Test
    void shouldIssueAndVerifyHmacSha256JwtToken() {
        JwtTokenProvider provider = new JwtTokenProvider();
        String token = provider.generateToken("usr-1", "alice@scm.io", "Alice", List.of("ROLE_USER", "ROLE_ADMIN"));
        assertNotNull(token);

        Claims claims = provider.validateAndParseClaims(token);
        assertEquals("alice@scm.io", claims.getSubject());
        assertEquals("usr-1", claims.get("userId"));
        assertTrue(provider.extractRoles(token).contains("ROLE_ADMIN"));
    }

    @Test
    void shouldTransitionCircuitBreakerThroughClosedOpenHalfOpen() {
        CircuitBreaker breaker = new CircuitBreaker("soap-bridge", 2, 10L);
        assertEquals(CircuitBreaker.State.CLOSED, breaker.getState());

        breaker.recordFailure();
        assertEquals(CircuitBreaker.State.CLOSED, breaker.getState());

        breaker.recordFailure();
        assertEquals(CircuitBreaker.State.OPEN, breaker.getState());

        try {
            Thread.sleep(20L);
        } catch (InterruptedException ignored) {
        }
        assertEquals(CircuitBreaker.State.HALF_OPEN, breaker.getState());

        breaker.recordSuccess();
        assertEquals(CircuitBreaker.State.CLOSED, breaker.getState());
    }

    @Test
    void shouldComputeExponentialBackoffAndRetry() throws Exception {
        RetryExecutor retryExecutor = new RetryExecutor(3, 100L);
        assertEquals(List.of(100L, 200L, 400L), retryExecutor.getBackoffSchedule());

        AtomicInteger attempts = new AtomicInteger(0);
        String result = retryExecutor.executeWithRetry(() -> {
            if (attempts.incrementAndGet() < 3) {
                throw new RuntimeException("Transient network error");
            }
            return "SUCCESS";
        });
        assertEquals("SUCCESS", result);
        assertEquals(3, attempts.get());
    }
}
