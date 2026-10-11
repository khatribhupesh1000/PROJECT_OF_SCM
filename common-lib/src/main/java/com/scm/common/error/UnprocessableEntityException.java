package com.scm.common.error;

import java.util.Map;

public class UnprocessableEntityException extends ApiException {
    public UnprocessableEntityException(String detail) {
        super(422, "Unprocessable Entity", detail);
    }

    public UnprocessableEntityException(String detail, Map<String, String> errors) {
        super(422, "Unprocessable Entity", detail, errors);
    }
}
