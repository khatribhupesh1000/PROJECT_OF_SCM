package com.scm.common.error;

public class UnauthorizedException extends ApiException {
    public UnauthorizedException(String detail) {
        super(401, "Unauthorized", detail);
    }
}
