# Automated Testing & Verification Guide

## 1. Running the Automated Test Suite (`Jest 29 + Supertest 6 + Ajv 8`)
```bash
npm test
```
This command executes:
1. `node validate-schema.js` — Validates `contact-schema.json` using Ajv Draft-07 and `ajv-formats`.
2. `jest --runInBand` — Runs `tests/api.test.js` covering all 28 architectural parameters across 19 comprehensive integration test blocks.

---

## 2. Running the Spring Boot JUnit 5 Suite
```bash
mvn test
```

---

## 3. Running the Live End-to-End Smoke Test Script
```bash
./scripts/smoke-test.sh
```
The smoke test script verifies:
- `GET /v1/health` and `X-Correlation-ID` propagation
- User registration (`POST /v1/auth/users`) & JWT token acquisition (`POST /v1/auth/tokens`)
- Idempotent contact creation (`POST /v1/contacts` with `Idempotency-Key`), replay (`X-Idempotent-Replayed: true`), and payload conflict (`409 Conflict`)
- Cursor pagination (`GET /v1/contacts?limit=2`) and RFC 5988 `Link: rel="next"` navigation
- Content negotiation (`Accept: application/json`, `Accept: application/xml`, `406 Not Acceptable`)
- Conditional GET (`ETag` & `If-None-Match` -> `304 Not Modified`)
- Rate-limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) & `429 Too Many Requests`
- GraphQL queries and mutations (`POST /v1/graphql`)
- MongoDB Atlas document creation & listing (`POST /v1/documents/audit-logs`, `GET /v1/documents/audit-logs`)
- WSDL retrieval (`GET /v1/soap/wsdl`), SOAP 1.1 call with retry backoff (`POST /v1/soap/execute`), timeout (`504`), and 3-state circuit breaker (`GET /v1/resilience/status`)
- OpenAPI 3.0.3 YAML (`GET /v1/openapi.yaml`) and Swagger UI (`GET /docs`)
