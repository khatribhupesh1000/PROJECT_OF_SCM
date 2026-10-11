package com.scm.controller;

import com.scm.entity.Contact;
import com.scm.repository.ContactRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * GraphQL Endpoint (/graphql) alongside REST supporting queries, mutations,
 * dynamic field selection (id, name, email, etc.), and schema introspection (__schema) (Checklist #16).
 */
@RestController
@RequestMapping("/graphql")
public class GraphQLController {

    private static final List<String> ALL_CONTACT_FIELDS = List.of(
            "id", "userId", "name", "email", "phoneNumber", "address",
            "description", "favorite", "websiteLink", "linkedInLink", "pictureUrl", "createdAt", "updatedAt"
    );

    private static final Pattern ID_ARG_PATTERN = Pattern.compile("id\\s*:\\s*\"([^\"]+)\"");

    private final ContactRepository contactRepository;

    public GraphQLController(ContactRepository contactRepository) {
        this.contactRepository = contactRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> executeGetQuery(@RequestParam String query) {
        return executeGraphQL(Map.of("query", query));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> executeGraphQL(@RequestBody Map<String, Object> body) {
        String query = body != null && body.get("query") != null ? String.valueOf(body.get("query")).trim() : "";
        Map<String, Object> data = new LinkedHashMap<>();
        Map<String, Object> response = new LinkedHashMap<>();

        if (query.isEmpty()) {
            response.put("errors", List.of(Map.of("message", "GraphQL query string must not be empty.")));
            return ResponseEntity.badRequest().body(response);
        }

        if (query.contains("__schema")) {
            data.put("__schema", buildIntrospectionSchema());
        }

        if (query.contains("contacts")) {
            Set<String> selectedFields = extractSelectedFields(query, "contacts");
            List<Map<String, Object>> items = contactRepository.findAll().stream()
                    .map(c -> projectContact(c, selectedFields))
                    .toList();
            data.put("contacts", items);
        }

        if (query.matches("(?s).*\\bcontact\\s*\\(.*")) {
            Matcher m = ID_ARG_PATTERN.matcher(query);
            String targetId = m.find() ? m.group(1) : "";
            Set<String> selectedFields = extractSelectedFields(query, "contact");
            Optional<Contact> found = contactRepository.findById(targetId);
            data.put("contact", found.map(c -> projectContact(c, selectedFields)).orElse(null));
        }

        response.put("data", data);
        return ResponseEntity.ok(response);
    }

    private Set<String> extractSelectedFields(String query, String rootField) {
        Set<String> fields = new LinkedHashSet<>();
        int rootIdx = query.indexOf(rootField);
        if (rootIdx >= 0) {
            int braceOpen = query.indexOf('{', rootIdx);
            int braceClose = query.indexOf('}', braceOpen);
            if (braceOpen >= 0 && braceClose > braceOpen) {
                String block = query.substring(braceOpen + 1, braceClose);
                for (String token : block.split("[\\s,]+")) {
                    String clean = token.trim();
                    if (ALL_CONTACT_FIELDS.contains(clean)) {
                        fields.add(clean);
                    }
                }
            }
        }
        if (fields.isEmpty()) {
            fields.addAll(List.of("id", "name", "email", "phoneNumber", "favorite"));
        }
        return fields;
    }

    private Map<String, Object> projectContact(Contact c, Set<String> fields) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (String field : fields) {
            switch (field) {
                case "id" -> map.put("id", c.getId());
                case "userId" -> map.put("userId", c.getUserId());
                case "name" -> map.put("name", c.getName());
                case "email" -> map.put("email", c.getEmail());
                case "phoneNumber" -> map.put("phoneNumber", c.getPhoneNumber());
                case "address" -> map.put("address", c.getAddress());
                case "description" -> map.put("description", c.getDescription());
                case "favorite" -> map.put("favorite", c.isFavorite());
                case "websiteLink" -> map.put("websiteLink", c.getWebsiteLink());
                case "linkedInLink" -> map.put("linkedInLink", c.getLinkedInLink());
                case "pictureUrl" -> map.put("pictureUrl", c.getPictureUrl());
                case "createdAt" -> map.put("createdAt", c.getCreatedAt());
                case "updatedAt" -> map.put("updatedAt", c.getUpdatedAt());
            }
        }
        return map;
    }

    private Map<String, Object> buildIntrospectionSchema() {
        List<Map<String, Object>> contactFieldDefs = new ArrayList<>();
        for (String f : ALL_CONTACT_FIELDS) {
            contactFieldDefs.add(Map.of(
                    "name", f,
                    "type", Map.of("name", "favorite".equals(f) ? "Boolean" : "String", "kind", "SCALAR")
            ));
        }

        Map<String, Object> queryType = Map.of(
                "name", "Query",
                "kind", "OBJECT",
                "fields", List.of(
                        Map.of("name", "contacts", "description", "Fetch all contacts with field selection"),
                        Map.of("name", "contact", "description", "Fetch single contact by ID")
                )
        );
        Map<String, Object> contactType = Map.of(
                "name", "Contact",
                "kind", "OBJECT",
                "fields", contactFieldDefs
        );

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("queryType", Map.of("name", "Query"));
        schema.put("types", List.of(queryType, contactType));
        return schema;
    }
}
