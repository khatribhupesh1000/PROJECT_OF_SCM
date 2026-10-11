package com.scm.dto;

public class DraftEmailRequest {
    private String contactName;
    private String company;
    private String prompt;
    private String senderName;

    public DraftEmailRequest() {}

    public DraftEmailRequest(String contactName, String company, String prompt) {
        this.contactName = contactName;
        this.company = company;
        this.prompt = prompt;
    }

    public DraftEmailRequest(String contactName, String company, String prompt, String senderName) {
        this.contactName = contactName;
        this.company = company;
        this.prompt = prompt;
        this.senderName = senderName;
    }

    public String getContactName() {
        return contactName;
    }

    public void setContactName(String contactName) {
        this.contactName = contactName;
    }

    public String getCompany() {
        return company;
    }

    public void setCompany(String company) {
        this.company = company;
    }

    public String getPrompt() {
        return prompt;
    }

    public void setPrompt(String prompt) {
        this.prompt = prompt;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }
}
