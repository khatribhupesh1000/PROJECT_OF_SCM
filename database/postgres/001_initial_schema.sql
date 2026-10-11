-- Smart Contact Manager (SCM) Relational Schema Migration (PostgreSQL 16 Compatible)
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  id VARCHAR(64),
  name VARCHAR(255),
  user_name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  phone_number VARCHAR(255),
  provider VARCHAR(255) DEFAULT 'SELF',
  provider_user_id VARCHAR(255),
  profile_pic VARCHAR(1000),
  roles VARCHAR(255) DEFAULT 'ROLE_USER',
  enabled BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT TRUE,
  phone_verified BOOLEAN DEFAULT FALSE,
  created_at VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS contact (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(255),
  address VARCHAR(255),
  description VARCHAR(255),
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  website_link VARCHAR(255),
  linkedin_link VARCHAR(255),
  linked_in_link VARCHAR(255),
  picture VARCHAR(255),
  facebook_link VARCHAR(255),
  user_user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contact_user ON contact(user_user_id);
CREATE INDEX IF NOT EXISTS idx_contact_email ON contact(email);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  scope VARCHAR(255) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
