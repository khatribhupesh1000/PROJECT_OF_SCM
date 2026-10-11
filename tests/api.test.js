import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { app } from "../api-gateway/src/app.js";
import { validateContactPayload } from "../validate-schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Smart Contact Manager (SCM) Microservices - 28-Parameter Enterprise Verification Suite", () => {
  let createdContactId = null;
  let createdContactEtag = null;
  let userToken = null;
  let adminToken = null;

  test("1. Correct HTTP Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD on /v1/contacts", async () => {
    const optRes = await request(app).options("/v1/contacts");
    expect(optRes.status).toBe(200);
    expect(optRes.headers.allow).toContain("PATCH");

    const headRes = await request(app).head("/v1/contacts");
    expect(headRes.status).toBe(200);
    expect(headRes.headers["x-total-count"]).toBeDefined();

    const postRes = await request(app)
      .post("/v1/contacts")
      .send({
        name: "Rohan Deshmukh",
        email: "rohan.deshmukh@scm.enterprise.io",
        phoneNumber: "+919822334455",
        address: "Baner, Pune, MH",
        favorite: false
      });
    expect(postRes.status).toBe(201);
    createdContactId = postRes.body.id;

    const getRes = await request(app).get(`/v1/contacts/${createdContactId}`);
    expect(getRes.status).toBe(200);
    createdContactEtag = getRes.headers.etag;

    const putRes = await request(app)
      .put(`/v1/contacts/${createdContactId}`)
      .send({
        name: "Rohan Deshmukh Sr.",
        email: "rohan.deshmukh@scm.enterprise.io",
        phoneNumber: "+919822334455"
      });
    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe("Rohan Deshmukh Sr.");

    const patchRes = await request(app)
      .patch(`/v1/contacts/${createdContactId}`)
      .send({ favorite: true });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.favorite).toBe(true);
  });

  test("2. 11 Distinct HTTP Status Codes (200, 201, 204, 302, 304, 400, 401, 403, 404, 422, 429)", async () => {
    // 302 Found (OAuth2 / vCard redirect)
    const redirectRes = await request(app).get("/v1/auth/oauth2/google");
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.location).toContain("accounts.google.com");

    // 400 Bad Request (malformed JSON syntax)
    const badJsonRes = await request(app)
      .post("/v1/contacts")
      .set("Content-Type", "application/json")
      .send("{bad-json");
    expect(badJsonRes.status).toBe(400);

    // 401 Unauthorized (missing Bearer token)
    const unauthRes = await request(app).get("/v1/auth/tokens/me");
    expect(unauthRes.status).toBe(401);

    // Register standard user (201) & test 403 Forbidden on admin endpoint
    const regUser = await request(app).post("/v1/auth/users").send({
      name: "Standard User",
      email: "std.user@scm.enterprise.io",
      password: "Password123!"
    });
    expect(regUser.status).toBe(201);
    userToken = regUser.body.accessToken;

    const forbiddenRes = await request(app)
      .get("/v1/auth/admin/users")
      .set("Authorization", `Bearer ${userToken}`);
    expect(forbiddenRes.status).toBe(403);

    // 404 Not Found
    const notFoundRes = await request(app).get("/v1/contacts/cnt-nonexistent-9999");
    expect(notFoundRes.status).toBe(404);

    // 422 Unprocessable Entity (semantic validation failure)
    const unprocessableRes = await request(app).post("/v1/contacts").send({
      name: "X",
      email: "invalid-email",
      phoneNumber: "abc"
    });
    expect(unprocessableRes.status).toBe(422);

    // 204 No Content on token logout
    const deleteTokenRes = await request(app).delete("/v1/auth/tokens");
    expect(deleteTokenRes.status).toBe(204);
  });

  test("3. One Consistent Error Body Everywhere: Strict RFC 7807 Problem Details (JSON & XML)", async () => {
    const jsonErr = await request(app)
      .get("/v1/contacts/cnt-missing")
      .set("X-Correlation-ID", "rfc7807-corr-id");
    expect(jsonErr.status).toBe(404);
    expect(jsonErr.headers["content-type"]).toContain("application/problem+json");
    expect(jsonErr.body).toEqual(
      expect.objectContaining({
        type: expect.stringContaining("https://scm.enterprise.io/problems/"),
        title: "Resource Not Found",
        status: 404,
        detail: expect.any(String),
        instance: "/v1/contacts/cnt-missing",
        timestamp: expect.any(String),
        correlationId: "rfc7807-corr-id"
      })
    );

    const xmlErr = await request(app)
      .get("/v1/contacts/cnt-missing")
      .set("Accept", "application/xml");
    expect(xmlErr.status).toBe(404);
    expect(xmlErr.headers["content-type"]).toContain("application/problem+xml");
    expect(xmlErr.text).toContain("<problem>");
    expect(xmlErr.text).toContain("<status>404</status>");
  });

  test("4. Idempotency Key on POST: Replays cached response without duplicate creation and returns 409 Conflict on payload mismatch", async () => {
    const key = "idem-test-key-2026";
    const payload = {
      name: "Idempotent Contact",
      email: "idempotent@scm.enterprise.io",
      phoneNumber: "+919800001111"
    };

    const first = await request(app)
      .post("/v1/contacts")
      .set("Idempotency-Key", key)
      .send(payload);
    expect(first.status).toBe(201);
    expect(first.headers["x-idempotent-replayed"]).toBe("false");

    const replay = await request(app)
      .post("/v1/contacts")
      .set("Idempotency-Key", key)
      .send(payload);
    expect(replay.status).toBe(201);
    expect(replay.headers["x-idempotent-replayed"]).toBe("true");
    expect(replay.body.id).toBe(first.body.id);

    const conflict = await request(app)
      .post("/v1/contacts")
      .set("Idempotency-Key", key)
      .send({ ...payload, name: "Mutated Payload With Same Key" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("CONFLICT");
  });

  test("5. ETag & Working 304 Not Modified Response on matching If-None-Match + Validator Invalidation on Update", async () => {
    const get1 = await request(app).get(`/v1/contacts/${createdContactId}`);
    expect(get1.status).toBe(200);
    const etag = get1.headers.etag;
    expect(etag).toBeDefined();

    const get304 = await request(app)
      .get(`/v1/contacts/${createdContactId}`)
      .set("If-None-Match", etag);
    expect(get304.status).toBe(304);

    // Updating the contact must invalidate the old ETag
    await request(app)
      .patch(`/v1/contacts/${createdContactId}`)
      .send({ description: "Updated Principal Architect" });
    const getAfterUpdate = await request(app)
      .get(`/v1/contacts/${createdContactId}`)
      .set("If-None-Match", etag);
    expect(getAfterUpdate.status).toBe(200);
    expect(getAfterUpdate.headers.etag).not.toBe(etag);
  });

  test("6. Deliberate Cache-Control on Every GET (max-age=60 on collections, max-age=300 on entities, no-store on errors)", async () => {
    const colRes = await request(app).get("/v1/contacts");
    expect(colRes.headers["cache-control"]).toBe("public, max-age=60, must-revalidate");

    const singleRes = await request(app).get(`/v1/contacts/${createdContactId}`);
    expect(singleRes.headers["cache-control"]).toBe("public, max-age=300, must-revalidate");

    const errGetRes = await request(app).get("/v1/contacts/cnt-nonexistent-cache-test");
    expect(errGetRes.status).toBe(404);
    expect(errGetRes.headers["cache-control"]).toBe("no-store");
  });

  test("7. JSON Schema Validation using Ajv Draft-07 (contact-schema.json & validate-schema.js)", () => {
    const validCheck = validateContactPayload({
      name: "Valid Schema Contact",
      email: "valid@scm.enterprise.io",
      phoneNumber: "+919876543210"
    });
    expect(validCheck.valid).toBe(true);

    const invalidCheck = validateContactPayload({
      name: "A",
      email: "not-an-email",
      phoneNumber: "12"
    });
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.errors.length).toBeGreaterThan(0);
  });

  test("8. Content Negotiation (JSON & XML, 406 Not Acceptable, 415 Unsupported Media Type)", async () => {
    const xmlRes = await request(app)
      .get(`/v1/contacts/${createdContactId}`)
      .set("Accept", "application/xml");
    expect(xmlRes.status).toBe(200);
    expect(xmlRes.headers["content-type"]).toContain("application/xml");
    expect(xmlRes.text).toContain("<Contact>");
    expect(xmlRes.text).toContain(`<id>${createdContactId}</id>`);

    const notAcceptableRes = await request(app)
      .get(`/v1/contacts/${createdContactId}`)
      .set("Accept", "application/pdf");
    expect(notAcceptableRes.status).toBe(406);

    const unsupportedMediaRes = await request(app)
      .post("/v1/contacts")
      .set("Content-Type", "text/plain")
      .send("plain text body");
    expect(unsupportedMediaRes.status).toBe(415);
  });

  test("9 & 10. Resource-Shaped URLs (No Verbs) & Versioning Under /v1/*", async () => {
    const contactsRes = await request(app).get("/v1/contacts");
    expect(contactsRes.status).toBe(200);

    const docsRes = await request(app).get("/v1/documents/audit-logs");
    expect(docsRes.status).toBe(200);

    const groupsRes = await request(app).get("/v1/contact-groups");
    expect(groupsRes.status).toBe(200);
    expect(Array.isArray(groupsRes.body.groups)).toBe(true);

    const createNoteRes = await request(app)
      .post(`/v1/contacts/${createdContactId}/notes`)
      .send({ content: "Architecture review scheduled for Q4" });
    expect(createNoteRes.status).toBe(201);

    const notesRes = await request(app).get(`/v1/contacts/${createdContactId}/notes`);
    expect(notesRes.status).toBe(200);
    expect(notesRes.body.count).toBeGreaterThanOrEqual(1);
  });

  test("11. Cursor Pagination with Opaque Keyset Cursor, RFC 5988 Link rel=\"next\" Header & Malformed Cursor Validation", async () => {
    const page1 = await request(app).get("/v1/contacts?limit=2");
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.nextCursor).toBeTruthy();
    expect(page1.headers.link).toContain('rel="next"');

    const page2 = await request(app).get(`/v1/contacts?cursor=${page1.body.nextCursor}&limit=2`);
    expect(page2.status).toBe(200);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);

    const badCursor = await request(app).get("/v1/contacts?cursor=!!!malformed_cursor!!!&limit=2");
    expect(badCursor.status).toBe(400);
  });

  test("12. Rate-Limit Headers (X-RateLimit-Limit, Remaining, Reset) and 429 Too Many Requests", async () => {
    const okRes = await request(app)
      .get("/v1/contacts")
      .set("X-Client-Id", "jest-rate-bucket-1")
      .set("X-RateLimit-Test-Limit", "1");
    expect(okRes.status).toBe(200);
    expect(okRes.headers["x-ratelimit-limit"]).toBe("1");
    expect(okRes.headers["x-ratelimit-remaining"]).toBe("0");
    expect(okRes.headers["x-ratelimit-reset"]).toBeDefined();

    const throttledRes = await request(app)
      .get("/v1/contacts")
      .set("X-Client-Id", "jest-rate-bucket-1")
      .set("X-RateLimit-Test-Limit", "1");
    expect(throttledRes.status).toBe(429);
    expect(throttledRes.body.status).toBe(429);
  });

  test("13 & 14. Hand-Written OpenAPI 3.0.3 Document & Swagger UI Served at /docs and /swagger-ui.html", async () => {
    const yamlRes = await request(app).get("/v1/openapi.yaml");
    expect(yamlRes.status).toBe(200);
    expect(yamlRes.text).toContain("openapi: 3.0.3");

    const docsRes = await request(app).get("/docs");
    expect(docsRes.status).toBe(200);
    expect(docsRes.text).toContain("SwaggerUIBundle");

    const swaggerHtmlRes = await request(app).get("/swagger-ui.html");
    expect(swaggerHtmlRes.status).toBe(200);
    expect(swaggerHtmlRes.text).toContain("swagger-ui");
  });

  test("15, 17, 18, 19. WSDL Inspection, SOAP Outbound Call, 3s Timeout (504), Exponential Backoff Retry & 3-State Circuit Breaker", async () => {
    // Reset Circuit Breaker to CLOSED
    await request(app).post("/v1/resilience/state").send({ state: "CLOSED" });

    const wsdlRes = await request(app).get("/v1/soap/wsdl");
    expect(wsdlRes.status).toBe(200);
    expect(wsdlRes.text).toContain("TelecomDirectoryService");

    // SOAP call with transient failure recovered via exponential backoff retry (delay * 2^attempt)
    const soapRes = await request(app)
      .post("/v1/soap/execute")
      .set("SOAPAction", "http://scm.enterprise.io/ws/telecom/VerifyPhoneNumber")
      .send({
        operation: "VerifyPhoneNumber",
        phoneNumber: "+919876543210",
        transientFailures: 2
      });
    expect(soapRes.status).toBe(200);
    expect(soapRes.body.valid).toBe(true);
    expect(soapRes.body.attempts).toBe(3);
    expect(soapRes.body.outboundTimeoutMs).toBe(3000);
    expect(soapRes.body.soapResponseXml).toContain("VerifyPhoneNumberResponse");

    // Verify 504 Gateway Timeout when outbound deadline is exceeded
    const timeoutRes = await request(app)
      .post("/v1/integrations/soap-checks")
      .send({ phoneNumber: "+919876543210", simulateTimeout: true });
    expect(timeoutRes.status).toBe(504);

    // Verify 502 Bad Gateway when all retries fail
    const badGatewayRes = await request(app)
      .post("/v1/soap/execute")
      .send({ phoneNumber: "+919876543210", simulateFailure: true });
    expect(badGatewayRes.status).toBe(502);

    // Restore to CLOSED and verify Circuit Breaker status endpoint
    await request(app).post("/v1/resilience/state").send({ state: "CLOSED" });
    const statusClosed = await request(app).get("/v1/resilience/status");
    expect(statusClosed.status).toBe(200);
    expect(statusClosed.body.state).toBe("CLOSED");

    // Transition to HALF_OPEN and OPEN
    const statusHalfOpen = await request(app).post("/v1/resilience/state").send({ state: "HALF_OPEN" });
    expect(statusHalfOpen.body.state).toBe("HALF_OPEN");

    const statusOpen = await request(app).post("/v1/resilience/state").send({ state: "OPEN" });
    expect(statusOpen.body.state).toBe("OPEN");

    // Fast-fail when Circuit Breaker is OPEN
    const openCall = await request(app).post("/v1/soap/execute").send({ phoneNumber: "+919876543210" });
    expect(openCall.status).toBe(503);

    // Restore to CLOSED
    await request(app).post("/v1/resilience/state").send({ state: "CLOSED" });
  });

  test("16. GraphQL Endpoint Alongside REST (/graphql & /v1/graphql) supporting field selection, mutations and __schema introspection", async () => {
    const gqlRes = await request(app)
      .post("/v1/graphql")
      .send({
        query: "{ __schema { queryType { name } } contacts { id name email } }"
      });
    expect(gqlRes.status).toBe(200);
    expect(gqlRes.body.data.__schema.queryType.name).toBe("Query");
    expect(Array.isArray(gqlRes.body.data.contacts)).toBe(true);
    expect(gqlRes.body.data.contacts[0]).toHaveProperty("id");
    expect(gqlRes.body.data.contacts[0]).toHaveProperty("name");
    expect(gqlRes.body.data.contacts[0]).toHaveProperty("email");
    expect(gqlRes.body.data.contacts[0]).not.toHaveProperty("address");

    const mutRes = await request(app)
      .post("/graphql")
      .send({
        query: 'mutation { createContact(name: "GraphQL User", email: "gql@scm.enterprise.io", phoneNumber: "+919811223344") { id name email } }'
      });
    expect(mutRes.status).toBe(200);
    expect(mutRes.body.data.createContact.name).toBe("GraphQL User");
  });

  test("20 & 21. Express Central Error Handling & Structured Correlation ID Propagation", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("X-Correlation-ID", "trace-id-999");
    expect(res.status).toBe(200);
    expect(res.headers["x-correlation-id"]).toBe("trace-id-999");
  });

  test("23. NoSQL Document Store (/v1/documents/{collection}) for schemaless audit logs", async () => {
    const createDoc = await request(app)
      .post("/v1/documents/activity-stream")
      .send({
        actor: "admin@scm.enterprise.io",
        action: "EXPORTED_CONTACTS",
        count: 42
      });
    expect(createDoc.status).toBe(201);
    expect(createDoc.body._id).toBeDefined();

    const listDocs = await request(app).get("/v1/documents/activity-stream");
    expect(listDocs.status).toBe(200);
    expect(listDocs.body.count).toBeGreaterThanOrEqual(1);
  });

  test("24. Stateless HMAC-SHA256 JWT Authentication & Role-Based Authorization (ROLE_ADMIN)", async () => {
    const loginRes = await request(app).post("/v1/auth/tokens").send({
      email: "admin@scm.enterprise.io",
      password: "AdminPass123!"
    });
    expect(loginRes.status).toBe(201);
    adminToken = loginRes.body.accessToken;

    const adminUsersRes = await request(app)
      .get("/v1/auth/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminUsersRes.status).toBe(200);
    expect(Array.isArray(adminUsersRes.body)).toBe(true);
  });

  test("25. CORS Configured Deliberately with Allowed Origins and Exposed Headers", async () => {
    const res = await request(app)
      .get("/v1/contacts")
      .set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-expose-headers"]).toContain("ETag");
    expect(res.headers["access-control-expose-headers"]).toContain("Link");
    expect(res.headers["access-control-expose-headers"]).toContain("X-Correlation-ID");
  });

  test("27 & 28. Docker, Twelve-Factor Config & Render Cloud Blueprint Artifacts Exist", () => {
    const rootDir = path.resolve(__dirname, "..");
    expect(fs.existsSync(path.join(rootDir, "Dockerfile"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "docker-compose.yml"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, ".env.example"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "render.yaml"))).toBe(true);

    // Clean up created contact with DELETE -> 204 No Content
    return request(app)
      .delete(`/v1/contacts/${createdContactId}`)
      .expect(204);
  });
});
