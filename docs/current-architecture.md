# Current Monolithic Architecture & Baseline Inspection (`SCM 2.0`)

## 1. Original Monolith Overview
The original **Smart Contact Manager (SCM 2.0)** was built as a single monolithic Spring Boot web application (`scm2.0`) coupled to a single relational database (`scm`) with server-side Thymeleaf templates and tightly coupled authentication, contact persistence, image uploads, and email dispatch inside one deployable unit.

### Key Characteristics of the Original Monolith
- **Single Runtime Process**: Authentication, user registration, OAuth2 callbacks, contact CRUD, pagination, vCard export, media uploads, and SMTP notifications executed in the same JVM process.
- **Shared Database Schema (`scm`)**:
  - `users` table (`user_id`, `name`, `user_name`, `email`, `password`, `phone_number`, `provider`, `provider_user_id`, `profile_pic`, `roles`, `enabled`, `email_verified`, `phone_verified`).
  - `contact` table (`id`, `name`, `email`, `phone_number`, `address`, `description`, `favorite`, `website_link`, `linkedin_link`, `linked_in_link`, `picture`, `facebook_link`, `user_user_id`).
- **Tightly Coupled Failure Domains**:
  - A slow or unreachable Gmail SMTP server blocked user registration threads.
  - No outbound timeouts, bounded retries, or circuit breakers existed around external telecom/SOAP or mail integrations.
  - No standardized RFC 7807 Problem Details error contract, no `Idempotency-Key` protection on `POST`, and no cursor pagination with RFC 5988 `Link` headers.
  - No polyglot NoSQL document store (`MongoDB`) for high-volume audit logs, contact notes, or activity streams.

---

## 2. Preserved Application Features
All user-facing workflows from the original Smart Contact Manager are preserved in the microservices transformation:
1. **Mandatory Sign-Up-First Authentication Workflow**:
   - Unauthenticated visitors are directed to `/signup` first.
   - Registration supports `LOCAL` (email + BCrypt/scrypt password + country code phone number), `GOOGLE` OAuth 2.0, and `GITHUB` OAuth 2.0.
   - Post-registration redirects to `/login` requiring explicit credential verification before entering the dashboard (`/`).
   - Unregistered email/Google/GitHub login attempts on `/login` are rejected with an RFC 7807 `404 Resource Not Found` error (`"No account found with this email. Please sign up first."`).
2. **Contact Management (CRUD, Search, Segment Filtering & Country Code Selector)**:
   - Create, view, replace (`PUT`), partially update (`PATCH`), and delete (`DELETE` with confirmation dialog) contacts.
   - Country code selector (`+91`, `+1`, `+44`, `+61`, `+49`, `+65`, `+971`) with E.164 normalization and Ajv Draft-07 JSON Schema validation (`contact-schema.json`).
   - Segment filtering (`All Contacts`, `Favorites`, `VIP`, `Colleague`, `Lead`, `Family`) and live search across name, email, phone, company, and role.
3. **Media Photo Uploads & vCard Export**:
   - Contact photo upload (`<= 2MB`, `image/jpeg`, `image/png`, `image/webp`) and vCard redirection (`GET /v1/contacts/{id}/vcard`).
4. **Resilient Welcome & Password Recovery Emails**:
   - Asynchronous SMTP email dispatch (`smtp.gmail.com:587`) isolated so mail latency never blocks registration or login.
