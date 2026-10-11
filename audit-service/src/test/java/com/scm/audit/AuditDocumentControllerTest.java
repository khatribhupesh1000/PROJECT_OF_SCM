package com.scm.audit;

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

@SpringBootTest(classes = AuditServiceApplication.class)
@AutoConfigureMockMvc
class AuditDocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldStoreRetrieveAndDeleteSchemalessNoSqlDocuments() throws Exception {
        String payload = objectMapper.writeValueAsString(Map.of(
                "event", "CONTACT_CREATED",
                "actorEmail", "rahul@scm.enterprise.io",
                "metadata", Map.of("ip", "127.0.0.1", "userAgent", "SCM-Web")
        ));

        MvcResult postResult = mockMvc.perform(post("/v1/documents/audit-logs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(jsonPath("$._id").isNotEmpty())
                .andExpect(jsonPath("$._collection").value("audit-logs"))
                .andReturn();

        @SuppressWarnings("unchecked")
        Map<String, Object> created = objectMapper.readValue(postResult.getResponse().getContentAsString(), Map.class);
        String docId = (String) created.get("_id");

        mockMvc.perform(get("/v1/documents/audit-logs/" + docId))
                .andExpect(status().isOk())
                .andExpect(header().exists("Cache-Control"))
                .andExpect(jsonPath("$.event").value("CONTACT_CREATED"));

        mockMvc.perform(get("/v1/documents/audit-logs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.collection").value("audit-logs"));

        mockMvc.perform(delete("/v1/documents/audit-logs/" + docId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/v1/documents/audit-logs/" + docId))
                .andExpect(status().isNotFound());
    }
}
