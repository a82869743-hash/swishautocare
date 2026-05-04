-- ═══════════════════════════════════════════════════════════════
-- GK AUTOHERB — Billing System Migration
-- Adds: job_card_services, invoices, estimates tables
-- Alters: job_cards (add completion_type column)
-- ═══════════════════════════════════════════════════════════════

USE swish_gms;

-- 1. Job Card Services — line items for each job card
CREATE TABLE IF NOT EXISTS job_card_services (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT NOT NULL,
  service_name  VARCHAR(200) NOT NULL,
  amount        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);
CREATE INDEX idx_jcs_job ON job_card_services(job_card_id);

-- 2. Invoices — GST-applied completed job cards
CREATE TABLE IF NOT EXISTS invoices (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT NOT NULL,
  invoice_no    VARCHAR(30) UNIQUE NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL,
  gst_percent   DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  gst_amount    DECIMAL(10,2) NOT NULL,
  total_amount  DECIMAL(10,2) NOT NULL,
  payment_mode  ENUM('cash','upi','card','bank') NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE RESTRICT
);
CREATE INDEX idx_inv_job ON invoices(job_card_id);
CREATE INDEX idx_inv_date ON invoices(created_at);

-- 3. Estimates — Non-GST completed job cards (for monthly backup)
CREATE TABLE IF NOT EXISTS estimates (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT NOT NULL,
  estimate_no   VARCHAR(30) UNIQUE NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL,
  payment_mode  ENUM('cash','upi','card','bank') NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE RESTRICT
);
CREATE INDEX idx_est_job ON estimates(job_card_id);
CREATE INDEX idx_est_date ON estimates(created_at);

-- 4. Add completion_type to job_cards
-- Safe: only adds column if it doesn't exist (MySQL will error if exists, that's OK)
ALTER TABLE job_cards
  ADD COLUMN completion_type ENUM('invoice','estimate') NULL AFTER status;
