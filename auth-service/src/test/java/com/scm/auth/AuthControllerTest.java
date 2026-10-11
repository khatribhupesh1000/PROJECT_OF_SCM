package com.scm.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = AuthServiceApplication.class)
@AutoConfigureMockMvc
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldRegisterUserIssueJwtAndEnforceRbac() throws Exception {
        // 1. Register standard user (201 Created)
        String registerPayload = objectMapper.writeValueAsString(Map.of(
                "name", "Rahul Sharma",
                "email", "rahul@scm.enterprise.io",
                "password", "SecurePass123!",
                "phoneNumber", "+919876543210"
        ));

        MvcResult regResult = mockMvc.perform(post("/v1/auth/users")
                        .header("X-Correlation-ID", "test-auth-corr-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerPayload))
                .andExpect(status().isCreated())
                .andExpect(header().string("X-Correlation-ID", "test-auth-corr-1"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value("rahul@scm.enterprise.io"))
                .andReturn();

        @SuppressWarnings("unchecked")
        Map<String, Object> regBody = objectMapper.readValue(regResult.getResponse().getContentAsString(), Map.class);
        String userToken = (String) regBody.get("accessToken");

        // 2. Issue token via POST /v1/auth/tokens (201 Created)
        String loginPayload = objectMapper.writeValueAsString(Map.of(
                "email", "rahul@scm.enterprise.io",
                "password", "SecurePass123!"
        ));
        mockMvc.perform(post("/v1/auth/tokens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());

        // 3. Invalid password returns 401 Unauthorized with RFC 7807 Problem Details
        String badLogin = objectMapper.writeValueAsString(Map.of(
                "email", "rahul@scm.enterprise.io",
                "password", "WrongPassword"
        ));
        mockMvc.perform(post("/v1/auth/tokens")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(badLogin))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.correlationId").isNotEmpty());

        // 4. Standard ROLE_USER accessing /v1/auth/admin/users receives 403 Forbidden
        mockMvc.perform(get("/v1/auth/admin/users")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));

        // 5. Register ROLE_ADMIN user and access /v1/auth/admin/users (200 OK)
        String adminPayload = objectMapper.writeValueAsString(Map.of(
                "name", "Admin User",
                "email", "admin@scm.enterprise.io",
                "password", "AdminSecret123!",
                "role", "ROLE_ADMIN"
        ));
        MvcResult adminReg = mockMvc.perform(post("/v1/auth/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(adminPayload))
                .andExpect(status().isCreated())
                .andReturn();
        @SuppressWarnings("unchecked")
        Map<String, Object> adminBody = objectMapper.readValue(adminReg.getResponse().getContentAsString(), Map.class);
        String adminToken = (String) adminBody.get("accessToken");

        mockMvc.perform(get("/v1/auth/admin/users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(header().exists("Cache-Control"));

        // 6. Google OAuth2 redirect returns 302 Found
        mockMvc.perform(get("/v1/auth/oauth2/google"))
                .andExpect(status().isFound())
                .andExpect(header().exists("Location"));

        // 7. Revoke token returns 204 No Content
        mockMvc.perform(delete("/v1/auth/tokens"))
                .andExpect(status().isNoContent());
    }
}
