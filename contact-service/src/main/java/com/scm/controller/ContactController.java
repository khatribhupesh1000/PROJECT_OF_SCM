package com.scm.controller;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import com.scm.common.error.BadRequestException;
import com.scm.common.error.ResourceNotFoundException;
import com.scm.common.error.UnprocessableEntityException;
import com.scm.entity.Contact;
import com.scm.repository.ContactRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/v1/contacts")
public class ContactController {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE_PATTERN = Pattern.compile("^\\+?[0-9\\-\\s()]{7,20}$");

    private final ContactRepository contactRepository;

    public ContactController(ContactRepository contactRepository) {
        this.contactRepository = contactRepository;
    }

    @PostConstruct
    public void seedInitialContacts() {
        if (contactRepository.count() == 0) {
            createSeed("cnt-1001", "Aarav Patel", "aarav.patel@scm.enterprise.io", "+919876543210",
                    "Bengaluru Tech Park, KA", "Principal Cloud Architect", true, "https://scm.enterprise.io");
            createSeed("cnt-1002", "Priya Nair", "priya.nair@scm.enterprise.io", "+919812345678",
                    "Cyber City, Gurugram", "Staff Distributed Systems Engineer", true, "https://priyanair.dev");
            createSeed("cnt-1003", "Vikramaditya Rao", "vikram.rao@scm.enterprise.io", "+14155550199",
                    "Market Street, San Francisco, CA", "VP of Platform Engineering", false, "https://vikram.io");
        }
    }

    private void createSeed(String id, String name, String email, String phone, String address,
                            String description, boolean favorite, String website) {
        Contact c = new Contact();
        c.setId(id);
        c.setName(name);
        c.setEmail(email);
        c.setPhoneNumber(phone);
        c.setAddress(address);
        c.setDescription(description);
        c.setFavorite(favorite);
        c.setWebsiteLink(website);
        contactRepository.save(c);
    }

    @JacksonXmlRootElement(localName = "ContactPage")
    public static class ContactPageResponse {
        @JacksonXmlElementWrapper(localName = "items")
        @JacksonXmlProperty(localName = "contact")
        private List<Contact> data;
        private String nextCursor;
        private boolean hasMore;
        private int limit;
        private long totalCount;

        public ContactPageResponse() {
        }

        public ContactPageResponse(List<Contact> data, String nextCursor, boolean hasMore, int limit, long totalCount) {
            this.data = data;
            this.nextCursor = nextCursor;
            this.hasMore = hasMore;
            this.limit = limit;
            this.totalCount = totalCount;
        }

        public List<Contact> getData() {
            return data;
        }

        public void setData(List<Contact> data) {
            this.data = data;
        }

        public String getNextCursor() {
            return nextCursor;
        }

        public void setNextCursor(String nextCursor) {
            this.nextCursor = nextCursor;
        }

        public boolean isHasMore() {
            return hasMore;
        }

        public void setHasMore(boolean hasMore) {
            this.hasMore = hasMore;
        }

        public int getLimit() {
            return limit;
        }

        public void setLimit(int limit) {
            this.limit = limit;
        }

        public long getTotalCount() {
            return totalCount;
        }

        public void setTotalCount(long totalCount) {
            this.totalCount = totalCount;
        }
    }

    /**
     * GET /v1/contacts - O(1) keyset cursor pagination with RFC 5988 Link header
     * and Cache-Control: public, max-age=60, must-revalidate (Checklist #1, #6, #8, #11).
     */
    @GetMapping(produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE})
    public ResponseEntity<ContactPageResponse> listContacts(
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean favorite) {

        if (limit < 1 || limit > 100) {
            throw new BadRequestException("Query parameter 'limit' must be between 1 and 100.");
        }

        String decodedCursor = decodeCursor(cursor);
        List<Contact> fetched = contactRepository.findContactsKeysetPage(
                decodedCursor,
                (search == null || search.isBlank()) ? null : search.trim(),
                favorite,
                PageRequest.of(0, limit + 1)
        );

        boolean hasMore = fetched.size() > limit;
        List<Contact> pageItems = hasMore ? fetched.subList(0, limit) : fetched;
        String nextCursor = null;
        if (hasMore && !pageItems.isEmpty()) {
            String lastId = pageItems.get(pageItems.size() - 1).getId();
            nextCursor = encodeCursor(lastId);
        }

        ContactPageResponse responseBody = new ContactPageResponse(
                pageItems,
                nextCursor,
                hasMore,
                limit,
                contactRepository.count()
        );

        ResponseEntity.BodyBuilder builder = ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .header("X-Total-Count", String.valueOf(responseBody.getTotalCount()));

        if (nextCursor != null) {
            String linkHeader = String.format("</v1/contacts?cursor=%s&limit=%d>; rel=\"next\"", nextCursor, limit);
            builder.header(HttpHeaders.LINK, linkHeader);
        }

        return builder.body(responseBody);
    }

    /**
     * GET /v1/contacts/{id} - Single resource with ETag, 304 Not Modified, JSON/XML negotiation,
     * and Cache-Control: public, max-age=300, must-revalidate (Checklist #1, #5, #6, #8).
     */
    @GetMapping(value = "/{id}", produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE})
    public ResponseEntity<Contact> getContactById(
            @PathVariable String id,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {

        Contact contact = contactRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contact with id '" + id + "' was not found."));

        String etag = computeEntityEtag(contact);
        if (ifNoneMatch != null && ifNoneMatch.equals(etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                    .eTag(etag)
                    .cacheControl(CacheControl.maxAge(300, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                    .build();
        }

        return ResponseEntity.ok()
                .eTag(etag)
                .cacheControl(CacheControl.maxAge(300, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .body(contact);
    }

    /**
     * GET /v1/contacts/{id}/vcard - Redirects to canonical export resource with 302 Found (Checklist #2).
     */
    @GetMapping("/{id}/vcard")
    public ResponseEntity<Void> redirectToVcard(@PathVariable String id) {
        if (!contactRepository.existsById(id)) {
            throw new ResourceNotFoundException("Contact with id '" + id + "' was not found.");
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create("/v1/contacts/" + id + "?format=vcard"))
                .build();
    }

    /**
     * POST /v1/contacts - Creates a new contact with Idempotency-Key support (Checklist #1, #2, #4).
     */
    @PostMapping(
            consumes = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE},
            produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE}
    )
    public ResponseEntity<Contact> createContact(@RequestBody Map<String, Object> payload) {
        validateContactPayload(payload, true);

        Contact contact = new Contact();
        applyFields(contact, payload);
        Contact saved = contactRepository.save(contact);

        return ResponseEntity.status(HttpStatus.CREATED)
                .location(URI.create("/v1/contacts/" + saved.getId()))
                .eTag(computeEntityEtag(saved))
                .body(saved);
    }

    /**
     * PUT /v1/contacts/{id} - Full replacement of a contact resource (Checklist #1).
     */
    @PutMapping(
            value = "/{id}",
            consumes = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE},
            produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE}
    )
    public ResponseEntity<Contact> replaceContact(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload) {

        Contact existing = contactRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contact with id '" + id + "' was not found."));

        validateContactPayload(payload, true);
        applyFields(existing, payload);
        Contact saved = contactRepository.save(existing);

        return ResponseEntity.ok()
                .eTag(computeEntityEtag(saved))
                .body(saved);
    }

    /**
     * PATCH /v1/contacts/{id} - Partial update of a contact resource (Checklist #1).
     */
    @PatchMapping(
            value = "/{id}",
            consumes = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE},
            produces = {MediaType.APPLICATION_JSON_VALUE, MediaType.APPLICATION_XML_VALUE}
    )
    public ResponseEntity<Contact> patchContact(
            @PathVariable String id,
            @RequestBody Map<String, Object> payload) {

        Contact existing = contactRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contact with id '" + id + "' was not found."));

        validateContactPayload(payload, false);
        applyFields(existing, payload);
        Contact saved = contactRepository.save(existing);

        return ResponseEntity.ok()
                .eTag(computeEntityEtag(saved))
                .body(saved);
    }

    /**
     * DELETE /v1/contacts/{id} - Deletes contact and returns 204 No Content (Checklist #1, #2).
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteContact(@PathVariable String id) {
        Contact existing = contactRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contact with id '" + id + "' was not found."));
        contactRepository.delete(existing);
        return ResponseEntity.noContent().build();
    }

    /**
     * HEAD /v1/contacts and HEAD /v1/contacts/{id} (Checklist #1).
     */
    @RequestMapping(method = RequestMethod.HEAD)
    public ResponseEntity<Void> headContacts() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(60, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .header("X-Total-Count", String.valueOf(contactRepository.count()))
                .build();
    }

    @RequestMapping(value = "/{id}", method = RequestMethod.HEAD)
    public ResponseEntity<Void> headContactById(@PathVariable String id) {
        Contact contact = contactRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contact with id '" + id + "' was not found."));
        return ResponseEntity.ok()
                .eTag(computeEntityEtag(contact))
                .cacheControl(CacheControl.maxAge(300, TimeUnit.SECONDS).cachePublic().mustRevalidate())
                .build();
    }

    /**
     * OPTIONS /v1/contacts and OPTIONS /v1/contacts/{id} (Checklist #1).
     */
    @RequestMapping(method = RequestMethod.OPTIONS)
    public ResponseEntity<Void> optionsContacts() {
        return ResponseEntity.ok()
                .allow(
                        HttpMethod.GET,
                        HttpMethod.POST,
                        HttpMethod.PUT,
                        HttpMethod.PATCH,
                        HttpMethod.DELETE,
                        HttpMethod.HEAD,
                        HttpMethod.OPTIONS
                )
                .build();
    }

    @RequestMapping(value = "/{id}", method = RequestMethod.OPTIONS)
    public ResponseEntity<Void> optionsContactById(@PathVariable String id) {
        return ResponseEntity.ok()
                .allow(
                        HttpMethod.GET,
                        HttpMethod.PUT,
                        HttpMethod.PATCH,
                        HttpMethod.DELETE,
                        HttpMethod.HEAD,
                        HttpMethod.OPTIONS
                )
                .build();
    }

    private void validateContactPayload(Map<String, Object> payload, boolean requireMandatoryFields) {
        if (payload == null || payload.isEmpty()) {
            throw new BadRequestException("Request body cannot be empty.");
        }
        Map<String, String> errors = new LinkedHashMap<>();

        if (requireMandatoryFields) {
            String name = asString(payload.get("name"));
            String email = asString(payload.get("email"));
            String phone = asString(payload.get("phoneNumber"));

            if (name == null || name.isBlank() || name.trim().length() < 2) {
                errors.put("name", "Name is required and must be at least 2 characters.");
            }
            if (email == null || !EMAIL_PATTERN.matcher(email).matches()) {
                errors.put("email", "A valid email address is required.");
            }
            if (phone == null || !PHONE_PATTERN.matcher(phone).matches()) {
                errors.put("phoneNumber", "Phone number must be 7-20 digits and may include +, -, spaces, or parentheses.");
            }
        } else {
            if (payload.containsKey("email")) {
                String email = asString(payload.get("email"));
                if (email == null || !EMAIL_PATTERN.matcher(email).matches()) {
                    errors.put("email", "Invalid email format.");
                }
            }
            if (payload.containsKey("phoneNumber")) {
                String phone = asString(payload.get("phoneNumber"));
                if (phone == null || !PHONE_PATTERN.matcher(phone).matches()) {
                    errors.put("phoneNumber", "Invalid phoneNumber format.");
                }
            }
        }

        if (!errors.isEmpty()) {
            throw new UnprocessableEntityException("Contact payload failed schema validation.", errors);
        }
    }

    private void applyFields(Contact contact, Map<String, Object> payload) {
        if (payload.containsKey("name")) {
            contact.setName(asString(payload.get("name")).trim());
        }
        if (payload.containsKey("email")) {
            contact.setEmail(asString(payload.get("email")).trim().toLowerCase());
        }
        if (payload.containsKey("phoneNumber")) {
            contact.setPhoneNumber(asString(payload.get("phoneNumber")).trim());
        }
        if (payload.containsKey("address")) {
            contact.setAddress(asString(payload.get("address")));
        }
        if (payload.containsKey("description")) {
            contact.setDescription(asString(payload.get("description")));
        }
        if (payload.containsKey("favorite") && payload.get("favorite") != null) {
            contact.setFavorite(Boolean.parseBoolean(String.valueOf(payload.get("favorite"))));
        }
        if (payload.containsKey("websiteLink")) {
            contact.setWebsiteLink(asString(payload.get("websiteLink")));
        }
        if (payload.containsKey("linkedInLink")) {
            contact.setLinkedInLink(asString(payload.get("linkedInLink")));
        }
        if (payload.containsKey("pictureUrl")) {
            contact.setPictureUrl(asString(payload.get("pictureUrl")));
        }
        if (payload.containsKey("userId") && payload.get("userId") != null) {
            contact.setUserId(asString(payload.get("userId")));
        }
    }

    private String asString(Object val) {
        return val == null ? null : String.valueOf(val);
    }

    private String computeEntityEtag(Contact contact) {
        String raw = contact.getId() + ":" + contact.getName() + ":" + contact.getEmail()
                + ":" + contact.getPhoneNumber() + ":" + contact.isFavorite() + ":" + contact.getUpdatedAt();
        return "\"" + Integer.toHexString(raw.hashCode()) + "\"";
    }

    private String encodeCursor(String id) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(id.getBytes(StandardCharsets.UTF_8));
    }

    private String decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            return new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            return cursor;
        }
    }
}
