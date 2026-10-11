package com.scm.controller;

import com.scm.common.error.BadRequestException;
import com.scm.common.error.ResourceNotFoundException;
import com.scm.repository.DocumentStoreRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/v1/documents")
public class AuditDocumentController {

    private final DocumentStoreRepository documentStoreRepository;

    public AuditDocumentController(DocumentStoreRepository documentStoreRepository) {
        this.documentStoreRepository = documentStoreRepository;
    }

    @PostMapping("/{collection}")
    public ResponseEntity<Map<String, Object>> createDocument(
            @PathVariable String collection,
            @RequestBody Map<String, Object> document) {

        if (document == null || document.isEmpty()) {
            throw new BadRequestException("Document payload cannot be empty.");
        }

        Map<String, Object> stored = documentStoreRepository.insertDocument(collection, document);
        String id = String.valueOf(stored.get("_id"));

        return ResponseEntity.status(HttpStatus.CREATED)
                .location(URI.create("/v1/documents/" + collection + "/" + id))
                .body(stored);
    }

    @GetMapping("/{collection}")
    public ResponseEntity<Map<String, Object>> listDocuments(@PathVariable String collection) {
        List<Map<String, Object>> items = documentStoreRepository.findAllByCollection(collection);
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("collection", collection);
        envelope.put("count", items.size());
        envelope.put("documents", items);

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .body(envelope);
    }

    @GetMapping("/{collection}/{id}")
    public ResponseEntity<Map<String, Object>> getDocumentById(
            @PathVariable String collection,
            @PathVariable String id) {

        Map<String, Object> doc = documentStoreRepository.findById(collection, id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Document '" + id + "' not found in collection '" + collection + "'."
                ));

        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(300, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .body(doc);
    }

    @DeleteMapping("/{collection}/{id}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable String collection,
            @PathVariable String id) {

        boolean deleted = documentStoreRepository.deleteById(collection, id);
        if (!deleted) {
            throw new ResourceNotFoundException(
                    "Document '" + id + "' not found in collection '" + collection + "'."
            );
        }
        return ResponseEntity.noContent().build();
    }
}
