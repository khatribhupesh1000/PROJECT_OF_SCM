package com.scm.dto;

public class DraftEmailResponse {
    private String subject;
    private String body;

    public DraftEmailResponse() {}

    public DraftEmailResponse(String subject, String body) {
        this.subject = subject;
        this.body = body;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }
}
