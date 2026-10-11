package com.scm.controller;

import com.scm.common.error.BadRequestException;
import com.scm.common.error.ResourceNotFoundException;
import com.scm.common.error.UnprocessableEntityException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/v1/media/photos")
public class MediaController {

    private static final long MAX_FILE_SIZE_BYTES = 2L * 1024L * 1024L; // 2MB
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
    );

    private record StoredPhoto(
            String id,
            String fileName,
            String contentType,
            long sizeBytes,
            byte[] content,
            String createdAt
    ) {
    }

    private final Map<String, StoredPhoto> photoStore = new ConcurrentHashMap<>();

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadPhoto(@RequestParam("file") MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Multipart 'file' field is required and must not be empty.");
        }

        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new UnprocessableEntityException(
                    "File size (" + file.getSize() + " bytes) exceeds the maximum allowed limit of 2MB (2097152 bytes)."
            );
        }

        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase())) {
            throw new UnprocessableEntityException(
                    "Unsupported media format '" + contentType + "'. Allowed formats: image/jpeg, image/png, image/webp."
            );
        }

        String id = "med-" + UUID.randomUUID();
        String now = Instant.now().toString();
        StoredPhoto stored = new StoredPhoto(
                id,
                file.getOriginalFilename() != null ? file.getOriginalFilename() : "contact-photo.jpg",
                contentType.toLowerCase(),
                file.getSize(),
                file.getBytes(),
                now
        );
        photoStore.put(id, stored);

        Map<String, Object> metadata = toMetadata(stored);
        return ResponseEntity.status(HttpStatus.CREATED)
                .location(URI.create("/v1/media/photos/" + id))
                .eTag("\"" + id + "\"")
                .body(metadata);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getPhotoMetadata(@PathVariable String id) {
        StoredPhoto stored = photoStore.get(id);
        if (stored == null) {
            throw new ResourceNotFoundException("Photo with id '" + id + "' was not found.");
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(300, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .eTag("\"" + id + "\"")
                .body(toMetadata(stored));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePhoto(@PathVariable String id) {
        StoredPhoto removed = photoStore.remove(id);
        if (removed == null) {
            throw new ResourceNotFoundException("Photo with id '" + id + "' was not found.");
        }
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toMetadata(StoredPhoto p) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.id());
        map.put("fileName", p.fileName());
        map.put("contentType", p.contentType());
        map.put("sizeBytes", p.sizeBytes());
        map.put("url", "/v1/media/photos/" + p.id());
        map.put("createdAt", p.createdAt());
        return map;
    }
}
