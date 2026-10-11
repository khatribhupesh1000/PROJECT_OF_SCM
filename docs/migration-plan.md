# Monolith-to-Microservices Migration Plan

## 1. Strangler-Fig Migration Strategy
To decompose the Smart Contact Manager monolith without breaking the existing React frontend or losing existing user and contact records, we executed a phased **Strangler-Fig migration**:

### Phase 1: Baseline & Schema Extraction
1. Inspected the existing monolithic schema (`users` and `contact` tables) and exported all production rows.
2. Defined formal JSON Schema Draft-07 validation (`contact-schema.json`) and hand-written OpenAPI 3.0.3 contracts (`openapi.yaml` / `docs/openapi.yaml`).

### Phase 2: Introduce Express Public API Gateway (`api-gateway`)
1. Placed an Express.js API Gateway on port `8080` in front of all backend services.
2. Centralized cross-cutting concerns in reusable Express middleware:
   - Correlation ID generation & propagation (`X-Correlation-ID`) + structured JSON access logging.
   - Deliberate CORS configuration (`Access-Control-Allow-Origin`, `Access-Control-Expose-Headers`, fast preflight `OPTIONS`).
   - Sliding token-bucket rate limiter (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`, `429 Too Many Requests`).
   - `Idempotency-Key` middleware with SHA-256 request payload fingerprinting (`X-Idempotent-Replayed: true` on replay, `409 Conflict` on payload mismatch).
   - Centralized 4-argument error handler (`(err, req, res, next)`) normalizing all errors into RFC 7807 Problem Details (`application/problem+json` and `application/problem+xml`).

### Phase 3: Domain Service Decomposition & Polyglot Persistence
1. **Authentication & User Service (`auth-service`, Port 8081)**:
   - Extracted user registration (`/v1/auth/users`), JWT token issuance (`/v1/auth/tokens`), RBAC (`ROLE_ADMIN`), and Google/GitHub OAuth 2.0 flows.
   - Connected to Aiven Cloud MySQL (`defaultdb`) and local MySQL (`scm`).
2. **Contact Service (`contact-service`, Port 8082)**:
   - Extracted `/v1/contacts`, `/v1/contacts/{id}`, `/v1/contact-groups`, and `/v1/graphql`.
   - Implemented opaque base64url keyset cursor pagination with RFC 5988 `Link: rel="next"` headers and SHA-1 representation-aware `ETag` / `304 Not Modified`.
3. **Audit & Activity Document Service (`audit-service`, Port 8085)**:
   - Connected to **MongoDB Atlas 7.0** (`cluster0.kr57cwu.mongodb.net/scm_audit_store`) for `audit-logs`, `contact-notes` (`/v1/contacts/{id}/notes`), `activity-stream`, and `idempotency-keys`.
4. **Legacy Telecom SOAP Integration Service (`integration-service`, Port 8086)**:
   - Added WSDL endpoint (`GET /v1/soap/wsdl`) and SOAP 1.1 client (`POST /v1/soap/execute` & `/v1/integrations/soap-checks`) protected by a 3,000ms outbound timeout (`504`), exponential backoff retry (`100ms, 200ms, 400ms`), and 3-state circuit breaker (`CLOSED`, `OPEN`, `HALF_OPEN`).

### Phase 4: Verification & Cutover
1. Automated all 28 architectural requirements in `tests/api.test.js` using Jest 29 and Supertest 6 (`npm test`).
2. Created `scripts/migrate.sh` and `scripts/smoke-test.sh` for repeatable database initialization and live end-to-end verification.
