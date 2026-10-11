package com.scm.common.resilience;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Resilient 3-state Circuit Breaker (CLOSED, OPEN, HALF_OPEN) tracking failure thresholds
 * and automatic half-open recovery probes (Checklist #19).
 */
public class CircuitBreaker {

    public enum State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    private final String name;
    private final int failureThreshold;
    private final long resetTimeoutMs;
    private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
    private final AtomicInteger failureCount = new AtomicInteger(0);
    private final AtomicInteger successCount = new AtomicInteger(0);
    private final AtomicLong lastFailureTimeMs = new AtomicLong(0L);
    private final AtomicReference<String> lastTransitionAt = new AtomicReference<>(Instant.now().toString());

    public CircuitBreaker(String name, int failureThreshold, long resetTimeoutMs) {
        this.name = name;
        this.failureThreshold = failureThreshold;
        this.resetTimeoutMs = resetTimeoutMs;
    }

    public synchronized <T> T execute(Supplier<T> action) {
        evaluateStateTransition();
        if (state.get() == State.OPEN) {
            throw new IllegalStateException("Circuit breaker '" + name + "' is OPEN; fast-failing outbound request.");
        }
        try {
            T result = action.get();
            recordSuccess();
            return result;
        } catch (RuntimeException ex) {
            recordFailure();
            throw ex;
        }
    }

    public synchronized void evaluateStateTransition() {
        if (state.get() == State.OPEN) {
            long elapsed = System.currentTimeMillis() - lastFailureTimeMs.get();
            if (elapsed >= resetTimeoutMs) {
                transitionTo(State.HALF_OPEN);
            }
        }
    }

    public synchronized void recordSuccess() {
        successCount.incrementAndGet();
        failureCount.set(0);
        if (state.get() != State.CLOSED) {
            transitionTo(State.CLOSED);
        }
    }

    public synchronized void recordFailure() {
        int currentFailures = failureCount.incrementAndGet();
        lastFailureTimeMs.set(System.currentTimeMillis());
        if (state.get() == State.HALF_OPEN || currentFailures >= failureThreshold) {
            transitionTo(State.OPEN);
        }
    }

    public synchronized void forceState(State targetState) {
        if (targetState == State.CLOSED) {
            failureCount.set(0);
        } else if (targetState == State.OPEN) {
            failureCount.set(failureThreshold);
            lastFailureTimeMs.set(System.currentTimeMillis());
        }
        transitionTo(targetState);
    }

    private void transitionTo(State nextState) {
        state.set(nextState);
        lastTransitionAt.set(Instant.now().toString());
    }

    public State getState() {
        evaluateStateTransition();
        return state.get();
    }

    public int getFailureCount() {
        return failureCount.get();
    }

    public int getFailureThreshold() {
        return failureThreshold;
    }

    public Map<String, Object> getStatusMap() {
        evaluateStateTransition();
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("name", name);
        status.put("state", state.get().name());
        status.put("failureCount", failureCount.get());
        status.put("successCount", successCount.get());
        status.put("failureThreshold", failureThreshold);
        status.put("resetTimeoutMs", resetTimeoutMs);
        status.put("outboundTimeoutMs", 3000);
        status.put("retryAlgorithm", "delay * 2^attempt");
        status.put("lastTransitionAt", lastTransitionAt.get());
        return status;
    }
}
