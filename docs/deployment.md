# Production Deployment & Cloud Configuration Guide

## 1. Active Cloud Backing Services (Verified Live)

| Backing Service | Provider | Host / Cluster | Database | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Relational SQL Database** | **Aiven Cloud MySQL 8.0** | `auth-contact-api-gateway-khatribhupesh1000-2e27.f.aivencloud.com:14049` | `defaultdb` (`SSL=REQUIRED`) | **ONLINE & SYNCED** |
| **NoSQL Document Database** | **MongoDB Atlas 7.0** | `cluster0.kr57cwu.mongodb.net` | `scm_audit_store` | **ONLINE & SYNCED** |

---

## 2. Environment Configuration (`.env.example`)
All deployment-sensitive values are externalized via Twelve-Factor environment variables:
- `PORT` (default `8080`)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `DB_SSL_MODE`
- `MONGODB_URI`, `MONGO_DB`
- `JWT_SECRET`, `JWT_EXPIRATION_MS`
- `CORS_ALLOWED_ORIGINS`
- `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_WINDOW_MS`
- `OUTBOUND_TIMEOUT_MS`, `RETRY_MAX_ATTEMPTS`, `RETRY_BASE_DELAY_MS`
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD`, `CIRCUIT_BREAKER_RESET_TIMEOUT_MS`

---

## 3. Running with Docker Compose
```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

---

## 4. Public Internet Exposure & Cloud Deployment
### Option A: Render Cloud Blueprint (`render.yaml`)
1. Push repository to GitHub.
2. In Render Dashboard, select **New -> Blueprint** and connect the repository containing `render.yaml`.
3. Provide the secret environment variables (`DB_PASSWORD`, `MONGODB_URI`, `JWT_SECRET`) in the Render Environment group.

### Option B: Instant Public HTTPS Endpoint via Cloudflare Tunnel
```bash
npm run tunnel
# Or directly:
npx cloudflared tunnel --url http://localhost:8080
```
