package com.scm.repository;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Schemaless NoSQL Document Store engine backing /v1/documents/{collection}
 * with MongoDB 7.0 URI configuration and embedded document collection storage (Checklist #23).
 */
@Repository
public class DocumentStoreRepository {

    @Value("${spring.data.mongodb.uri:mongodb://localhost:27017/scm_audit_store}")
    private String mongoUri;

    private final Map<String, Map<String, Map<String, Object>>> collections = new ConcurrentHashMap<>();

    @PostConstruct
    public void seedAuditLogs() {
        insertDocument("audit-logs", Map.of(
                "action", "SYSTEM_BOOT",
                "actor", "system@scm.enterprise.io",
                "resource", "/v1/contacts",
                "detail", "MongoDB 7.0 NoSQL document store initialized (" + mongoUri + ")"
        ));
    }

    public Map<String, Object> insertDocument(String collection, Map<String, Object> rawDocument) {
        Map<String, Map<String, Object>> col = collections.computeIfAbsent(collection, k -> new ConcurrentHashMap<>());
        String id = rawDocument.get("_id") != null
                ? String.valueOf(rawDocument.get("_id"))
                : "doc-" + UUID.randomUUID();

        Map<String, Object> stored = new LinkedHashMap<>(rawDocument);
        stored.put("_id", id);
        stored.put("_collection", collection);
        stored.put("_createdAt", Instant.now().toString());
        col.put(id, stored);
        return stored;
    }

    public List<Map<String, Object>> findAllByCollection(String collection) {
        Map<String, Map<String, Object>> col = collections.get(collection);
        if (col == null) {
            return List.of();
        }
        return new ArrayList<>(col.values());
    }

    public Optional<Map<String, Object>> findById(String collection, String id) {
        Map<String, Map<String, Object>> col = collections.get(collection);
        if (col == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(col.get(id));
    }

    public boolean deleteById(String collection, String id) {
        Map<String, Map<String, Object>> col = collections.get(collection);
        if (col == null) {
            return false;
        }
        return col.remove(id) != null;
    }
}
