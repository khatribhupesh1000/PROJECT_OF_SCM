package com.scm.common.error;

import com.scm.common.filter.CorrelationIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final MediaType PROBLEM_JSON = MediaType.parseMediaType("application/problem+json");
    private static final MediaType PROBLEM_XML = MediaType.parseMediaType("application/problem+xml");

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        ApiErrorResponse problem = new ApiErrorResponse(
                ex.getType(),
                ex.getTitle(),
                ex.getStatus(),
                ex.getMessage(),
                request.getRequestURI(),
                correlationId
        );
        problem.setErrors(ex.getErrors());
        return buildProblemResponse(problem, request, correlationId);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        ApiErrorResponse problem = ApiErrorResponse.of(
                422,
                "Unprocessable Entity",
                "Payload failed semantic schema validation.",
                request.getRequestURI(),
                correlationId
        );
        problem.setErrors(fieldErrors);
        return buildProblemResponse(problem, request, correlationId);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleMalformedJson(
            HttpMessageNotReadableException ex,
            HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        ApiErrorResponse problem = ApiErrorResponse.of(
                400,
                "Bad Request",
                "Malformed request payload syntax.",
                request.getRequestURI(),
                correlationId
        );
        return buildProblemResponse(problem, request, correlationId);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleMaxUploadSize(
            MaxUploadSizeExceededException ex,
            HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        ApiErrorResponse problem = ApiErrorResponse.of(
                422,
                "Unprocessable Entity",
                "Uploaded media exceeds the maximum allowed size of 2MB (2097152 bytes).",
                request.getRequestURI(),
                correlationId
        );
        return buildProblemResponse(problem, request, correlationId);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        String correlationId = resolveCorrelationId(request);
        ApiErrorResponse problem = ApiErrorResponse.of(
                500,
                "Internal Server Error",
                ex.getMessage() != null ? ex.getMessage() : "An unexpected error occurred.",
                request.getRequestURI(),
                correlationId
        );
        return buildProblemResponse(problem, request, correlationId);
    }

    private ResponseEntity<ApiErrorResponse> buildProblemResponse(
            ApiErrorResponse problem,
            HttpServletRequest request,
            String correlationId) {
        String accept = request.getHeader(HttpHeaders.ACCEPT);
        MediaType contentType = (accept != null && accept.contains("xml")) ? PROBLEM_XML : PROBLEM_JSON;
        return ResponseEntity.status(problem.getStatus())
                .contentType(contentType)
                .header(CorrelationIdFilter.CORRELATION_ID_HEADER, correlationId)
                .body(problem);
    }

    private String resolveCorrelationId(HttpServletRequest request) {
        String fromMdc = MDC.get(CorrelationIdFilter.CORRELATION_ID_MDC_KEY);
        if (fromMdc != null && !fromMdc.isBlank()) {
            return fromMdc;
        }
        Object attr = request.getAttribute(CorrelationIdFilter.CORRELATION_ID_MDC_KEY);
        if (attr != null) {
            return attr.toString();
        }
        String header = request.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER);
        if (header != null && !header.isBlank()) {
            return header;
        }
        return UUID.randomUUID().toString();
    }
}
