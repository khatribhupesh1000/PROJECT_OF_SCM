package com.scm.controller;

import com.scm.service.NotificationService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/v1/notifications/emails")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> dispatchEmail(@RequestBody Map<String, Object> payload) {
        Map<String, Object> result = notificationService.sendEmailResiliently(payload);
        return ResponseEntity.status(HttpStatus.CREATED)
                .location(URI.create("/v1/notifications/emails/" + result.get("id")))
                .body(result);
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listDispatchedEmails() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .body(notificationService.listNotifications());
    }
}
