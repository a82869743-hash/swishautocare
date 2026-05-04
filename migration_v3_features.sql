-- ═══════════════════════════════════════════════════════════════
-- SWISH GMS V3 — Migration Script
-- Run once against the live MySQL database.
-- Safe to re-run: all statements use IF NOT EXISTS / IF NOT COLUMN.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Add v3 columns to job_cards (one per statement for MySQL compat) ────

ALTER TABLE job_cards ADD COLUMN public_token VARCHAR(64) NULL UNIQUE;
ALTER TABLE job_cards ADD COLUMN is_quick_job TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE job_cards ADD COLUMN insurance_claim_no VARCHAR(100) NULL;
ALTER TABLE job_cards ADD COLUMN insurance_company VARCHAR(150) NULL;
ALTER TABLE job_cards ADD COLUMN vehicle_make VARCHAR(100) NULL;
ALTER TABLE job_cards ADD COLUMN vehicle_model VARCHAR(100) NULL;

-- ─── 2. quick_services ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quick_services (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  service_name VARCHAR(200)     NOT NULL,
  default_rate DECIMAL(10,2)   NOT NULL DEFAULT 0,
  sort_order   INT              NOT NULL DEFAULT 0,
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed commonly-used quick services
INSERT IGNORE INTO quick_services (id, service_name, default_rate, sort_order) VALUES
  (1, 'Car Wash (Full)',     500,  1),
  (2, 'Interior Cleaning',  800,  2),
  (3, 'Engine Oil Change',  1200, 3),
  (4, 'Air Filter',         350,  4),
  (5, 'Tyre Rotation',      300,  5),
  (6, 'Wheel Balancing',    400,  6),
  (7, 'Wheel Alignment',    600,  7),
  (8, 'Battery Check',      200,  8);

-- ─── 3. advance_bookings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advance_bookings (
  id                INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  booking_no        VARCHAR(30)      NOT NULL UNIQUE,
  customer_name     VARCHAR(200)     NOT NULL,
  mobile_no         VARCHAR(15)      NOT NULL,
  reg_no            VARCHAR(20)      NULL,
  car_name          VARCHAR(150)     NULL,
  service_type      VARCHAR(150)     NULL,
  booking_date      DATE             NOT NULL,
  booking_time      TIME             NULL,
  notes             TEXT             NULL,
  status            ENUM('pending','confirmed','arrived','cancelled') NOT NULL DEFAULT 'pending',
  job_card_id       INT UNSIGNED     NULL,
  created_by        INT UNSIGNED     NULL,
  created_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_booking_date (booking_date),
  KEY idx_status       (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 4. job_card_media ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_card_media (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  job_card_id  INT UNSIGNED     NOT NULL,
  media_type   ENUM('image','video') NOT NULL DEFAULT 'image',
  stage        ENUM('before','after','other') NOT NULL DEFAULT 'before',
  file_name    VARCHAR(300)     NOT NULL,
  file_path    VARCHAR(500)     NOT NULL,
  mime_type    VARCHAR(100)     NULL,
  file_size    INT UNSIGNED     NULL COMMENT 'bytes',
  caption      VARCHAR(300)     NULL,
  uploaded_by  INT UNSIGNED     NULL,
  created_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_card_id (job_card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 5. concern_presets ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concern_presets (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  concern_text VARCHAR(300)     NOT NULL,
  category     VARCHAR(100)     NULL,
  sort_order   INT              NOT NULL DEFAULT 0,
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  created_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO concern_presets (id, concern_text, category, sort_order) VALUES
  (1,  'AC not cooling properly',          'AC',       1),
  (2,  'Unusual noise from engine',        'Engine',   2),
  (3,  'Brake noise / vibration',          'Brakes',   3),
  (4,  'Steering hard / pulling to side',  'Steering', 4),
  (5,  'Battery issue / no start',         'Electrical',5),
  (6,  'Oil leak',                         'Engine',   6),
  (7,  'Tyre puncture / uneven wear',      'Tyres',    7),
  (8,  'Dashboard warning light on',       'Electrical',8),
  (9,  'Gear shifting issue',              'Transmission',9),
  (10, 'Excessive smoke from exhaust',     'Engine',   10);

-- ─── 6. Ensure customer_concerns table exists ───────────────────
CREATE TABLE IF NOT EXISTS customer_concerns (
  id           INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  job_card_id  INT UNSIGNED     NOT NULL,
  concern_text TEXT             NOT NULL,
  created_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_card_id (job_card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── 7. bill_dispatch_log (for SMS/WhatsApp tracking) ───────────
CREATE TABLE IF NOT EXISTS bill_dispatch_log (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  job_card_id   INT UNSIGNED  NULL,
  dispatch_type VARCHAR(30)   NOT NULL DEFAULT 'sms',
  recipient_no  VARCHAR(20)   NULL,
  template_name VARCHAR(100)  NULL,
  status        VARCHAR(30)   NOT NULL DEFAULT 'sent',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_job_card (job_card_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
