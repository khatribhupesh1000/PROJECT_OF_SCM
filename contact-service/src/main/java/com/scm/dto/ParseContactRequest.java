package com.scm.dto;

public class ParseContactRequest {
    private String rawText;

    public ParseContactRequest() {}

    public ParseContactRequest(String rawText) {
        this.rawText = rawText;
    }

    public String getRawText() {
        return rawText;
    }

    public void setRawText(String rawText) {
        this.rawText = rawText;
    }
}
