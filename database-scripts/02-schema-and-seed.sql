-- ============================================================
-- Script 2 of 2 — Schema + seed data
-- Idempotent: safe to re-run on an existing database.
-- Password hashes use BCrypt (cost 10) compatible with Spring
-- Security's BCryptPasswordEncoder.
-- ============================================================


-- ============================================================
-- AUTH SERVICE — tour_auth_db
-- ============================================================
USE tour_auth_db;

CREATE TABLE IF NOT EXISTS roles (
  id   BIGINT       PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50)  UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
  full_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(100) UNIQUE NOT NULL,
  phone      VARCHAR(20),
  password   VARCHAR(255) NOT NULL,
  password_reset_code_hash VARCHAR(255),
  password_reset_code_expires_at DATETIME,
  password_reset_verified BOOLEAN DEFAULT FALSE,
  enabled    BOOLEAN      DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_code_expires_at DATETIME;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_verified BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Seed roles (DataInitializer also does this at boot; harmless either way)
INSERT IGNORE INTO roles (name) VALUES
  ('ADMIN'),
  ('TRAVEL_MANAGER'),
  ('STAFF'),
  ('CUSTOMER');

-- Seed default admin user
-- Credentials: email=admin  password=admin  (BCrypt hash below)
INSERT IGNORE INTO users (full_name, email, phone, password, enabled, created_at, updated_at)
VALUES ('Admin', 'admin', NULL,
        '$2b$10$ak7396aaA.kDx3DdyTYJfeLGV2lDAMzzq0PKwenukzTjGGIm6dqNW',
        TRUE, NOW(), NOW());

INSERT IGNORE INTO user_roles (user_id, role_id)
  SELECT u.id, r.id FROM users u, roles r
  WHERE u.email = 'admin' AND r.name = 'ADMIN';


-- ============================================================
-- TOUR SERVICE — tour_service_db
-- ============================================================
USE tour_service_db;

CREATE TABLE IF NOT EXISTS destinations (
  id          BIGINT       PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  country     VARCHAR(100),
  description TEXT,
  image_url   VARCHAR(255),
  status      VARCHAR(20)  DEFAULT 'ACTIVE',
  created_at  DATETIME,
  updated_at  DATETIME
);

CREATE TABLE IF NOT EXISTS tour_packages (
  id                  BIGINT          PRIMARY KEY AUTO_INCREMENT,
  title               VARCHAR(150)    NOT NULL,
  description         TEXT,
  image_url           VARCHAR(255),
  destination_id      BIGINT,
  price               DECIMAL(10,2)   NOT NULL,
  duration_days       INT             NOT NULL,
  max_capacity        INT             NOT NULL,
  bookings_available  INT             NOT NULL,
  start_date          DATE,
  end_date            DATE,
  itinerary_highlights_json TEXT,
  whats_included_json      TEXT,
  status              VARCHAR(20)     DEFAULT 'ACTIVE',
  created_at          DATETIME,
  updated_at          DATETIME,
  CONSTRAINT fk_tour_destination FOREIGN KEY (destination_id) REFERENCES destinations(id)
);

ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS itinerary_highlights_json TEXT;
ALTER TABLE tour_packages ADD COLUMN IF NOT EXISTS whats_included_json TEXT;

CREATE TABLE IF NOT EXISTS tour_schedules (
  id              BIGINT       PRIMARY KEY AUTO_INCREMENT,
  tour_package_id BIGINT,
  start_date      DATE         NOT NULL,
  end_date        DATE         NOT NULL,
  departure_time  TIME,
  return_time     TIME,
  meeting_point   VARCHAR(255),
  status          VARCHAR(20)  DEFAULT 'SCHEDULED',
  created_at      DATETIME,
  updated_at      DATETIME,
  CONSTRAINT fk_schedule_package FOREIGN KEY (tour_package_id) REFERENCES tour_packages(id)
);

-- Seed destination
INSERT IGNORE INTO destinations (name, country, description, status)
VALUES ('Goa Beaches', 'India', 'Sunny beach destination', 'ACTIVE');

-- Seed tour package (only if not already present)
INSERT INTO tour_packages
  (title, description, image_url, destination_id, price, duration_days,
   max_capacity, bookings_available, start_date, end_date, status)
SELECT
  'Goa Weekend Escape',
  '2 nights and 3 days package',
  'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&h=800&fit=crop&auto=format',
  d.id,
  12000.00, 3, 40, 40,
  CURDATE(),
  DATE_ADD(CURDATE(), INTERVAL 2 YEAR),
  'ACTIVE'
FROM destinations d
WHERE d.name = 'Goa Beaches'
  AND NOT EXISTS (SELECT 1 FROM tour_packages WHERE title = 'Goa Weekend Escape');


-- ============================================================
-- BOOKING SERVICE — tour_booking_db
-- ============================================================
USE tour_booking_db;

CREATE TABLE IF NOT EXISTS bookings (
  id                BIGINT       PRIMARY KEY AUTO_INCREMENT,
  booking_reference VARCHAR(50)  UNIQUE NOT NULL,
  user_id           BIGINT       NOT NULL,
  tour_package_id   BIGINT       NOT NULL,
  schedule_id       BIGINT       NOT NULL,
  number_of_people  INT          NOT NULL,
  total_amount      DECIMAL(10,2) NOT NULL,
  booking_status    VARCHAR(30)  NOT NULL,
  payment_status    VARCHAR(30)  NOT NULL,
  booking_date      DATETIME,
  created_at        DATETIME,
  updated_at        DATETIME
);

CREATE TABLE IF NOT EXISTS booking_travelers (
  id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT       NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name  VARCHAR(100),
  age        INT          NOT NULL,
  CONSTRAINT fk_bt_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id                 BIGINT       PRIMARY KEY AUTO_INCREMENT,
  booking_id         BIGINT       NOT NULL,
  payment_reference  VARCHAR(50)  UNIQUE NOT NULL,
  amount             DECIMAL(10,2) NOT NULL,
  payment_method     VARCHAR(50),
  payment_status     VARCHAR(30),
  transaction_type   VARCHAR(30)  DEFAULT 'MOCK',
  paid_at            DATETIME,
  created_at         DATETIME,
  CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id             BIGINT       PRIMARY KEY AUTO_INCREMENT,
  booking_id     BIGINT       NOT NULL,
  invoice_number VARCHAR(50)  UNIQUE NOT NULL,
  invoice_date   DATETIME,
  amount         DECIMAL(10,2) NOT NULL,
  remarks        VARCHAR(255),
  CONSTRAINT fk_invoice_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
);


-- ============================================================
-- NOTIFICATION SERVICE — tour_notification_db
-- ============================================================
USE tour_notification_db;

CREATE TABLE IF NOT EXISTS email_logs (
  id              BIGINT       PRIMARY KEY AUTO_INCREMENT,
  recipient_email VARCHAR(100) NOT NULL,
  subject         VARCHAR(200),
  message_body    TEXT,
  status          VARCHAR(30),
  sent_at         DATETIME
);
