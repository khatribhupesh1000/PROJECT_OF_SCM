package com.scm.common.error;

public class ResourceNotFoundException extends ApiException {
    public ResourceNotFoundException(String detail) {
        super(404, "Resource Not Found", detail);
    }
}
