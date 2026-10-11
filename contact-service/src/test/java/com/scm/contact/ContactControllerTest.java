package com.scm.contact;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = ContactServiceApplication.class)
@AutoConfigureMockMvc
class ContactControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void shouldSupportAllSevenHttpMethodsEtagIdempotencyPaginationXmlAndGraphQL() throws Exception {
        // 1. OPTIONS /v1/contacts
        mockMvc.perform(options("/v1/contacts"))
                .andExpect(status().isOk())
                .andExpect(header().string("Allow", containsString("PATCH")));

        // 2. HEAD /v1/contacts
        mockMvc.perform(head("/v1/contacts"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Total-Count"))
                .andExpect(header().string("Cache-Control", containsString("max-age=60")));

        // 3. POST /v1/contacts with Idempotency-Key (201 Created + replay)
        String payload = objectMapper.writeValueAsString(Map.of(
                "name", "Ananya Verma",
                "email", "ananya.verma@scm.enterprise.io",
                "phoneNumber", "+919988776655",
                "address", "Hitech City, Hyderabad",
                "favorite", true
        ));

        MvcResult post1 = mockMvc.perform(post("/v1/contacts")
                        .header("Idempotency-Key", "idem-key-101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(header().exists("Location"))
                .andExpect(header().string("X-Idempotent-Replayed", "false"))
                .andReturn();

        @SuppressWarnings("unchecked")
        Map<String, Object> created = objectMapper.readValue(post1.getResponse().getContentAsString(), Map.class);
        String contactId = (String) created.get("id");

        // Replay with identical Idempotency-Key
        mockMvc.perform(post("/v1/contacts")
                        .header("Idempotency-Key", "idem-key-101")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(header().string("X-Idempotent-Replayed", "true"))
                .andExpect(jsonPath("$.id").value(contactId));

        // 4. GET /v1/contacts/{id} with ETag and 304 Not Modified
        MvcResult getRes = mockMvc.perform(get("/v1/contacts/" + contactId))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"))
                .andExpect(header().string("Cache-Control", containsString("max-age=300")))
                .andReturn();

        String etag = getRes.getResponse().getHeader("ETag");
        mockMvc.perform(get("/v1/contacts/" + contactId)
                        .header("If-None-Match", etag))
                .andExpect(status().isNotModified());

        // 5. Content Negotiation: GET /v1/contacts/{id} as application/xml
        mockMvc.perform(get("/v1/contacts/" + contactId)
                        .accept(MediaType.APPLICATION_XML))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_XML))
                .andExpect(content().string(containsString("<Contact>")));

        // 6. Cursor Pagination with Link rel="next" header
        mockMvc.perform(get("/v1/contacts").param("limit", "1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Link", containsString("rel=\"next\"")))
                .andExpect(jsonPath("$.nextCursor").isNotEmpty());

        // 7. PUT /v1/contacts/{id}
        String putPayload = objectMapper.writeValueAsString(Map.of(
                "name", "Ananya Verma Updated",
                "email", "ananya.verma@scm.enterprise.io",
                "phoneNumber", "+919988776655"
        ));
        mockMvc.perform(put("/v1/contacts/" + contactId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(putPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Ananya Verma Updated"));

        // 8. PATCH /v1/contacts/{id}
        String patchPayload = objectMapper.writeValueAsString(Map.of("favorite", false));
        mockMvc.perform(patch("/v1/contacts/" + contactId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(patchPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.favorite").value(false));

        // 9. GET /v1/contacts/{id}/vcard -> 302 Found
        mockMvc.perform(get("/v1/contacts/" + contactId + "/vcard"))
                .andExpect(status().isFound())
                .andExpect(header().exists("Location"));

        // 10. GraphQL query and __schema introspection
        String gqlQuery = objectMapper.writeValueAsString(Map.of(
                "query", "{ __schema { queryType { name } } contacts { id name email } }"
        ));
        mockMvc.perform(post("/graphql")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(gqlQuery))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.__schema.queryType.name").value("Query"))
                .andExpect(jsonPath("$.data.contacts").isArray());

        // 11. 422 Unprocessable Entity on invalid email
        String invalidPayload = objectMapper.writeValueAsString(Map.of(
                "name", "Bad Contact",
                "email", "not-an-email",
                "phoneNumber", "123"
        ));
        mockMvc.perform(post("/v1/contacts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidPayload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"));

        // 12. 429 Too Many Requests when exceeding rate limit
        mockMvc.perform(get("/v1/contacts")
                        .header("X-Client-Id", "rate-limited-client")
                        .header("X-RateLimit-Test-Limit", "1"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/v1/contacts")
                        .header("X-Client-Id", "rate-limited-client")
                        .header("X-RateLimit-Test-Limit", "1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("X-RateLimit-Limit"));

        // 13. DELETE /v1/contacts/{id} -> 204 No Content & subsequent 404 Not Found
        mockMvc.perform(delete("/v1/contacts/" + contactId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/v1/contacts/" + contactId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }
}
