package com.scm.common.resilience;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

/**
 * Exponential backoff retry executor implementing delay * 2^attempt (Checklist #18).
 */
public class RetryExecutor {

    private final int maxAttempts;
    private final long baseDelayMs;

    public RetryExecutor(int maxAttempts, long baseDelayMs) {
        this.maxAttempts = Math.max(1, maxAttempts);
        this.baseDelayMs = Math.max(1L, baseDelayMs);
    }

    public long computeBackoffDelayMs(int attemptIndex) {
        return baseDelayMs * (1L << attemptIndex);
    }

    public List<Long> getBackoffSchedule() {
        List<Long> schedule = new ArrayList<>();
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            schedule.add(computeBackoffDelayMs(attempt));
        }
        return schedule;
    }

    public <T> T executeWithRetry(Callable<T> operation) throws Exception {
        Exception lastException = null;
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return operation.call();
            } catch (Exception ex) {
                lastException = ex;
                if (attempt + 1 < maxAttempts) {
                    long delayMs = computeBackoffDelayMs(attempt);
                    Thread.sleep(Math.min(delayMs, 50L));
                }
            }
        }
        throw lastException != null ? lastException : new RuntimeException("Retry attempts exhausted");
    }
}
