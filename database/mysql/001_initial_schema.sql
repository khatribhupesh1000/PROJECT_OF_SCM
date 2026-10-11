-- Smart Contact Manager (SCM) Relational Schema Migration (MySQL 8.0 / Aiven Cloud defaultdb)
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) NOT NULL PRIMARY KEY,
  id VARCHAR(64) NULL,
  name VARCHAR(255) NULL,
  user_name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NULL,
  phone_number VARCHAR(255) NULL,
  provider VARCHAR(255) DEFAULT 'SELF',
  provider_user_id VARCHAR(255) NULL,
  profile_pic VARCHAR(1000) NULL,
  roles VARCHAR(255) DEFAULT 'ROLE_USER',
  enabled BIT(1) DEFAULT b'1',
  email_verified BIT(1) DEFAULT b'1',
  phone_verified BIT(1) DEFAULT b'0',
  created_at VARCHAR(64) NULL,
  INDEX idx_users_email (email)
);

CREATE TABLE IF NOT EXISTS contact (
  id VARCHAR(255) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone_number VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  description VARCHAR(255) NULL,
  favorite BIT(1) NOT NULL DEFAULT b'0',
  website_link VARCHAR(255) NULL,
  linkedin_link VARCHAR(255) NULL,
  linked_in_link VARCHAR(255) NULL,
  picture VARCHAR(255) NULL,
  facebook_link VARCHAR(255) NULL,
  user_user_id VARCHAR(255) NULL,
  INDEX idx_contact_user (user_user_id),
  INDEX idx_contact_email (email)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key VARCHAR(255) NOT NULL PRIMARY KEY,
  scope VARCHAR(255) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_status INT NOT NULL,
  response_body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL
);
