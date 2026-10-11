package com.scm.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.scm.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = NotificationServiceApplication.class)
@AutoConfigureMockMvc
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldDispatchEmailResilientlyWithoutThrowingOnSmtpFailure() throws Exception {
        // 1. Test controller endpoint
        String payload = objectMapper.writeValueAsString(Map.of(
                "to", "user@scm.enterprise.io",
                "type", "WELCOME",
                "subject", "Welcome to SCM!"
        ));

        mockMvc.perform(post("/v1/notifications/emails")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$.to").value("user@scm.enterprise.io"));

        mockMvc.perform(get("/v1/notifications/emails"))
                .andExpect(status().isOk())
                .andExpect(header().exists("Cache-Control"));

        // 2. Directly verify Mandate #3: SMTP exception is caught and never blocks caller
        JavaMailSender failingSender = mock(JavaMailSender.class);
        doThrow(new MailSendException("SMTP timeout after 3000ms")).when(failingSender).send(any(SimpleMailMessage.class));

        NotificationService resilientService = new NotificationService(failingSender);
        ReflectionTestUtils.setField(resilientService, "smtpEnabled", true);
        ReflectionTestUtils.setField(resilientService, "fromAddress", "noreply@scm.io");

        Map<String, Object> result = resilientService.sendEmailResiliently(Map.of(
                "to", "resilient@scm.enterprise.io",
                "type", "RESET"
        ));
        assertEquals("QUEUED_RESILIENT_FALLBACK", result.get("status"));
    }
}
