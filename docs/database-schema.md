# Polyglot Database Schema & Data Ownership

## 1. Relational SQL Schema (`users`, `contact`, `idempotency_keys`)
Used by **`auth-service`** and **`contact-service`** (deployed on **Aiven Cloud MySQL 8.0** `defaultdb`, local MySQL `scm`, and compatible with PostgreSQL via `database/postgres/001_initial_schema.sql`).

```mermaid
erDiagram
    USERS ||--o{ CONTACT : "owns (user_user_id)"
    USERS {
        varchar(255) user_id PK
        varchar(255) email UK "Unique indexed lowercase email"
        varchar(255) name
        varchar(255) user_name
        varchar(255) password "BCrypt $2a$10$ or Scrypt hash"
        varchar(255) phone_number "E.164 format"
        varchar(255) provider "LOCAL | GOOGLE | GITHUB"
        varchar(255) provider_user_id
        varchar(1000) profile_pic
        varchar(255) roles "ROLE_USER,ROLE_ADMIN"
        boolean enabled
        boolean email_verified
        varchar(64) created_at
    }
    CONTACT {
        varchar(255) id PK
        varchar(255) user_user_id FK "References users(user_id)"
        varchar(255) name
        varchar(255) email
        varchar(255) phone_number "E.164 phone number"
        varchar(255) address
        varchar(255) description
        boolean favorite
        varchar(255) website_link
        varchar(255) linkedin_link
        varchar(255) picture
        varchar(255) facebook_link "Company / segment metadata"
    }
    IDEMPOTENCY_KEYS {
        varchar(255) idempotency_key PK
        varchar(255) scope
        varchar(64) request_hash "SHA-256 fingerprint"
        int response_status
        text response_body
        timestamp created_at
        timestamp expires_at
    }
```

---

## 2. NoSQL Document Store Schema (`MongoDB Atlas 7.0` — `scm_audit_store`)
Used by **`audit-service`** (`cluster0.kr57cwu.mongodb.net/scm_audit_store`).

### Why Document Data Belongs in MongoDB:
- **High-Throughput Append-Only Audit Events (`audit-logs`)**: Security and CRUD events carry heterogeneous metadata (`correlationId`, `actor`, `action`, `resource`, `detail`) that evolve without requiring relational `ALTER TABLE` locks.
- **Flexible Contact Interaction Notes (`contact-notes`)**: Free-form interaction notes attached to contacts (`/v1/contacts/{id}/notes`) are retrieved by `contactId` and indexed by `_createdAt`.
- **Idempotency Replay Store (`idempotency-keys`)**: Stores request SHA-256 fingerprints and serialized HTTP responses with TTL expiration (`expiresAt`).
