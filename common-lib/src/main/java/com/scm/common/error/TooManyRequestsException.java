package com.scm.common.error;

public class TooManyRequestsException extends ApiException {
    public TooManyRequestsException(String detail) {
        super(429, "Too Many Requests", detail);
    }
}
