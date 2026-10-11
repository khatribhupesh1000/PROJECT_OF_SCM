package com.scm.common.error;

import java.util.Map;

public class ApiException extends RuntimeException {

    private final int status;
    private final String title;
    private final String type;
    private final Map<String, String> errors;

    public ApiException(int status, String title, String detail) {
        this(status, title, detail, null);
    }

    public ApiException(int status, String title, String detail, Map<String, String> errors) {
        super(detail);
        this.status = status;
        this.title = title;
        String slug = title == null ? "error" : title.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        this.type = "https://scm.enterprise.io/problems/" + slug;
        this.errors = errors;
    }

    public int getStatus() {
        return status;
    }

    public String getTitle() {
        return title;
    }

    public String getType() {
        return type;
    }

    public Map<String, String> getErrors() {
        return errors;
    }
}
