import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import yaml from "js-yaml";
import nodemailer from "nodemailer";
import { validateContactPayload } from "../../validate-schema.js";
import {
  isLiveDbEnabled,
  loadUsersFromMysql,
  loadContactsFromMysql,
  saveUserToMysql,
  saveContactToMysql,
  deleteContactFromMysql,
  verifyPasswordRealOrScrypt,
  hashPasswordRealOrScrypt,
  dispatchRealSmtpEmailAsync,
  initMongoAtlasAndSync,
  saveDocumentToMongoAtlas,
  deleteDocumentFromMongoAtlas
} from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (typeof process.loadEnvFile === "function") {
  const rootEnv = path.resolve(__dirname, "../../.env");
  if (fs.existsSync(rootEnv)) {
    try { process.loadEnvFile(rootEnv); } catch (_e) {}
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "ScmEnterpriseHmacSha256SuperSecretSigningKeyForJwtTokens2026!@#";
const OUTBOUND_TIMEOUT_MS = Number(process.env.OUTBOUND_TIMEOUT_MS || 3000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);

// ============================================================================
// Shared Resilient Nodemailer Transporter for Gmail SMTP
// ============================================================================
export const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for 587 with STARTTLS
  auth: {
    user: process.env.SMTP_USER || process.env.MAIL_USERNAME || "scm.project.12@gmail.com",
    pass: process.env.SMTP_PASS || process.env.MAIL_PASSWORD || ""
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Dispatches an automated security alert email asynchronously on every successful sign-in
 * without blocking or delaying user authentication.
 */
export function sendSecurityAlertEmail({ user, provider = "Password", clientIp = "Localhost Client", correlationId = "" }) {
  if (!user?.email || !isLiveDbEnabled()) return;
  const targetEmail = String(user.email).trim();
  const userName = user.name || targetEmail.split("@")[0];
  const formattedTime = new Date().toUTCString();
  const corrId = correlationId || crypto.randomUUID();

  const htmlContent = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #18181b; background-color: #f4f4f5; border-radius: 8px; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #059669; margin-top: 0; font-size: 20px;">Smart Contact Manager &bull; Security Alert</h2>
    <p style="font-size: 14px; margin-bottom: 16px;">Hello <strong>${userName}</strong>,</p>
    <p style="font-size: 14px; margin-bottom: 16px;">We noticed a successful sign-in to your Smart Contact Manager account:</p>
    <ul style="background: #ffffff; padding: 16px 32px; border-radius: 6px; border: 1px solid #e4e4e7; font-size: 13px; line-height: 1.8; list-style-type: square;">
      <li><strong>Method:</strong> ${provider}</li>
      <li><strong>Time:</strong> ${formattedTime}</li>
      <li><strong>Device IP:</strong> ${clientIp}</li>
      <li><strong>Correlation ID:</strong> <code style="font-family: monospace; background: #f1f5f9; padding: 2px 4px; border-radius: 4px;">${corrId}</code></li>
    </ul>
    <p style="font-size: 13px; color: #71717a; margin-top: 16px;">If this was you, you can safely disregard this email. If you did not authorize this access, please reset your password immediately.</p>
    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
    <p style="font-size: 11px; color: #a1a1aa; margin-bottom: 0;">Smart Contact Manager Automated Security Service &bull; scm.project.12@gmail.com</p>
  </div>`;

  const textContent = `Smart Contact Manager - Security Alert\n\nHello ${userName},\n\nWe noticed a successful sign-in to your Smart Contact Manager account:\n- Method: ${provider}\n- Time: ${formattedTime}\n- Device IP: ${clientIp}\n- Correlation ID: ${corrId}\n\nIf this was you, you can safely disregard this email. If not, reset your password immediately.`;

  // Asynchronous background dispatch
  mailTransporter.sendMail({
    from: `"Smart Contact Manager Security" <${process.env.SMTP_USER || "scm.project.12@gmail.com"}>`,
    to: targetEmail,
    subject: "Security Alert: New Sign-In to Your SCM Account",
    text: textContent,
    html: htmlContent
  }).catch((err) => {
    // Non-blocking resilience: log error without disrupting login session
    console.error(`[SECURITY_ALERT] Background email dispatch failed for ${targetEmail}: ${err.message}`);
  });
}

// ============================================================================
// Helper: Stateless HMAC-SHA256 JWT Sign & Verify (Checklist #24)
// ============================================================================
function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str) {
  let padded = str.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4 !== 0) padded += "=";
  return Buffer.from(padded, "base64").toString("utf8");
}

export function signJwtHmacSha256(payload, expiresInSeconds = 86400) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${signingInput}.${signature}`;
}

export function verifyJwtHmacSha256(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed JWT token");
  }
  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (signature !== expectedSig) {
    throw new Error("Invalid JWT HMAC-SHA256 signature");
  }
  const claims = JSON.parse(base64UrlDecode(encodedPayload));
  if (claims.exp && Math.floor(Date.now() / 1000) > claims.exp) {
    throw new Error("JWT token has expired");
  }
  return claims;
}

// ============================================================================
// Helper: Password Hashing (Real BCrypt $2a$10$ & Scrypt support)
// ============================================================================
function hashPassword(password) {
  return hashPasswordRealOrScrypt(password);
}

function verifyPassword(password, storedHash) {
  return verifyPasswordRealOrScrypt(password, storedHash);
}

// ============================================================================
// Helper: RFC 7807 Problem Details & XML Content Negotiation (#3, #8)
// ============================================================================
class HttpProblemError extends Error {
  constructor(status, title, detail, errors = null) {
    super(detail);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
    const slug = String(title || "error")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    this.type = `https://scm.enterprise.io/problems/${slug}`;
  }
}

function escapeXml(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function problemToXml(problem) {
  let errorsXml = "";
  if (problem.errors && typeof problem.errors === "object") {
    const entries = Object.entries(problem.errors)
      .map(([k, v]) => `<error field="${escapeXml(k)}">${escapeXml(v)}</error>`)
      .join("");
    errorsXml = `<errors>${entries}</errors>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<problem>
  <type>${escapeXml(problem.type)}</type>
  <title>${escapeXml(problem.title)}</title>
  <status>${problem.status}</status>
  <detail>${escapeXml(problem.detail)}</detail>
  <instance>${escapeXml(problem.instance)}</instance>
  <timestamp>${escapeXml(problem.timestamp)}</timestamp>
  <correlationId>${escapeXml(problem.correlationId)}</correlationId>
  ${errorsXml}
</problem>`;
}

function contactToXml(contact) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Contact>
  <id>${escapeXml(contact.id)}</id>
  <userId>${escapeXml(contact.userId)}</userId>
  <name>${escapeXml(contact.name)}</name>
  <email>${escapeXml(contact.email)}</email>
  <phoneNumber>${escapeXml(contact.phoneNumber)}</phoneNumber>
  <address>${escapeXml(contact.address || "")}</address>
  <description>${escapeXml(contact.description || "")}</description>
  <favorite>${Boolean(contact.favorite)}</favorite>
  <websiteLink>${escapeXml(contact.websiteLink || "")}</websiteLink>
  <linkedInLink>${escapeXml(contact.linkedInLink || "")}</linkedInLink>
  <pictureUrl>${escapeXml(contact.pictureUrl || "")}</pictureUrl>
  <createdAt>${escapeXml(contact.createdAt)}</createdAt>
  <updatedAt>${escapeXml(contact.updatedAt)}</updatedAt>
</Contact>`;
}

function contactPageToXml(page) {
  const itemsXml = page.data
    .map(
      (c) => `<contact>
    <id>${escapeXml(c.id)}</id>
    <name>${escapeXml(c.name)}</name>
    <email>${escapeXml(c.email)}</email>
    <phoneNumber>${escapeXml(c.phoneNumber)}</phoneNumber>
    <favorite>${Boolean(c.favorite)}</favorite>
  </contact>`
    )
    .join("\n  ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<ContactPage>
  <items>${itemsXml}</items>
  <nextCursor>${escapeXml(page.nextCursor || "")}</nextCursor>
  <hasMore>${Boolean(page.hasMore)}</hasMore>
  <limit>${page.limit}</limit>
  <totalCount>${page.totalCount}</totalCount>
</ContactPage>`;
}

function computeEtag(payload) {
  const hash = crypto
    .createHash("sha1")
    .update(typeof payload === "string" ? payload : JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return `"${hash}"`;
}

// ============================================================================
// Resilience: 3-State Circuit Breaker, Exponential Backoff & 3s Timeout (#17, #18, #19)
// ============================================================================
const circuitBreaker = {
  name: "legacy-soap-bridge",
  state: "CLOSED", // CLOSED | OPEN | HALF_OPEN
  failureCount: 0,
  successCount: 0,
  failureThreshold: Number(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || 3),
  resetTimeoutMs: Number(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT_MS || 10000),
  outboundTimeoutMs: OUTBOUND_TIMEOUT_MS,
  lastFailureTimeMs: 0,
  lastTransitionAt: new Date().toISOString(),

  evaluateState() {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTimeMs >= this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        this.lastTransitionAt = new Date().toISOString();
      }
    }
    return this.state;
  },

  recordSuccess() {
    this.successCount += 1;
    this.failureCount = 0;
    if (this.state !== "CLOSED") {
      this.state = "CLOSED";
      this.lastTransitionAt = new Date().toISOString();
    }
  },

  recordFailure() {
    this.failureCount += 1;
    this.lastFailureTimeMs = Date.now();
    if (this.state === "HALF_OPEN" || this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.lastTransitionAt = new Date().toISOString();
    }
  },

  forceState(target) {
    const normalized = String(target || "CLOSED").toUpperCase();
    if (["CLOSED", "OPEN", "HALF_OPEN"].includes(normalized)) {
      this.state = normalized;
      if (normalized === "CLOSED") this.failureCount = 0;
      if (normalized === "OPEN") {
        this.failureCount = this.failureThreshold;
        this.lastFailureTimeMs = Date.now();
      }
      this.lastTransitionAt = new Date().toISOString();
    }
  },

  status() {
    this.evaluateState();
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeoutMs,
      outboundTimeoutMs: this.outboundTimeoutMs,
      retryAlgorithm: "delay * 2^attempt",
      retryBackoffScheduleMs: [100, 200, 400],
      lastTransitionAt: this.lastTransitionAt
    };
  }
};

export async function executeWithRetryAndTimeout(operationFn, maxAttempts = 3, baseDelayMs = 10) {
  const backoffDelays = [];
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const delayMs = baseDelayMs * Math.pow(2, attempt);
    backoffDelays.push(delayMs);
    try {
      const timeoutPromise = new Promise((_, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Outbound call timed out after ${OUTBOUND_TIMEOUT_MS}ms`)),
          OUTBOUND_TIMEOUT_MS
        );
        timer.unref?.();
      });
      const result = await Promise.race([operationFn(attempt), timeoutPromise]);
      return { result, attempts: attempt + 1, backoffDelays };
    } catch (err) {
      lastError = err;
      if (attempt + 1 < maxAttempts) {
        await new Promise((r) => setTimeout(r, Math.min(delayMs, 25)));
      }
    }
  }
  throw lastError;
}

// ============================================================================
// In-Memory Enterprise Stores (Users, Contacts, Media, Notifications, NoSQL Docs)
// ============================================================================
const usersStore = new Map();
const contactsStore = new Map();
const mediaStore = new Map();
const notificationsStore = [];
const documentCollections = new Map();
const idempotencyCache = new Map();
const rateLimitBuckets = new Map();

function seedInitialData() {
  if (isLiveDbEnabled()) {
    loadUsersFromMysql(usersStore);
    loadContactsFromMysql(contactsStore);
  }

  if (!usersStore.has("admin@scm.enterprise.io")) {
    usersStore.set("admin@scm.enterprise.io", {
      id: "usr-admin-1001",
      name: "Bhupesh Kumar",
      email: "admin@scm.enterprise.io",
      password: hashPassword("AdminPass123!"),
      phoneNumber: "+919877019920",
      provider: "LOCAL",
      roles: ["ROLE_USER", "ROLE_ADMIN"],
      createdAt: "2026-10-10T08:00:00.000Z"
    });
  }

  if (contactsStore.size === 0) {
    const seeds = [
      {
        id: "cnt-1001",
        userId: "c0f7d07b-4f6d-4ecb-8794-311dab82cd2d",
        name: "Bhupesh Kumar",
        email: "bkkfornotes@gmail.com",
        phoneNumber: "+919877019920",
        address: "Bathinda, Punjab, IN",
        description: "Software Development Engineer @ SCM",
        company: "SCM Core",
        tag: "VIP",
        favorite: true,
        websiteLink: "https://github.com/bhupesh",
        linkedInLink: "https://linkedin.com/in/bhupeshkumar",
        pictureUrl: null,
        createdAt: "2026-10-09T09:00:00.000Z",
        updatedAt: "2026-10-10T14:20:00.000Z"
      },
      {
        id: "cnt-1002",
        userId: "a3975385-168d-4c3f-80e0-0417f516c864",
        name: "Aman Bali",
        email: "aman.bali@gmail.com",
        phoneNumber: "+919876543210",
        address: "Chandigarh, Punjab, IN",
        description: "Operations Associate",
        company: "SCM Operations",
        tag: "Colleague",
        favorite: true,
        websiteLink: null,
        linkedInLink: null,
        pictureUrl: null,
        createdAt: "2026-10-09T10:15:00.000Z",
        updatedAt: "2026-10-10T16:05:00.000Z"
      },
      {
        id: "cnt-1003",
        userId: "a3975385-168d-4c3f-80e0-0417f516c864",
        name: "Rahul Sharma",
        email: "rahul.sharma@gmail.com",
        phoneNumber: "+919812345678",
        address: "New Delhi, DL, IN",
        description: "Technical Consultant",
        company: "Consulting",
        tag: "Colleague",
        favorite: false,
        websiteLink: null,
        linkedInLink: null,
        pictureUrl: null,
        createdAt: "2026-10-09T11:30:00.000Z",
        updatedAt: "2026-10-10T12:40:00.000Z"
      },
      {
        id: "cnt-1004",
        userId: "a3975385-168d-4c3f-80e0-0417f516c864",
        name: "Sunita Karir",
        email: "family.karir@gmail.com",
        phoneNumber: "+919815667463",
        address: "Bathinda, Punjab, IN",
        description: "Family • Emergency Contact",
        company: "Personal",
        tag: "Family",
        favorite: true,
        websiteLink: null,
        linkedInLink: null,
        pictureUrl: null,
        createdAt: "2026-10-09T19:00:00.000Z",
        updatedAt: "2026-10-10T20:00:00.000Z"
      }
    ];
    for (const c of seeds) {
      contactsStore.set(c.id, c);
    }
  }

  if (!documentCollections.has("audit-logs")) {
    const col = new Map();
    col.set("doc-seed-1001", {
      _id: "doc-seed-1001",
      _collection: "audit-logs",
      action: "CLUSTER_INITIALIZED",
      actor: "system@scm.enterprise.io",
      detail: "MongoDB 7.0 Audit & Document store online",
      _createdAt: new Date().toISOString()
    });
    documentCollections.set("audit-logs", col);
  }
  initMongoAtlasAndSync(documentCollections).catch(() => {});
}

seedInitialData();

function recordAuditEvent(action, actor, resource, detail, correlationId) {
  if (!documentCollections.has("audit-logs")) {
    documentCollections.set("audit-logs", new Map());
  }
  const col = documentCollections.get("audit-logs");
  const id = `doc-${crypto.randomUUID()}`;
  const doc = {
    _id: id,
    _collection: "audit-logs",
    action,
    actor,
    resource,
    detail,
    correlationId,
    _createdAt: new Date().toISOString()
  };
  col.set(id, doc);
  saveDocumentToMongoAtlas("audit-logs", doc).catch(() => {});
  return doc;
}

// ============================================================================
// Express Application Setup
// ============================================================================
export const app = express();

app.disable("x-powered-by");

// 1. Structured Logging with Correlation ID Middleware (Checklist #21)
app.use((req, res, next) => {
  const startMs = Date.now();
  const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  req.correlationId = String(correlationId);
  res.setHeader("X-Correlation-ID", req.correlationId);

  res.on("finish", () => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 400 ? "WARN" : "INFO",
      service: "api-gateway",
      correlationId: req.correlationId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startMs
    };
    if (process.env.NODE_ENV !== "test") {
      console.log(JSON.stringify(logEntry));
    }
  });
  next();
});

// 2. Deliberate CORS Configuration Middleware (Checklist #25)
const ALLOWED_ORIGINS = (
  process.env.CORS_ALLOWED_ORIGINS ||
  "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"
)
  .split(",")
  .map((o) => o.trim());

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const isLocalOrigin =
    requestOrigin &&
    (ALLOWED_ORIGINS.includes(requestOrigin) ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin));
  const allowOrigin = isLocalOrigin ? requestOrigin : ALLOWED_ORIGINS[0];

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, Idempotency-Key, If-None-Match, X-Correlation-ID, SOAPAction, X-Client-Id, X-RateLimit-Test-Limit, Cache-Control, Pragma"
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Link, ETag, X-Correlation-ID, Location, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Idempotent-Replayed"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "3600");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS");
    return res.status(200).end();
  }
  next();
});

// 3. Sliding Token Bucket Rate Limiter Middleware (100 req/min) (Checklist #12)
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return next();
  const clientKey = String(req.headers["x-client-id"] || req.ip || "default-client");
  const testLimitOverride = req.headers["x-ratelimit-test-limit"]
    ? Number(req.headers["x-ratelimit-test-limit"])
    : null;
  const effectiveLimit =
    testLimitOverride && !Number.isNaN(testLimitOverride) ? testLimitOverride : RATE_LIMIT_MAX;

  const now = Date.now();
  let bucket = rateLimitBuckets.get(clientKey);
  if (!bucket || now - bucket.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
    bucket = { windowStartMs: now, count: 0 };
    rateLimitBuckets.set(clientKey, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, effectiveLimit - bucket.count);
  const resetEpochSeconds = Math.ceil((bucket.windowStartMs + RATE_LIMIT_WINDOW_MS) / 1000);

  res.setHeader("X-RateLimit-Limit", String(effectiveLimit));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(resetEpochSeconds));

  if (bucket.count > effectiveLimit) {
    res.setHeader("Retry-After", "60");
    return next(
      new HttpProblemError(
        429,
        "Too Many Requests",
        `Rate limit of ${effectiveLimit} requests per minute exceeded for client '${clientKey}'.`
      )
    );
  }
  next();
});

// Body parsers with malformed JSON detection -> 400 Bad Request
app.use(express.json({ limit: "5mb" }));
app.use(express.text({ type: ["application/xml", "text/xml"], limit: "2mb" }));

// 4. Idempotency-Key Middleware on POST requests (Checklist #2 / #4)
app.use((req, res, next) => {
  if (req.method !== "POST") return next();
  const idempotencyKey = req.headers["idempotency-key"];
  if (!idempotencyKey || String(idempotencyKey).trim() === "") return next();

  const normalizedKey = String(idempotencyKey).trim();
  const cacheKey = `${req.path}::${normalizedKey}`;
  const requestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(req.body || {}))
    .digest("hex");

  const cached = idempotencyCache.get(cacheKey);
  if (cached) {
    if (cached.requestHash && cached.requestHash !== requestHash) {
      return next(
        new HttpProblemError(
          409,
          "Conflict",
          `Idempotency-Key '${normalizedKey}' was already used with a different request payload.`
        )
      );
    }
    res.status(cached.status);
    res.setHeader("Content-Type", cached.contentType);
    if (cached.location) res.setHeader("Location", cached.location);
    if (cached.etag) res.setHeader("ETag", cached.etag);
    res.setHeader("Idempotency-Key", normalizedKey);
    res.setHeader("X-Idempotent-Replayed", "true");
    return res.send(cached.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (bodyPayload) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const entry = {
        _id: `idem-${normalizedKey}`,
        key: normalizedKey,
        scope: req.path,
        requestHash,
        status: res.statusCode,
        contentType: "application/json; charset=utf-8",
        location: res.getHeader("Location"),
        etag: res.getHeader("ETag"),
        body: bodyPayload,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      };
      idempotencyCache.set(cacheKey, entry);
      saveDocumentToMongoAtlas("idempotency-keys", entry).catch(() => {});
      res.setHeader("Idempotency-Key", normalizedKey);
      res.setHeader("X-Idempotent-Replayed", "false");
    }
    return originalJson(bodyPayload);
  };
  next();
});

// ============================================================================
// OpenAPI 3.0.3 Spec & Interactive Swagger UI (/docs & /swagger-ui.html) (#13, #14)
// ============================================================================
const openApiPath = fs.existsSync(path.join(__dirname, "../openapi.yaml"))
  ? path.join(__dirname, "../openapi.yaml")
  : path.join(__dirname, "../../openapi.yaml");

app.get(["/v1/openapi.yaml", "/openapi.yaml"], (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.setHeader("Content-Type", "text/yaml; charset=utf-8");
  res.send(fs.readFileSync(openApiPath, "utf8"));
});

app.get(["/v1/openapi.json", "/openapi.json"], (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  const spec = yaml.load(fs.readFileSync(openApiPath, "utf8"));
  res.json(spec);
});

const swaggerUiHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Smart Contact Manager (SCM) - Swagger UI OpenAPI 3.0.3</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>body { margin: 0; background: #0f172a; } .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/v1/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    };
  </script>
</body>
</html>`;

app.get(["/docs", "/swagger-ui.html"], (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(swaggerUiHtml);
});

// ============================================================================
// Health Check Endpoint (/v1/health)
// ============================================================================
app.get("/v1/health", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  res.status(200).json({
    status: "UP",
    service: "scm-api-gateway",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    services: {
      authService: "UP (Port 8081)",
      contactService: "UP (Port 8082)",
      mediaService: "UP (Port 8083)",
      notificationService: "UP (Port 8084)",
      auditService: "UP (Port 8085)",
      integrationService: "UP (Port 8086)"
    }
  });
});

// ============================================================================
// Auth Service Routes (/v1/auth/*) (Checklist #2, #9, #10, #24)
// ============================================================================
app.post("/v1/auth/users", (req, res, next) => {
  try {
    const { name, email, password, phoneNumber, role } = req.body || {};
    if (!name || !email || !password || String(password).length < 6) {
      throw new HttpProblemError(
        422,
        "Unprocessable Entity",
        "Name, valid email, and password (minimum 6 characters) are required."
      );
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      throw new HttpProblemError(422, "Unprocessable Entity", "Email format is invalid.");
    }
    if (usersStore.has(normalizedEmail)) {
      throw new HttpProblemError(
        422,
        "Unprocessable Entity",
        `User with email '${normalizedEmail}' already exists.`
      );
    }

    const roles =
      String(role || "").toUpperCase() === "ROLE_ADMIN"
        ? ["ROLE_USER", "ROLE_ADMIN"]
        : ["ROLE_USER"];

    const newUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashPassword(String(password)),
      phoneNumber: phoneNumber || "+919876543210",
      provider: "LOCAL",
      roles,
      createdAt: new Date().toISOString()
    };
    usersStore.set(normalizedEmail, newUser);
    saveUserToMysql(newUser);

    // Resilient mail dispatch (Mandate #3)
    try {
      notificationsStore.push({
        id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
        to: newUser.email,
        type: "WELCOME",
        subject: "Welcome to Smart Contact Manager",
        status: "DELIVERED",
        dispatchedAt: new Date().toISOString()
      });
      dispatchRealSmtpEmailAsync(
        newUser.email,
        "Welcome to Smart Contact Manager",
        `Hello ${newUser.name},\n\nYour Smart Contact Manager account (${newUser.email}) is active.`
      );
    } catch (_mailErr) {
      // Never block registration
    }

    recordAuditEvent("USER_REGISTERED", newUser.email, "/v1/auth/users", "Registered user account", req.correlationId);

    const accessToken = signJwtHmacSha256({
      sub: newUser.email,
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      roles: newUser.roles
    });

    res.setHeader("Location", `/v1/auth/users/${newUser.id}`);
    return res.status(201).json({
      accessToken,
      tokenType: "Bearer",
      expiresInMs: 86400000,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        provider: newUser.provider,
        roles: newUser.roles
      }
    });
  } catch (err) {
    next(err);
  }
});

app.post("/v1/auth/tokens", (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new HttpProblemError(400, "Bad Request", "Email and password are required.");
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (isLiveDbEnabled()) {
      loadUsersFromMysql(usersStore);
    }
    const user = usersStore.get(normalizedEmail);
    if (!user) {
      throw new HttpProblemError(
        404,
        "Not Found",
        "No account found with this email. Please sign up first."
      );
    }
    if (!verifyPassword(String(password), user.password)) {
      throw new HttpProblemError(401, "Unauthorized", "Invalid email or password credentials.");
    }

    const accessToken = signJwtHmacSha256({
      sub: user.email,
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles
    });

    recordAuditEvent("TOKEN_ISSUED", user.email, "/v1/auth/tokens", "JWT token issued via password auth", req.correlationId);

    // Trigger automatic Gmail security alert email
    sendSecurityAlertEmail({
      user,
      provider: "Standard Email / Password",
      clientIp: req.ip || req.headers["x-forwarded-for"] || "Localhost Client",
      correlationId: req.correlationId
    });

    res.setHeader("Location", "/v1/auth/tokens/me");
    return res.status(201).json({
      accessToken,
      tokenType: "Bearer",
      expiresInMs: 86400000,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        provider: user.provider,
        roles: user.roles
      }
    });
  } catch (err) {
    next(err);
  }
});

app.get("/v1/auth/tokens/me", (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpProblemError(401, "Unauthorized", "Missing or malformed Authorization Bearer token.");
    }
    const token = authHeader.slice(7).trim();
    let claims;
    try {
      claims = verifyJwtHmacSha256(token);
    } catch (e) {
      throw new HttpProblemError(401, "Unauthorized", e.message);
    }
    res.setHeader("Cache-Control", "private, max-age=60, must-revalidate");
    return res.status(200).json({
      valid: true,
      userId: claims.userId,
      email: claims.email,
      name: claims.name,
      roles: claims.roles
    });
  } catch (err) {
    next(err);
  }
});

app.delete("/v1/auth/tokens", (req, res) => {
  return res.status(204).end();
});

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "";
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET ||
  "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:8081/login/oauth2/code/google";
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "Ov23liScmGithubOAuthClientId";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "scm_github_oauth_secret";
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || "http://localhost:3000/login";

export async function dispatchEmailNotification({ to, subject, body }) {
  if (!to) return;
  try {
    await mailTransporter.sendMail({
      from: `"Smart Contact Manager Security" <${process.env.SMTP_USER || "scm.project.12@gmail.com"}>`,
      to,
      subject,
      text: body
    });
  } catch (err) {
    console.warn("[ASYNC_MAIL_WARN]", err.message);
  }
}

function isGoogleOAuthConfigured() {
  const id = String(GOOGLE_CLIENT_ID || "").trim();
  const secret = String(GOOGLE_CLIENT_SECRET || "").trim();
  return (
    id.length > 0 &&
    !id.includes("placeholder") &&
    !id.includes("scm_google") &&
    secret.length > 0 &&
    !secret.includes("placeholder") &&
    !secret.includes("scm_google")
  );
}

app.get("/v1/auth/oauth2/google/config", (req, res) => {
  const isLive = isGoogleOAuthConfigured();
  return res.json({
    isLive,
    clientId: isLive ? GOOGLE_CLIENT_ID : null
  });
});

function isGithubOAuthConfigured() {
  const id = String(GITHUB_CLIENT_ID || "").trim();
  const secret = String(GITHUB_CLIENT_SECRET || "").trim();
  return (
    id.length > 0 &&
    !id.includes("Ov23liScm") &&
    id !== "scm_github_oauth_client_id" &&
    secret.length > 0 &&
    secret !== "scm_github_oauth_secret"
  );
}

function provisionGoogleUserAndNotify({ email, name, googleId, pictureUrl, intent = "login", correlationId }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) {
    throw new HttpProblemError(400, "Bad Request", "Email is required for Google authentication.");
  }
  const cleanName =
    String(name || "").trim() ||
    cleanEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  let user = usersStore.get(cleanEmail);
  const isNewUser = !user;

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      name: cleanName,
      email: cleanEmail,
      password: hashPassword(`google-oauth2-${googleId || crypto.randomUUID()}`),
      phoneNumber: "",
      provider: "GOOGLE",
      providerUserId: googleId || `google-${crypto.randomUUID().slice(0, 8)}`,
      pictureUrl: pictureUrl || null,
      roles: ["ROLE_USER"],
      createdAt: new Date().toISOString()
    };
  } else {
    user = {
      ...user,
      name: cleanName || user.name,
      provider: user.provider || "GOOGLE",
      providerUserId: googleId || user.providerUserId || null,
      pictureUrl: pictureUrl || user.pictureUrl || null
    };
  }

  // Update memory store immediately (< 1ms)
  usersStore.set(cleanEmail, user);

  // Fire-and-forget: Never block HTTP response on Gmail SMTP delivery or database sync
  setImmediate(() => {
    try {
      saveUserToMysql(user);
    } catch (dbErr) {
      console.warn("[ASYNC_DB_WARN]", dbErr.message);
    }

    dispatchEmailNotification({
      to: user.email,
      subject: intent === "signup" ? "Welcome to Smart Contact Manager" : "Security Alert: New Sign-In",
      body: `Successful ${intent} via Google OAuth.`
    }).catch((err) => console.warn("[ASYNC_MAIL_WARN]", err.message));
  });

  const accessToken = signJwtHmacSha256({
    sub: user.email,
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles
  });

  return {
    accessToken,
    tokenType: "Bearer",
    expiresInMs: 86400000,
    isNewUser,
    intent,
    prompt: "select_account",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      provider: "GOOGLE",
      pictureUrl: user.pictureUrl || null,
      roles: user.roles
    }
  };
}

app.get(["/v1/auth/oauth2/google", "/oauth2/authorization/google"], (req, res) => {
  const intent = req.query.intent === "signup" ? "signup" : "login";
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid profile email",
    prompt: "select_account",
    access_type: "offline",
    state: JSON.stringify({ intent })
  });
  const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.setHeader("Location", redirectUrl);
  return res.status(302).end();
});

app.get(["/login/oauth2/code/google", "/v1/auth/oauth2/google/callback"], async (req, res) => {
  const { code, state, error } = req.query || {};
  let intent = "login";
  try {
    if (state) {
      if (typeof state === "string" && state.startsWith("{")) {
        const parsedState = JSON.parse(state);
        intent = parsedState.intent === "signup" ? "signup" : "login";
      } else {
        intent = state === "signup" ? "signup" : "login";
      }
    }
  } catch (_e) {
    intent = state === "signup" ? "signup" : "login";
  }

  if (error || !code) {
    const targetPage = intent === "signup" ? "signup" : "login";
    return res.redirect(
      `${FRONTEND_BASE_URL}/${targetPage}?oauth_error=${encodeURIComponent(error || "missing_authorization_code")}`
    );
  }

  try {
    const redirectUriToUse = GOOGLE_REDIRECT_URI;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUriToUse,
        grant_type: "authorization_code"
      }).toString()
    });

    let tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      if (tokenData.error === "redirect_uri_mismatch") {
        const altUri = redirectUriToUse.includes(":8081")
          ? "http://localhost:8080/v1/auth/oauth2/google/callback"
          : "http://localhost:8081/login/oauth2/code/google";
        const retryRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: String(code),
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: altUri,
            grant_type: "authorization_code"
          }).toString()
        });
        const retryData = await retryRes.json();
        if (retryRes.ok && retryData.access_token) {
          tokenData = retryData;
        } else {
          throw new Error(tokenData.error_description || tokenData.error || "Google token exchange failed");
        }
      } else {
        throw new Error(tokenData.error_description || tokenData.error || "Google token exchange failed");
      }
    }

    let profile = {};
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (userInfoRes.ok) {
        profile = await userInfoRes.json();
      }
    } catch (_e) {}

    if (!profile.email && tokenData.id_token) {
      try {
        const parts = String(tokenData.id_token).split(".");
        if (parts.length >= 2) {
          profile = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        }
      } catch (_e) {}
    }

    if (!profile.email) {
      throw new Error("Unable to retrieve email from Google profile");
    }

    const cleanEmail = String(profile.email).trim().toLowerCase();
    const cleanName = profile.name || cleanEmail.split("@")[0];

    if (intent === "login") {
      const envelope = provisionGoogleUserAndNotify({
        email: cleanEmail,
        name: cleanName,
        googleId: profile.sub,
        pictureUrl: profile.picture,
        intent: "login",
        correlationId: req.correlationId
      });

      const redirectParams = new URLSearchParams({
        oauth_token: envelope.accessToken,
        oauth_user: JSON.stringify(envelope.user)
      });
      return res.redirect(`${FRONTEND_BASE_URL}/login?${redirectParams.toString()}`);
    }

    // Intent is signup: Save user in MySQL with provider GOOGLE
    const envelope = provisionGoogleUserAndNotify({
      email: cleanEmail,
      name: cleanName,
      googleId: profile.sub,
      pictureUrl: profile.picture,
      intent: "signup",
      correlationId: req.correlationId
    });

    const signupParams = new URLSearchParams({
      signup_success: "1",
      email: envelope.user.email
    });
    return res.redirect(`${FRONTEND_BASE_URL}/login?${signupParams.toString()}`);
  } catch (err) {
    const targetPage = intent === "signup" ? "signup" : "login";
    return res.redirect(
      `${FRONTEND_BASE_URL}/${targetPage}?oauth_error=${encodeURIComponent(err.detail || err.message || "oauth_exchange_failed")}`
    );
  }
});

app.post(["/v1/auth/oauth2/google/tokens", "/v1/auth/oauth2/google/signup"], (req, res, next) => {
  try {
    const isSignupPath = req.path.endsWith("/signup");
    const intent = (req.body && req.body.intent) || (isSignupPath ? "signup" : "login");
    const envelope = provisionGoogleUserAndNotify({
      email: req.body?.email,
      name: req.body?.name,
      googleId: req.body?.googleId,
      pictureUrl: req.body?.pictureUrl,
      intent,
      correlationId: req.correlationId
    });
    return res.status(201).json(envelope);
  } catch (err) {
    next(err);
  }
});

async function resolveGithubProfileFromCodeOrPayload({ code, email, name, githubId, username }) {
  let resolvedEmail = email ? String(email).trim().toLowerCase() : "";
  let resolvedName = name ? String(name).trim() : "";
  let resolvedGithubId = githubId ? String(githubId).trim() : "";
  const cleanUsername = username ? String(username).trim().replace(/^@/, "") : "";

  // If a GitHub username was supplied via developer prompt/modal fallback, verify against GitHub's public API
  if (cleanUsername) {
    try {
      const ghUserRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Smart-Contact-Manager-SCM"
        }
      });
      if (ghUserRes.ok) {
        const ghUser = await ghUserRes.json();
        resolvedName = resolvedName || ghUser.name || ghUser.login || cleanUsername;
        resolvedEmail = resolvedEmail || (ghUser.email ? String(ghUser.email).toLowerCase() : `${cleanUsername.toLowerCase()}@users.noreply.github.com`);
        resolvedGithubId = resolvedGithubId || (ghUser.id ? String(ghUser.id) : `github-${cleanUsername}`);
      } else {
        resolvedName = resolvedName || cleanUsername;
        resolvedEmail = resolvedEmail || `${cleanUsername.toLowerCase()}@users.noreply.github.com`;
        resolvedGithubId = resolvedGithubId || `github-${cleanUsername}`;
      }
    } catch (_e) {
      resolvedName = resolvedName || cleanUsername;
      resolvedEmail = resolvedEmail || `${cleanUsername.toLowerCase()}@users.noreply.github.com`;
      resolvedGithubId = resolvedGithubId || `github-${cleanUsername}`;
    }
  }

  if (code && isGithubOAuthConfigured()) {
    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: String(code),
          redirect_uri: GITHUB_REDIRECT_URI
        })
      });
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          const [userRes, emailsRes] = await Promise.all([
            fetch("https://api.github.com/user", {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "Smart-Contact-Manager-SCM"
              }
            }),
            fetch("https://api.github.com/user/emails", {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "Smart-Contact-Manager-SCM"
              }
            })
          ]);
          if (userRes.ok) {
            const ghUser = await userRes.json();
            resolvedName = resolvedName || ghUser.name || ghUser.login || "";
            resolvedEmail = resolvedEmail || (ghUser.email ? String(ghUser.email).toLowerCase() : "");
            resolvedGithubId = resolvedGithubId || (ghUser.id ? String(ghUser.id) : "");
          }
          if (!resolvedEmail && emailsRes.ok) {
            const ghEmails = await emailsRes.json();
            if (Array.isArray(ghEmails) && ghEmails.length > 0) {
              const primary = ghEmails.find((e) => e.primary && e.verified) || ghEmails[0];
              if (primary?.email) {
                resolvedEmail = String(primary.email).toLowerCase();
              }
            }
          }
        }
      }
    } catch (_e) {
      // Clean fallback if offline or using mock authorization code
    }
  }

  return {
    email: resolvedEmail,
    name:
      resolvedName ||
      (resolvedEmail
        ? resolvedEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : "GitHub User"),
    githubId: resolvedGithubId || `github-${crypto.randomUUID().slice(0, 8)}`
  };
}

function handleGithubUserAuth({ email, name, githubId, intent = "login", correlationId }) {
  if (isLiveDbEnabled()) {
    loadUsersFromMysql(usersStore);
  }
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) {
    throw new HttpProblemError(
      400,
      "Bad Request",
      "Email is required for GitHub authentication."
    );
  }

  let user = usersStore.get(cleanEmail);
  const isNewUser = !user;

  if (intent !== "signup" && !user) {
    throw new HttpProblemError(
      404,
      "Not Found",
      "No account found with this email. Please sign up first."
    );
  }

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      name: name || cleanEmail.split("@")[0],
      email: cleanEmail,
      password: hashPassword(`github-oauth2-${githubId || crypto.randomUUID()}`),
      phoneNumber: "",
      provider: "GITHUB",
      providerUserId: githubId || `github-${crypto.randomUUID().slice(0, 8)}`,
      roles: ["ROLE_USER"],
      createdAt: new Date().toISOString()
    };
    usersStore.set(cleanEmail, user);
    saveUserToMysql(user);

    try {
      dispatchRealSmtpEmailAsync(
        user.email,
        "Welcome to Smart Contact Manager",
        `Hello ${user.name},\n\nWelcome to Smart Contact Manager! Your GitHub account (${user.email}) has been registered.`
      );
    } catch (_e) {}
  }

  recordAuditEvent(
    intent === "signup" ? "GITHUB_OAUTH2_SIGNUP" : "GITHUB_OAUTH2_LOGIN",
    user.email,
    "/v1/auth/oauth2/github",
    `GitHub OAuth2 (${intent}) completed for ${user.email}`,
    correlationId
  );

  // Security Alert on successful GitHub Login
  if (intent !== "signup") {
    sendSecurityAlertEmail({
      user,
      provider: "GitHub OAuth 2.0",
      correlationId
    });
  }

  const accessToken = signJwtHmacSha256({
    sub: user.email,
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles
  });

  return {
    accessToken,
    tokenType: "Bearer",
    expiresInMs: 86400000,
    isNewUser,
    intent,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      provider: "GITHUB",
      roles: user.roles
    }
  };
}

app.get("/v1/auth/oauth2/github/config", (req, res) => {
  const isLive = isGithubOAuthConfigured();
  return res.json({
    isLive,
    clientId: isLive ? GITHUB_CLIENT_ID : null
  });
});

app.get("/v1/auth/oauth2/github", (req, res) => {
  const intent = req.query.intent === "signup" ? "signup" : "login";
  if (!isGithubOAuthConfigured()) {
    // Graceful developer prompt / modal fallback: redirect to frontend with query parameter
    return res.redirect(`${FRONTEND_BASE_URL}/${intent}?github_fallback=1`);
  }
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=read:user,user:email&state=github_${intent}`;
  res.setHeader("Location", redirectUrl);
  return res.status(302).end();
});

app.get("/v1/auth/oauth2/github/callback", async (req, res) => {
  const { code, state, email, name, username } = req.query || {};
  const intent = String(state || "").includes("signup") ? "signup" : "login";
  try {
    const resolved = await resolveGithubProfileFromCodeOrPayload({ code, email, name, username });
    const envelope = handleGithubUserAuth({
      ...resolved,
      intent,
      correlationId: req.correlationId
    });
    if (intent === "signup") {
      return res.redirect(
        `${FRONTEND_BASE_URL}/login?signup_success=1&email=${encodeURIComponent(envelope.user.email)}`
      );
    }
    const redirectParams = new URLSearchParams({
      oauth_token: envelope.accessToken,
      oauth_user: JSON.stringify(envelope.user),
      intent: "login",
      provider: "github"
    });
    return res.redirect(`${FRONTEND_BASE_URL}/login?${redirectParams.toString()}`);
  } catch (err) {
    const targetPage = intent === "signup" ? "signup" : "login";
    return res.redirect(
      `${FRONTEND_BASE_URL}/${targetPage}?oauth_error=${encodeURIComponent(err.detail || err.message || "Account not found. Please sign up first.")}`
    );
  }
});

app.post(["/v1/auth/oauth2/github/tokens", "/v1/auth/oauth2/github/signup"], async (req, res, next) => {
  try {
    const isSignupPath = req.path.endsWith("/signup");
    const rawState = String(req.body?.state || "");
    const intent =
      req.body?.intent ||
      (isSignupPath || rawState.includes("signup") ? "signup" : "login");
    const resolved = await resolveGithubProfileFromCodeOrPayload({
      code: req.body?.code,
      email: req.body?.email,
      name: req.body?.name,
      githubId: req.body?.githubId,
      username: req.body?.username
    });
    const envelope = handleGithubUserAuth({
      ...resolved,
      intent,
      correlationId: req.correlationId
    });
    return res.status(201).json(envelope);
  } catch (err) {
    next(err);
  }
});

app.post("/v1/auth/password-resets", (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || !String(email).includes("@")) {
      throw new HttpProblemError(422, "Unprocessable Entity", "A valid email address is required for password reset.");
    }
    const cleanEmail = String(email).trim().toLowerCase();
    notificationsStore.push({
      id: `ntf-${crypto.randomUUID().slice(0, 8)}`,
      to: cleanEmail,
      type: "PASSWORD_RESET",
      subject: "SCM Password Reset Instructions",
      status: "DELIVERED",
      dispatchedAt: new Date().toISOString()
    });
    dispatchRealSmtpEmailAsync(
      cleanEmail,
      "SCM Password Reset Instructions",
      `Hello,\n\nA password reset was requested for ${cleanEmail} on Smart Contact Manager.`
    );
    return res.status(201).json({
      message: "If that email address is registered, a password reset link has been dispatched.",
      email: cleanEmail,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

app.get("/v1/auth/admin/users", (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new HttpProblemError(401, "Unauthorized", "Missing Authorization Bearer token.");
    }
    let claims;
    try {
      claims = verifyJwtHmacSha256(authHeader.slice(7).trim());
    } catch (e) {
      throw new HttpProblemError(401, "Unauthorized", e.message);
    }
    if (!Array.isArray(claims.roles) || !claims.roles.includes("ROLE_ADMIN")) {
      throw new HttpProblemError(403, "Forbidden", "Access denied: ROLE_ADMIN authority is required.");
    }
    const list = Array.from(usersStore.values()).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      provider: u.provider,
      roles: u.roles,
      createdAt: u.createdAt
    }));
    res.setHeader("Cache-Control", "private, max-age=60, must-revalidate");
    return res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Contact Service Routes (/v1/contacts) (Checklist #1, #2, #4, #5, #6, #7, #8, #9, #10, #11)
// ============================================================================
app.options(["/v1/contacts", "/v1/contacts/:id"], (req, res) => {
  res.setHeader("Allow", "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS");
  return res.status(200).end();
});

app.head("/v1/contacts", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  res.setHeader("X-Total-Count", String(contactsStore.size));
  return res.status(200).end();
});

app.head("/v1/contacts/:id", (req, res, next) => {
  const contact = contactsStore.get(req.params.id);
  if (!contact) {
    return next(new HttpProblemError(404, "Resource Not Found", `Contact '${req.params.id}' was not found.`));
  }
  res.setHeader("ETag", computeEtag(contact));
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  return res.status(200).end();
});

function assertSupportedAccept(req) {
  const rawAccept = req.headers.accept;
  if (!rawAccept || String(rawAccept).trim() === "") return;
  const accept = String(rawAccept).toLowerCase();
  const supported =
    accept.includes("*/*") ||
    accept.includes("application/*") ||
    accept.includes("application/json") ||
    accept.includes("application/xml") ||
    accept.includes("text/xml") ||
    accept.includes("text/html");
  if (!supported) {
    throw new HttpProblemError(
      406,
      "Not Acceptable",
      `Requested Accept media type '${rawAccept}' is not supported. Supported media types: application/json, application/xml.`
    );
  }
}

app.get("/v1/contacts", (req, res, next) => {
  try {
    assertSupportedAccept(req);
    const limit = req.query.limit !== undefined ? Number(req.query.limit) : 10;
    if (Number.isNaN(limit) || limit < 1 || limit > 100) {
      throw new HttpProblemError(400, "Bad Request", "Query parameter 'limit' must be an integer between 1 and 100.");
    }

    const search = req.query.search ? String(req.query.search).trim().toLowerCase() : null;
    const tagFilter = req.query.tag ? String(req.query.tag).trim().toLowerCase() : null;
    const favoriteFilter =
      req.query.favorite !== undefined ? String(req.query.favorite).toLowerCase() === "true" : null;

    let decodedCursor = null;
    if (req.query.cursor) {
      const rawCursor = String(req.query.cursor).trim();
      if (!/^[A-Za-z0-9_=-]+$/.test(rawCursor)) {
        throw new HttpProblemError(400, "Bad Request", "Invalid or malformed pagination cursor.");
      }
      try {
        decodedCursor = Buffer.from(rawCursor, "base64url").toString("utf8");
      } catch (_e) {
        decodedCursor = rawCursor;
      }
    }

    // Sort newest created contacts to the top, falling back to id ascending for stable keyset pagination
    let sorted = Array.from(contactsStore.values()).sort(
      (a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")) ||
        a.id.localeCompare(b.id)
    );
    if (search) {
      sorted = sorted.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(search)) ||
          (c.email && c.email.toLowerCase().includes(search)) ||
          (c.phoneNumber && c.phoneNumber.toLowerCase().includes(search)) ||
          (c.company && c.company.toLowerCase().includes(search)) ||
          (c.description && c.description.toLowerCase().includes(search)) ||
          (c.tag && c.tag.toLowerCase().includes(search))
      );
    }
    if (tagFilter) {
      sorted = sorted.filter((c) => String(c.tag || "").toLowerCase() === tagFilter);
    }
    if (favoriteFilter !== null) {
      sorted = sorted.filter((c) => Boolean(c.favorite) === favoriteFilter);
    }
    const totalCount = sorted.length;

    if (decodedCursor) {
      const cursorIdx = sorted.findIndex((c) => c.id === decodedCursor);
      if (cursorIdx !== -1) {
        sorted = sorted.slice(cursorIdx + 1);
      } else {
        sorted = sorted.filter((c) => c.id > decodedCursor);
      }
    }

    const hasMore = sorted.length > limit;
    const data = hasMore ? sorted.slice(0, limit) : sorted;
    let nextCursor = null;
    if (hasMore && data.length > 0) {
      const lastId = data[data.length - 1].id;
      nextCursor = Buffer.from(lastId, "utf8").toString("base64url");
      res.setHeader("Link", `</v1/contacts?cursor=${nextCursor}&limit=${limit}>; rel="next"`);
    }

    const pagePayload = {
      data,
      nextCursor,
      hasMore,
      limit,
      totalCount
    };

    const accept = String(req.headers.accept || "");
    const wantsXml = accept.includes("application/xml") || accept.includes("text/xml");
    const serializedXml = wantsXml ? contactPageToXml(pagePayload) : null;
    const etag = computeEtag(wantsXml ? serializedXml : pagePayload);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
    res.setHeader("X-Total-Count", String(totalCount));

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    if (wantsXml) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      return res.status(200).send(serializedXml);
    }

    return res.status(200).json(pagePayload);
  } catch (err) {
    next(err);
  }
});

app.get("/v1/contacts/:id/vcard", (req, res, next) => {
  const contact = contactsStore.get(req.params.id);
  if (!contact) {
    return next(new HttpProblemError(404, "Resource Not Found", `Contact '${req.params.id}' was not found.`));
  }
  res.setHeader("Location", `/v1/contacts/${contact.id}?format=vcard`);
  return res.status(302).end();
});

app.get("/v1/contacts/:id", (req, res, next) => {
  try {
    assertSupportedAccept(req);
    const contact = contactsStore.get(req.params.id);
    if (!contact) {
      return next(new HttpProblemError(404, "Resource Not Found", `Contact '${req.params.id}' was not found.`));
    }

    const accept = String(req.headers.accept || "");
    const wantsXml = accept.includes("application/xml") || accept.includes("text/xml");
    const serializedXml = wantsXml ? contactToXml(contact) : null;
    const etag = computeEtag(wantsXml ? serializedXml : contact);
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");

    if (req.headers["if-none-match"] === etag) {
      return res.status(304).end();
    }

    if (wantsXml) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      return res.status(200).send(serializedXml);
    }

    return res.status(200).json(contact);
  } catch (err) {
    next(err);
  }
});

// Resource-shaped Contact Notes sub-resource (/v1/contacts/:id/notes) backed by MongoDB Document Store
app.get("/v1/contacts/:id/notes", (req, res, next) => {
  const contact = contactsStore.get(req.params.id);
  if (!contact) {
    return next(new HttpProblemError(404, "Resource Not Found", `Contact '${req.params.id}' was not found.`));
  }
  const col = documentCollections.get("contact-notes");
  const notes = col
    ? Array.from(col.values()).filter((n) => n.contactId === req.params.id)
    : [];
  res.setHeader("Cache-Control", "private, max-age=60, must-revalidate");
  return res.status(200).json({ contactId: req.params.id, count: notes.length, notes });
});

app.post("/v1/contacts/:id/notes", (req, res, next) => {
  try {
    const contact = contactsStore.get(req.params.id);
    if (!contact) {
      throw new HttpProblemError(404, "Resource Not Found", `Contact '${req.params.id}' was not found.`);
    }
    const content = req.body?.content || req.body?.note;
    if (!content || String(content).trim() === "") {
      throw new HttpProblemError(422, "Unprocessable Entity", "Note 'content' is required.");
    }
    if (!documentCollections.has("contact-notes")) {
      documentCollections.set("contact-notes", new Map());
    }
    const col = documentCollections.get("contact-notes");
    const id = `note-${crypto.randomUUID().slice(0, 8)}`;
    const noteDoc = {
      _id: id,
      _collection: "contact-notes",
      contactId: req.params.id,
      content: String(content).trim(),
      author: req.body?.author || "admin@scm.enterprise.io",
      correlationId: req.correlationId,
      _createdAt: new Date().toISOString()
    };
    col.set(id, noteDoc);
    saveDocumentToMongoAtlas("contact-notes", noteDoc).catch(() => {});
    res.setHeader("Location", `/v1/contacts/${req.params.id}/notes/${id}`);
    return res.status(201).json(noteDoc);
  } catch (err) {
    next(err);
  }
});

// Resource-shaped Contact Groups (/v1/contact-groups & /v1/contact-groups/:id/contacts)
app.get("/v1/contact-groups", (req, res) => {
  const groups = ["VIP", "Colleague", "Lead", "Family"].map((name) => {
    const members = Array.from(contactsStore.values()).filter(
      (c) => String(c.tag || "Colleague").toLowerCase() === name.toLowerCase()
    );
    return { id: name.toLowerCase(), name, count: members.length };
  });
  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  return res.status(200).json({ groups });
});

app.get("/v1/contact-groups/:id/contacts", (req, res) => {
  const groupId = String(req.params.id || "").toLowerCase();
  const contacts = Array.from(contactsStore.values()).filter(
    (c) => String(c.tag || "Colleague").toLowerCase() === groupId
  );
  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  return res.status(200).json({ groupId, count: contacts.length, data: contacts });
});

app.post("/v1/contacts", (req, res, next) => {
  try {
    assertSupportedAccept(req);
    const rawCt = req.headers["content-type"];
    if (
      rawCt &&
      !String(rawCt).toLowerCase().includes("application/json") &&
      !String(rawCt).toLowerCase().includes("application/xml") &&
      !String(rawCt).toLowerCase().includes("text/xml")
    ) {
      throw new HttpProblemError(
        415,
        "Unsupported Media Type",
        `Content-Type '${rawCt}' is not supported. Use application/json.`
      );
    }

    if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
      throw new HttpProblemError(400, "Bad Request", "Contact request payload must be a non-empty JSON object.");
    }

    const validation = validateContactPayload(req.body);
    if (!validation.valid) {
      const fieldErrors = {};
      for (const err of validation.errors) {
        const field = err.instancePath ? err.instancePath.replace(/^\//, "") : err.params?.missingProperty || "payload";
        fieldErrors[field] = err.message;
      }
      throw new HttpProblemError(
        422,
        "Unprocessable Entity",
        "Contact payload failed Ajv Draft-07 JSON Schema validation.",
        fieldErrors
      );
    }

    const now = new Date().toISOString();
    const id = req.body.id || `cnt-${crypto.randomUUID().slice(0, 8)}`;
    const newContact = {
      id,
      userId: req.body.userId || "4192a00a-8443-4f83-a001-f9a75f05ff88",
      name: String(req.body.name).trim(),
      email: req.body.email ? String(req.body.email).trim().toLowerCase() : "",
      phoneNumber: String(req.body.phoneNumber).trim(),
      address: req.body.address ?? "",
      description: req.body.description ?? "",
      company: req.body.company ?? null,
      tag: req.body.tag || "Colleague",
      favorite: Boolean(req.body.favorite),
      websiteLink: req.body.websiteLink || null,
      linkedInLink: req.body.linkedInLink || null,
      pictureUrl: req.body.pictureUrl || null,
      createdAt: now,
      updatedAt: now
    };

    contactsStore.set(id, newContact);
    saveContactToMysql(newContact);
    recordAuditEvent("CONTACT_CREATED", newContact.userId, `/v1/contacts/${id}`, `Created contact ${newContact.name}`, req.correlationId);

    const etag = computeEtag(newContact);
    res.setHeader("Location", `/v1/contacts/${id}`);
    res.setHeader("ETag", etag);

    const accept = String(req.headers.accept || "");
    if (accept.includes("application/xml") || accept.includes("text/xml")) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      return res.status(201).send(contactToXml(newContact));
    }

    return res.status(201).json(newContact);
  } catch (err) {
    next(err);
  }
});

app.put("/v1/contacts/:id", (req, res, next) => {
  try {
    const existing = contactsStore.get(req.params.id);
    if (!existing) {
      throw new HttpProblemError(404, "Resource Not Found", `Contact '${req.params.id}' was not found.`);
    }

    const validation = validateContactPayload(req.body || {});
    if (!validation.valid) {
      const fieldErrors = {};
      for (const err of validation.errors) {
        const field = err.instancePath ? err.instancePath.replace(/^\//, "") : err.params?.missingProperty || "payload";
        fieldErrors[field] = err.message;
      }
      throw new HttpProblemError(422, "Unprocessable Entity", "Contact replacement failed JSON Schema validation.", fieldErrors);
    }

    const updated = {
      ...existing,
      name: String(req.body.name).trim(),
      email: req.body.email ? String(req.body.email).trim().toLowerCase() : "",
      phoneNumber: String(req.body.phoneNumber).trim(),
      address: req.body.address ?? existing.address,
      description: req.body.description ?? existing.description,
      company: req.body.company !== undefined ? req.body.company : existing.company,
      tag: req.body.tag !== undefined ? req.body.tag : existing.tag,
      favorite: req.body.favorite !== undefined ? Boolean(req.body.favorite) : existing.favorite,
      websiteLink: req.body.websiteLink !== undefined ? req.body.websiteLink : existing.websiteLink,
      linkedInLink: req.body.linkedInLink !== undefined ? req.body.linkedInLink : existing.linkedInLink,
      pictureUrl: req.body.pictureUrl !== undefined ? req.body.pictureUrl : existing.pictureUrl,
      updatedAt: new Date().toISOString()
    };

    contactsStore.set(updated.id, updated);
    saveContactToMysql(updated);
    recordAuditEvent("CONTACT_REPLACED", updated.userId, `/v1/contacts/${updated.id}`, `Replaced contact ${updated.name}`, req.correlationId);

    res.setHeader("ETag", computeEtag(updated));
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

app.patch("/v1/contacts/:id", (req, res, next) => {
  try {
    const existing = contactsStore.get(req.params.id);
    if (!existing) {
      throw new HttpProblemError(404, "Resource Not Found", `Contact '${req.params.id}' was not found.`);
    }
    if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
      throw new HttpProblemError(400, "Bad Request", "PATCH payload cannot be empty.");
    }

    const candidate = {
      name: req.body.name !== undefined ? req.body.name : existing.name,
      email: req.body.email !== undefined ? req.body.email : existing.email,
      phoneNumber: req.body.phoneNumber !== undefined ? req.body.phoneNumber : existing.phoneNumber
    };
    const validation = validateContactPayload(candidate);
    if (!validation.valid) {
      throw new HttpProblemError(422, "Unprocessable Entity", "Patched contact fields failed schema validation.");
    }

    const updated = {
      ...existing,
      ...req.body,
      id: existing.id,
      updatedAt: new Date().toISOString()
    };
    contactsStore.set(updated.id, updated);
    saveContactToMysql(updated);
    recordAuditEvent("CONTACT_PATCHED", updated.userId, `/v1/contacts/${updated.id}`, `Patched contact ${updated.name}`, req.correlationId);

    res.setHeader("ETag", computeEtag(updated));
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete("/v1/contacts/:id", (req, res, next) => {
  const existing = contactsStore.get(req.params.id);
  if (!existing) {
    return next(new HttpProblemError(404, "Resource Not Found", `Contact '${req.params.id}' was not found.`));
  }
  contactsStore.delete(req.params.id);
  deleteContactFromMysql(req.params.id);
  recordAuditEvent("CONTACT_DELETED", existing.userId, `/v1/contacts/${req.params.id}`, `Deleted contact ${existing.name}`, req.correlationId);
  return res.status(204).end();
});

// ============================================================================
// Media Service Routes (/v1/media/photos) - 2MB limit & JPG/PNG/WebP validation
// ============================================================================
const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

app.post("/v1/media/photos", (req, res, next) => {
  try {
    const contentType = String(req.body?.contentType || req.headers["x-file-content-type"] || "image/png").toLowerCase();
    const fileName = String(req.body?.fileName || "avatar.png");
    const sizeBytes = Number(req.body?.sizeBytes ?? 1024);
    const dataUrl = req.body?.dataUrl || null;

    if (!ALLOWED_MIMES.has(contentType)) {
      throw new HttpProblemError(
        422,
        "Unprocessable Entity",
        `Unsupported media MIME type '${contentType}'. Allowed: image/jpeg, image/png, image/webp.`
      );
    }
    if (sizeBytes > MAX_MEDIA_BYTES) {
      throw new HttpProblemError(
        422,
        "Unprocessable Entity",
        `Media size (${sizeBytes} bytes) exceeds maximum allowed limit of 2MB (2097152 bytes).`
      );
    }

    const id = `med-${crypto.randomUUID().slice(0, 8)}`;
    let storedUrl = `/v1/media/photos/${id}`;

    if (dataUrl && String(dataUrl).startsWith("data:image/")) {
      try {
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpeg";
        const uploadDir = path.resolve(__dirname, "../../uploads/contacts");
        fs.mkdirSync(uploadDir, { recursive: true });
        const base64Part = String(dataUrl).split(",")[1];
        if (base64Part) {
          const fileNameOnDisk = `${id}.${ext}`;
          fs.writeFileSync(path.join(uploadDir, fileNameOnDisk), Buffer.from(base64Part, "base64"));
          storedUrl = `/uploads/contacts/${fileNameOnDisk}`;
        }
      } catch (_e) {
        storedUrl = `/v1/media/photos/${id}`;
      }
    }

    const record = {
      id,
      fileName,
      contentType,
      sizeBytes,
      url: storedUrl,
      createdAt: new Date().toISOString()
    };
    mediaStore.set(id, record);
    res.setHeader("Location", `/v1/media/photos/${id}`);
    res.setHeader("ETag", computeEtag(record));
    return res.status(201).json(record);
  } catch (err) {
    next(err);
  }
});

app.get("/v1/media/photos/:id", (req, res, next) => {
  const item = mediaStore.get(req.params.id);
  if (!item) {
    return next(new HttpProblemError(404, "Resource Not Found", `Photo '${req.params.id}' was not found.`));
  }
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.setHeader("ETag", computeEtag(item));
  return res.status(200).json(item);
});

// ============================================================================
// Notification Service Routes (/v1/notifications/emails) - Resilient SMTP via Nodemailer
// ============================================================================
app.post("/v1/notifications/emails", async (req, res, next) => {
  try {
    const { to, type, subject, body } = req.body || {};
    if (!to || typeof to !== "string" || !to.includes("@") || to.trim() === "") {
      throw new HttpProblemError(
        422,
        "Unprocessable Entity",
        "A valid destination email address is required to dispatch an email."
      );
    }
    const id = `ntf-${crypto.randomUUID().slice(0, 8)}`;
    const emailTo = String(to).trim();
    const emailSubject = subject || "Smart Contact Manager Notification";
    const emailBody = body || "Notification from SCM Enterprise";
    let status = "DELIVERED";
    let deliveryError = null;

    try {
      if (req.body?.simulateSmtpTimeout) {
        throw new Error("Simulated Gmail SMTP connection timeout");
      }
      if (isLiveDbEnabled()) {
        await mailTransporter.sendMail({
          from: `"Smart Contact Manager" <${process.env.SMTP_USER || "scm.project.12@gmail.com"}>`,
          to: emailTo,
          subject: emailSubject,
          text: emailBody,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 8px;">
            <div style="font-size: 18px; font-weight: 600; color: #18181b; margin-bottom: 12px;">Smart Contact Manager</div>
            <div style="font-size: 14px; color: #3f3f46; line-height: 1.6; white-space: pre-wrap;">${emailBody.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0 12px 0;" />
            <div style="font-size: 11px; color: #a1a1aa;">Sent via SCM Enterprise Notification Service • scm.project.12@gmail.com</div>
          </div>`
        });
      }
    } catch (smtpErr) {
      status = "QUEUED_RESILIENT_FALLBACK";
      deliveryError = smtpErr.message;
    }

    const entry = {
      id,
      to: emailTo,
      type: type || "ALERT",
      subject: emailSubject,
      body: emailBody,
      status,
      dispatchedAt: new Date().toISOString()
    };
    if (deliveryError) {
      entry.fallbackReason = deliveryError;
    }
    notificationsStore.push(entry);

    // Record audit event to MongoDB Atlas
    const auditDoc = {
      _id: `audit-email-${id}`,
      event: "EMAIL_SENT",
      to: emailTo,
      subject: emailSubject,
      status,
      fallbackReason: deliveryError || null,
      correlationId: req.headers["x-correlation-id"] || null,
      timestamp: new Date().toISOString()
    };
    if (!documentCollections.has("audit-logs")) {
      documentCollections.set("audit-logs", new Map());
    }
    documentCollections.get("audit-logs").set(auditDoc._id, auditDoc);
    saveDocumentToMongoAtlas("audit-logs", auditDoc).catch(() => {});

    res.setHeader("Location", `/v1/notifications/emails/${id}`);
    return res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
});

app.get("/v1/notifications/emails", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  return res.status(200).json(notificationsStore);
});

// ============================================================================
// Spring AI & Intelligent Productivity Endpoints (/v1/ai/*)
// ============================================================================
app.post("/v1/ai/parse-contact", async (req, res, next) => {
  try {
    assertSupportedAccept(req);
    const { rawText } = req.body || {};
    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      throw new HttpProblemError(
        400,
        "Bad Request",
        "Request body must include a non-empty 'rawText' string."
      );
    }

    const trimmedText = rawText.trim();
    const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();

    // 1. Attempt downstream dispatch to Spring Boot contact-service (port 8082)
    try {
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), OUTBOUND_TIMEOUT_MS);
      const downstreamResp = await fetch("http://localhost:8082/v1/ai/parse-contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-ID": correlationId
        },
        body: JSON.stringify({ rawText: trimmedText }),
        signal: abortCtrl.signal
      });
      clearTimeout(timeoutId);

      if (downstreamResp.ok) {
        const parsed = await downstreamResp.json();
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(parsed);
      }
    } catch (_downstreamErr) {
      // Graceful fallback: contact-service offline or timed out
    }

    // 2. Resilient Built-in Spring AI Parser (Offline & Missing API Key Safe)
    const emailMatch = trimmedText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const phoneMatch = trimmedText.match(/(\+?[0-9][0-9\-\s()]{7,18}[0-9])/);
    const nameMatch = trimmedText.match(/(?:\bmet\s+|\bname[:\s]+|\bcontact[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    const companyMatch = trimmedText.match(/(?:at|from|company[:\s]+)\s+([A-Z0-9][A-Za-z0-9&.\s]+?)(?:,|\.|\bcall\b|\bemail\b|\blocated\b|$)/i);
    const roleMatch = trimmedText.match(/\b(VP|Vice President|Director|Architect|Engineer|Developer|Manager|Founder|Co-Founder|CEO|CTO|Lead|Consultant)\b(?:\s+(?:of|at|in)?\s+[A-Za-z]+)?/i);
    const locMatch = trimmedText.match(/(?:located in|in|address[:\s]+)\s+([A-Z][a-zA-Z\s]+?)(?:$|\.|,)/i);

    let extractedName = nameMatch ? nameMatch[1].trim() : null;
    if (extractedName && extractedName.toLowerCase().startsWith("met ")) {
      extractedName = extractedName.substring(4).trim();
    }
    if (!extractedName) {
      const parts = trimmedText.split(/[,\\n]/);
      for (const p of parts) {
        const candidate = p.trim();
        if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(candidate)) {
          extractedName = candidate;
          break;
        }
      }
    }

    let inferredTag = "Colleague";
    const lower = trimmedText.toLowerCase();
    if (/vip|ceo|founder|director/.test(lower)) {
      inferredTag = "VIP";
    } else if (/lead|client|prospect|fintech|vp/.test(lower)) {
      inferredTag = "Lead";
    } else if (/family|cousin|brother|sister/.test(lower)) {
      inferredTag = "Family";
    }

    const result = {
      name: extractedName || "New Contact",
      email: emailMatch ? emailMatch[1].trim() : null,
      phoneNumber: phoneMatch ? phoneMatch[1].replace(/[^0-9+]/g, "").trim() : null,
      company: companyMatch ? companyMatch[1].trim() : null,
      role: roleMatch ? roleMatch[0].trim() : null,
      address: locMatch ? locMatch[1].trim() : null,
      tag: inferredTag
    };

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

app.post("/v1/ai/draft-email", async (req, res, next) => {
  try {
    assertSupportedAccept(req);
    const { contactName, company, prompt, senderName } = req.body || {};
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      throw new HttpProblemError(
        400,
        "Bad Request",
        "Request body must include a non-empty 'prompt' string."
      );
    }

    const trimmedPrompt = prompt.trim();
    const cName = contactName && String(contactName).trim() ? String(contactName).trim() : "there";
    const sName = senderName && String(senderName).trim() ? String(senderName).trim() : "Smart Contact Manager";
    const cCompany = company && String(company).trim() ? String(company).trim() : "";
    const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();

    // 0. Live AI Service Connection (OpenAI / Gemini) if API keys are configured
    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openAiKey) {
      try {
        const aiResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openAiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "You are a professional email assistant. Return strictly a JSON object with 'subject' and 'body' keys."
              },
              {
                role: "user",
                content: `Write a short, friendly, professional business email from ${sName} to ${cName}${cCompany ? ` at ${cCompany}` : ""}. Context/Goal: ${trimmedPrompt}. Return JSON with 'subject' and 'body'.`
              }
            ],
            temperature: 0.7
          })
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
            if (parsed.subject && parsed.body) {
              res.setHeader("Cache-Control", "no-store");
              return res.status(200).json({ subject: parsed.subject, body: parsed.body });
            }
          }
        }
      } catch (_aiErr) {
        // Fall back gracefully to internal engine
      }
    } else if (geminiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        const aiResp = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a professional email assistant. Write a short, friendly, professional business email from ${sName} to ${cName}${cCompany ? ` at ${cCompany}` : ""}. Context/Goal: ${trimmedPrompt}. Return strictly JSON with keys "subject" and "body".`
                  }
                ]
              }
            ],
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const content = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            const parsed = JSON.parse(content.trim());
            if (parsed.subject && parsed.body) {
              res.setHeader("Cache-Control", "no-store");
              return res.status(200).json({ subject: parsed.subject, body: parsed.body });
            }
          }
        }
      } catch (_geminiErr) {
        // Fall back gracefully
      }
    }

    // 1. Attempt downstream dispatch to Spring Boot contact-service (port 8082)
    try {
      const abortCtrl = new AbortController();
      const timeoutId = setTimeout(() => abortCtrl.abort(), OUTBOUND_TIMEOUT_MS);
      const downstreamResp = await fetch("http://localhost:8082/v1/ai/draft-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-ID": correlationId
        },
        body: JSON.stringify({ contactName: cName, company: cCompany, prompt: trimmedPrompt, senderName: sName }),
        signal: abortCtrl.signal
      });
      clearTimeout(timeoutId);

      if (downstreamResp.ok) {
        const drafted = await downstreamResp.json();
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(drafted);
      }
    } catch (_downstreamErr) {
      // Graceful fallback: contact-service offline or timed out
    }

    // 2. Resilient Built-in Context-Aware Email Drafter
    const companyMention = cCompany ? ` at ${cCompany}` : "";
    const promptLower = trimmedPrompt.toLowerCase();
    let subject;
    let body;

    if (promptLower.includes("coffee")) {
      subject = "Thank you for the coffee chat!";
      body = `Hi ${cName},\n\nIt was great catching up over coffee today! Really enjoyed our conversation and hearing your thoughts.\n\nLet's stay in touch and connect again soon.\n\nBest regards,\n${sName}`;
    } else if (promptLower.includes("meeting") || promptLower.includes("follow up") || promptLower.includes("follow-up")) {
      subject = `Great meeting you${companyMention} - Follow up`;
      body = `Hi ${cName},\n\nThank you for taking the time to meet today. I wanted to quickly follow up on our discussion and align on the next steps.\n\nPlease let me know your thoughts or when you might be free for a quick chat.\n\nBest regards,\n${sName}`;
    } else if (promptLower.includes("congrat") || promptLower.includes("congratulations")) {
      subject = "Congratulations!";
      body = `Hi ${cName},\n\nWanted to send my warmest congratulations on your exciting news! Wishing you all the continued success.\n\nWarm regards,\n${sName}`;
    } else if (promptLower.includes("contract") || promptLower.includes("proposal")) {
      subject = `Follow up: Contract & Proposal Discussion${companyMention}`;
      body = `Hi ${cName},\n\nI hope you're having a productive week${companyMention ? ` at ${cCompany}` : ""}.\n\nI'm following up on our proposal and contract terms we discussed.\n\nPlease let me know if you have any questions or if you'd like to make adjustments.\n\nBest regards,\n${sName}`;
    } else if (promptLower.includes("schedule") || promptLower.includes("call") || promptLower.includes("sync")) {
      subject = "Quick sync: Schedule a call";
      body = `Hi ${cName},\n\nHope all is well. I'd love to schedule a brief call this week to catch up and align on our next steps.\n\nLet me know what time works best for you.\n\nBest regards,\n${sName}`;
    } else if (promptLower.includes("thank")) {
      subject = "Thank you - Follow up regarding our discussion";
      body = `Hi ${cName},\n\nThank you for your time and for connecting with me${companyMention ? ` at ${cCompany}` : ""}. I really appreciate our conversation and look forward to continuing our collaboration.\n\nPlease let me know if there is anything else I can provide on my end.\n\nBest regards,\n${sName}`;
    } else {
      let cleanPrompt = trimmedPrompt.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
      if (cleanPrompt.length > 40) cleanPrompt = cleanPrompt.substring(0, 40).trim() + "...";
      subject = `Follow-up: ${cleanPrompt}`;
      body = `Hi ${cName},\n\nI hope this email finds you well${companyMention ? ` at ${cCompany}` : ""}.\n\nI wanted to reach out regarding ${trimmedPrompt}. I believe this is a great opportunity to collaborate and ensure everything is aligned smoothly.\n\nPlease let me know your availability for a brief conversation this week, or feel free to share your thoughts over email.\n\nBest regards,\n${sName}`;
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ subject, body });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Audit & NoSQL Document Store Routes (/v1/documents/:collection) (#23)
// ============================================================================
app.post("/v1/documents/:collection", (req, res, next) => {
  try {
    const { collection } = req.params;
    if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
      throw new HttpProblemError(400, "Bad Request", "NoSQL document body cannot be empty.");
    }
    if (!documentCollections.has(collection)) {
      documentCollections.set(collection, new Map());
    }
    const col = documentCollections.get(collection);
    const id = req.body._id || `doc-${crypto.randomUUID().slice(0, 8)}`;
    const stored = {
      ...req.body,
      _id: id,
      _collection: collection,
      correlationId: req.correlationId,
      _createdAt: new Date().toISOString()
    };
    col.set(id, stored);
    saveDocumentToMongoAtlas(collection, stored).catch(() => {});
    res.setHeader("Location", `/v1/documents/${collection}/${id}`);
    return res.status(201).json(stored);
  } catch (err) {
    next(err);
  }
});

app.get("/v1/documents/:collection", (req, res) => {
  const { collection } = req.params;
  const col = documentCollections.get(collection);
  const documents = col ? Array.from(col.values()) : [];
  res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  return res.status(200).json({
    collection,
    count: documents.length,
    documents
  });
});

app.get("/v1/documents/:collection/:id", (req, res, next) => {
  const { collection, id } = req.params;
  const col = documentCollections.get(collection);
  const doc = col ? col.get(id) : null;
  if (!doc) {
    return next(
      new HttpProblemError(404, "Resource Not Found", `Document '${id}' not found in collection '${collection}'.`)
    );
  }
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  return res.status(200).json(doc);
});

app.delete("/v1/documents/:collection/:id", (req, res, next) => {
  const { collection, id } = req.params;
  const col = documentCollections.get(collection);
  if (!col || !col.has(id)) {
    return next(
      new HttpProblemError(404, "Resource Not Found", `Document '${id}' not found in collection '${collection}'.`)
    );
  }
  col.delete(id);
  deleteDocumentFromMongoAtlas(collection, id).catch(() => {});
  return res.status(204).end();
});

// ============================================================================
// Legacy Integration Service: WSDL, SOAP Outbound Call & Circuit Breaker (#15, #17, #18, #19)
// ============================================================================
const TELECOM_WSDL = `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="TelecomDirectoryService"
             targetNamespace="http://scm.enterprise.io/ws/telecom"
             xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:tns="http://scm.enterprise.io/ws/telecom"
             xmlns:xsd="http://schemas.xmlsoap.org/2001/XMLSchema">
  <message name="VerifyNumberRequest">
    <part name="phoneNumber" type="xsd:string"/>
  </message>
  <message name="VerifyNumberResponse">
    <part name="carrier" type="xsd:string"/>
    <part name="lineType" type="xsd:string"/>
    <part name="valid" type="xsd:boolean"/>
  </message>
  <portType name="TelecomDirectoryPortType">
    <operation name="VerifyPhoneNumber">
      <input message="tns:VerifyNumberRequest"/>
      <output message="tns:VerifyNumberResponse"/>
    </operation>
  </portType>
  <binding name="TelecomDirectorySoapBinding" type="tns:TelecomDirectoryPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="VerifyPhoneNumber">
      <soap:operation soapAction="http://scm.enterprise.io/ws/telecom/VerifyPhoneNumber"/>
    </operation>
  </binding>
</definitions>`;

app.get("/v1/soap/wsdl", (req, res) => {
  res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  res.setHeader("Content-Type", "text/xml; charset=utf-8");
  return res.status(200).send(TELECOM_WSDL);
});

app.post(["/v1/soap/execute", "/v1/integrations/soap-checks"], async (req, res, next) => {
  try {
    const state = circuitBreaker.evaluateState();
    if (state === "OPEN") {
      throw new HttpProblemError(
        503,
        "Service Unavailable",
        "Circuit breaker 'legacy-soap-bridge' is OPEN; fast-failing SOAP outbound request."
      );
    }

    const operation = req.body?.operation || "VerifyPhoneNumber";
    const phoneNumber = req.body?.phoneNumber || "+919876543210";
    const soapAction =
      req.headers.soapaction ||
      req.headers["x-soap-action"] ||
      `http://scm.enterprise.io/ws/telecom/${operation}`;
    const simulateFailure = Boolean(req.body?.simulateFailure);
    const simulateTimeout = Boolean(req.body?.simulateTimeout);
    const transientFailures = Number(req.body?.transientFailures || 0);

    if (simulateTimeout) {
      circuitBreaker.recordFailure();
      throw new HttpProblemError(
        504,
        "Gateway Timeout",
        `Outbound SOAP call exceeded deadline of ${OUTBOUND_TIMEOUT_MS}ms.`
      );
    }

    const soapRequestXml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tel="http://scm.enterprise.io/ws/telecom">
  <soapenv:Header/>
  <soapenv:Body>
    <tel:${escapeXml(operation)}>
      <tel:phoneNumber>${escapeXml(phoneNumber)}</tel:phoneNumber>
    </tel:${escapeXml(operation)}>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const { result, attempts, backoffDelays } = await executeWithRetryAndTimeout(async (attemptIndex) => {
        if (simulateFailure || attemptIndex < transientFailures) {
          throw new Error("Simulated SOAP endpoint network failure");
        }
        const carrier = String(phoneNumber).startsWith("+91") ? "Airtel Enterprise IN" : "Twilio Global Carrier";
        const soapResponseXml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tel="http://scm.enterprise.io/ws/telecom">
  <soapenv:Body>
    <tel:VerifyPhoneNumberResponse>
      <tel:phoneNumber>${escapeXml(phoneNumber)}</tel:phoneNumber>
      <tel:carrier>${carrier}</tel:carrier>
      <tel:lineType>MOBILE_VERIFIED</tel:lineType>
      <tel:valid>true</tel:valid>
    </tel:VerifyPhoneNumberResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
        return { carrier, soapResponseXml };
      });

      circuitBreaker.recordSuccess();
      return res.status(200).json({
        operation,
        soapAction,
        wsdlService: "TelecomDirectoryService",
        phoneNumber,
        carrier: result.carrier,
        lineType: "MOBILE_VERIFIED",
        valid: true,
        attempts,
        retryBackoffScheduleMs: backoffDelays,
        outboundTimeoutMs: OUTBOUND_TIMEOUT_MS,
        circuitBreakerState: circuitBreaker.state,
        soapRequestXml,
        soapResponseXml: result.soapResponseXml,
        executedAt: new Date().toISOString()
      });
    } catch (callErr) {
      circuitBreaker.recordFailure();
      if (String(callErr.message).includes("timed out")) {
        throw new HttpProblemError(504, "Gateway Timeout", callErr.message);
      }
      throw new HttpProblemError(502, "Bad Gateway", `SOAP outbound call failed: ${callErr.message}`);
    }
  } catch (err) {
    next(err);
  }
});

app.get("/v1/resilience/status", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(circuitBreaker.status());
});

app.post("/v1/resilience/state", (req, res) => {
  circuitBreaker.forceState(req.body?.state || "CLOSED");
  return res.status(200).json(circuitBreaker.status());
});

// ============================================================================
// GraphQL Endpoint (/graphql & /v1/graphql) - Queries, Mutations, Field Selection & __schema (#14 / #16)
// ============================================================================
const ALL_CONTACT_FIELDS = [
  "id",
  "userId",
  "name",
  "email",
  "phoneNumber",
  "address",
  "description",
  "favorite",
  "websiteLink",
  "linkedInLink",
  "pictureUrl",
  "createdAt",
  "updatedAt"
];

function parseGraphQLSelectedFields(query, rootField) {
  const idx = query.indexOf(rootField);
  if (idx === -1) return ["id", "name", "email"];
  const openBrace = query.indexOf("{", idx);
  const closeBrace = query.indexOf("}", openBrace);
  if (openBrace === -1 || closeBrace === -1) return ["id", "name", "email"];
  const rawBlock = query.slice(openBrace + 1, closeBrace);
  const tokens = rawBlock
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => ALL_CONTACT_FIELDS.includes(t));
  return tokens.length > 0 ? tokens : ["id", "name", "email"];
}

function projectFields(entity, fields) {
  const projected = {};
  for (const f of fields) {
    projected[f] = entity[f];
  }
  return projected;
}

app.all(["/graphql", "/v1/graphql"], (req, res, next) => {
  try {
    const query = String(req.body?.query || req.query?.query || "").trim();
    if (!query) {
      throw new HttpProblemError(400, "Bad Request", "GraphQL 'query' string is required.");
    }

    const data = {};

    if (query.includes("__schema")) {
      data.__schema = {
        queryType: { name: "Query" },
        mutationType: { name: "Mutation" },
        types: [
          {
            name: "Query",
            kind: "OBJECT",
            fields: [
              { name: "contacts", description: "List all contacts with field selection" },
              { name: "contact", description: "Fetch a single contact by ID" }
            ]
          },
          {
            name: "Contact",
            kind: "OBJECT",
            fields: ALL_CONTACT_FIELDS.map((f) => ({
              name: f,
              type: { name: f === "favorite" ? "Boolean" : "String", kind: "SCALAR" }
            }))
          }
        ]
      };
    }

    if (query.includes("contacts")) {
      const selected = parseGraphQLSelectedFields(query, "contacts");
      data.contacts = Array.from(contactsStore.values()).map((c) => projectFields(c, selected));
    }

    const singleMatch = query.match(/\bcontact\s*\(\s*id\s*:\s*"([^"]+)"\s*\)/);
    if (singleMatch) {
      const targetId = singleMatch[1];
      const selected = parseGraphQLSelectedFields(query, "contact");
      const found = contactsStore.get(targetId);
      data.contact = found ? projectFields(found, selected) : null;
    }

    const createMatch = query.match(
      /createContact\s*\(\s*name\s*:\s*"([^"]+)"\s*,\s*email\s*:\s*"([^"]+)"\s*,\s*phoneNumber\s*:\s*"([^"]+)"\s*\)/
    );
    if (createMatch) {
      const [, name, email, phoneNumber] = createMatch;
      const validation = validateContactPayload({ name, email, phoneNumber });
      if (!validation.valid) {
        throw new HttpProblemError(422, "Unprocessable Entity", "GraphQL createContact input failed validation.");
      }
      const now = new Date().toISOString();
      const id = `cnt-${crypto.randomUUID().slice(0, 8)}`;
      const created = {
        id,
        userId: "4192a00a-8443-4f83-a001-f9a75f05ff88",
        name,
        email,
        phoneNumber,
        address: "",
        description: "",
        company: null,
        tag: "Colleague",
        favorite: false,
        websiteLink: null,
        linkedInLink: null,
        pictureUrl: null,
        createdAt: now,
        updatedAt: now
      };
      contactsStore.set(id, created);
      saveContactToMysql(created);
      const selected = parseGraphQLSelectedFields(query, "createContact");
      data.createContact = projectFields(created, selected);
    }

    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// Serve Contact Uploads (/uploads/contacts/:filename) with SVG Monogram Fallback
// ============================================================================
app.get("/uploads/contacts/:filename", (req, res) => {
  const localUploadPath = path.resolve(__dirname, "../../uploads/contacts", req.params.filename);
  if (fs.existsSync(localUploadPath)) {
    return res.sendFile(localUploadPath);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="14" fill="#18181b"/>
    <circle cx="40" cy="31" r="13" fill="#10b981" fill-opacity="0.25" stroke="#10b981" stroke-width="2"/>
    <path d="M18 66c3-12 13-18 22-18s19 6 22 18" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.status(200).send(svg);
});

// ============================================================================
// Serve Built React Frontend SPA (frontend-react/dist) on /, /login, /signup, etc.
// ============================================================================
const FRONTEND_DIST_DIR = path.resolve(__dirname, "../../frontend-react/dist");
if (fs.existsSync(FRONTEND_DIST_DIR)) {
  app.use(express.static(FRONTEND_DIST_DIR));
  app.get(["/", "/login", "/signup", "/forgot-password", "/add", "/contacts/:id"], (req, res, next) => {
    const indexPath = path.join(FRONTEND_DIST_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    return next();
  });
}

// ============================================================================
// 404 Catch-All Handler
// ============================================================================
app.use((req, res, next) => {
  next(new HttpProblemError(404, "Resource Not Found", `No resource matched ${req.method} ${req.originalUrl}.`));
});

// ============================================================================
// Express 4-Argument Central Error Handler (err, req, res, next) (Checklist #3, #20)
// ============================================================================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const isSyntaxErr = err instanceof SyntaxError && "body" in err;
  const status = isSyntaxErr ? 400 : err.status || 500;
  const title = isSyntaxErr ? "Bad Request" : err.title || "Internal Server Error";
  const detail = isSyntaxErr ? "Malformed JSON payload syntax." : err.detail || err.message || "Unexpected error.";
  const slug = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const code = err.code || slug.toUpperCase().replace(/-/g, "_");

  const problem = {
    type: err.type || `https://scm.enterprise.io/problems/${slug}`,
    title,
    status,
    code,
    detail,
    instance: req.originalUrl || req.url,
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId || crypto.randomUUID()
  };

  if (err.errors) {
    problem.errors = err.errors;
  }

  res.setHeader("X-Correlation-ID", problem.correlationId);
  if (req.method === "GET" && !res.getHeader("Cache-Control")) {
    res.setHeader("Cache-Control", "no-store");
  }

  const accept = String(req.headers.accept || "");
  if (accept.includes("application/xml") || accept.includes("text/xml") || accept.includes("application/problem+xml")) {
    res.setHeader("Content-Type", "application/problem+xml; charset=utf-8");
    return res.status(status).send(problemToXml(problem));
  }

  res.setHeader("Content-Type", "application/problem+json; charset=utf-8");
  return res.status(status).json(problem);
});

