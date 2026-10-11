package com.scm.common.error;

public class BadRequestException extends ApiException {
    public BadRequestException(String detail) {
        super(400, "Bad Request", detail);
    }
}
