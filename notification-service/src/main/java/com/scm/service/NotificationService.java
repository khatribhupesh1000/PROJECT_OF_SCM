package com.scm.service;

import com.scm.common.error.UnprocessableEntityException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Resilient Mail Dispatching Service (Mandate #3):
 * Wraps all JavaMailSender calls in try-catch so SMTP timeouts or authentication errors
 * never block registration, password reset, or security alert workflows.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final JavaMailSender mailSender;
    private final List<Map<String, Object>> dispatchLog = new CopyOnWriteArrayList<>();

    @Value("${spring.mail.from:noreply@scm-enterprise.io}")
    private String fromAddress;

    @Value("${notification.smtp.enabled:false}")
    private boolean smtpEnabled;

    public NotificationService(@Autowired(required = false) JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public Map<String, Object> sendEmailResiliently(Map<String, Object> request) {
        String to = request.get("to") != null ? String.valueOf(request.get("to")).trim() : "";
        String type = request.get("type") != null ? String.valueOf(request.get("type")).trim() : "ALERT";
        String subject = request.get("subject") != null
                ? String.valueOf(request.get("subject"))
                : "Smart Contact Manager Notification [" + type + "]";
        String body = request.get("body") != null
                ? String.valueOf(request.get("body"))
                : "Hello from Smart Contact Manager Enterprise!";

        if (to.isEmpty() || !to.contains("@")) {
            throw new UnprocessableEntityException("A valid recipient 'to' email address is required.");
        }

        String id = "ntf-" + UUID.randomUUID();
        String status = "DELIVERED";
        String errorDetail = null;

        try {
            if (mailSender != null && smtpEnabled) {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromAddress);
                message.setTo(to);
                message.setSubject(subject);
                message.setText(body);
                mailSender.send(message);
            } else {
                status = "QUEUED_RESILIENT_FALLBACK";
            }
        } catch (Exception ex) {
            // Mandate #3: Never propagate SMTP timeouts or auth errors to callers
            log.warn("SMTP dispatch failed for recipient {} (type {}): {}. Recording resilient fallback.",
                    to, type, ex.getMessage());
            status = "QUEUED_RESILIENT_FALLBACK";
            errorDetail = ex.getMessage();
        }

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("id", id);
        record.put("to", to);
        record.put("type", type);
        record.put("subject", subject);
        record.put("status", status);
        if (errorDetail != null) {
            record.put("fallbackReason", errorDetail);
        }
        record.put("dispatchedAt", Instant.now().toString());
        dispatchLog.add(record);
        return record;
    }

    public List<Map<String, Object>> listNotifications() {
        return new ArrayList<>(dispatchLog);
    }
}
