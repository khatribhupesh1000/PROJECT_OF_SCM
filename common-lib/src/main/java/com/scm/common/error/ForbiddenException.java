package com.scm.common.error;

public class ForbiddenException extends ApiException {
    public ForbiddenException(String detail) {
        super(403, "Forbidden", detail);
    }
}
