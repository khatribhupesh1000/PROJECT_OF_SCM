package com.scm.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;

import java.time.Instant;
import java.util.Map;

/**
 * RFC 7807 Problem Details representation supporting both JSON (application/problem+json)
 * and XML (application/problem+xml) content negotiation.
 */
@JacksonXmlRootElement(localName = "problem")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiErrorResponse {

    @JacksonXmlProperty(localName = "type")
    private String type;

    @JacksonXmlProperty(localName = "title")
    private String title;

    @JacksonXmlProperty(localName = "status")
    private int status;

    @JacksonXmlProperty(localName = "detail")
    private String detail;

    @JacksonXmlProperty(localName = "instance")
    private String instance;

    @JacksonXmlProperty(localName = "timestamp")
    private String timestamp;

    @JacksonXmlProperty(localName = "correlationId")
    private String correlationId;

    @JacksonXmlProperty(localName = "errors")
    private Map<String, String> errors;

    public ApiErrorResponse() {
        this.timestamp = Instant.now().toString();
    }

    public ApiErrorResponse(String type, String title, int status, String detail, String instance, String correlationId) {
        this.type = type;
        this.title = title;
        this.status = status;
        this.detail = detail;
        this.instance = instance;
        this.timestamp = Instant.now().toString();
        this.correlationId = correlationId;
    }

    public static ApiErrorResponse of(int status, String title, String detail, String instance, String correlationId) {
        String slug = title == null ? "error" : title.toLowerCase().replaceAll("[^a-z0-9]+", "-");
        String typeUri = "https://scm.enterprise.io/problems/" + slug;
        return new ApiErrorResponse(typeUri, title, status, detail, instance, correlationId);
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getStatus() {
        return status;
    }

    public void setStatus(int status) {
        this.status = status;
    }

    public String getDetail() {
        return detail;
    }

    public void setDetail(String detail) {
        this.detail = detail;
    }

    public String getInstance() {
        return instance;
    }

    public void setInstance(String instance) {
        this.instance = instance;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public Map<String, String> getErrors() {
        return errors;
    }

    public void setErrors(Map<String, String> errors) {
        this.errors = errors;
    }
}
