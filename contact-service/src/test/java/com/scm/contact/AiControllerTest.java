package com.scm.contact;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = ContactServiceApplication.class)
@AutoConfigureMockMvc
class AiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldParseUnstructuredContactTextSuccessfully() throws Exception {
        String payload = objectMapper.writeValueAsString(Map.of(
                "rawText", "Met Rahul Sharma, VP at FinTech Labs, call him at +91 9812345678, email rahul@fintech.io, located in New Delhi"
        ));

        mockMvc.perform(post("/v1/ai/parse-contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Rahul Sharma")))
                .andExpect(jsonPath("$.email", is("rahul@fintech.io")))
                .andExpect(jsonPath("$.phoneNumber", is("+919812345678")))
                .andExpect(jsonPath("$.company", is("FinTech Labs")))
                .andExpect(jsonPath("$.role", containsString("VP")))
                .andExpect(jsonPath("$.address", containsString("New Delhi")))
                .andExpect(jsonPath("$.tag", is("Lead")));
    }

    @Test
    void shouldDraftEmailWithAiSuccessfully() throws Exception {
        String payload = objectMapper.writeValueAsString(Map.of(
                "contactName", "Rahul Sharma",
                "company", "FinTech Labs",
                "prompt", "Follow up on yesterday's contract proposal"
        ));

        mockMvc.perform(post("/v1/ai/draft-email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subject", containsString("Contract & Proposal")))
                .andExpect(jsonPath("$.body", containsString("Hi Rahul Sharma,")))
                .andExpect(jsonPath("$.body", containsString("contract proposal")));
    }

    @Test
    void shouldReturnBadRequestWhenRawTextMissing() throws Exception {
        mockMvc.perform(post("/v1/ai/parse-contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title", is("Bad Request")));
    }
}
