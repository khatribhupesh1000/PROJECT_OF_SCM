package com.scm.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = IntegrationServiceApplication.class)
@AutoConfigureMockMvc
class IntegrationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldReadWsdlExecuteSoapCallAndManageCircuitBreakerStates() throws Exception {
        // Reset breaker to CLOSED
        mockMvc.perform(post("/v1/resilience/state")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"CLOSED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("CLOSED"));

        // 1. Read WSDL XML document
        mockMvc.perform(get("/v1/soap/wsdl"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("TelecomDirectoryService")));

        // 2. Execute SOAP outbound call with SOAPAction header
        String soapPayload = objectMapper.writeValueAsString(Map.of(
                "operation", "VerifyPhoneNumber",
                "phoneNumber", "+919876543210"
        ));
        mockMvc.perform(post("/v1/soap/execute")
                        .header("SOAPAction", "http://scm.enterprise.io/ws/telecom/VerifyPhoneNumber")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(soapPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.outboundTimeoutMs").value(3000))
                .andExpect(jsonPath("$.circuitBreakerState").value("CLOSED"))
                .andExpect(jsonPath("$.soapResponseXml").value(containsString("VerifyPhoneNumberResponse")));

        // 3. Verify Circuit Breaker status endpoint (/v1/resilience/status)
        mockMvc.perform(get("/v1/resilience/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("CLOSED"))
                .andExpect(jsonPath("$.outboundTimeoutMs").value(3000));

        // 4. Transition to HALF_OPEN and OPEN states
        mockMvc.perform(post("/v1/resilience/state")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"HALF_OPEN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("HALF_OPEN"));

        mockMvc.perform(post("/v1/resilience/state")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"OPEN\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("OPEN"));

        // Reset back to CLOSED
        mockMvc.perform(post("/v1/resilience/state")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"CLOSED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("CLOSED"));
    }
}
