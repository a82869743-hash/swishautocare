-- GK AUTOHERB GMS — Full Database Schema (Updated with Billing System)
-- MySQL 8.x

CREATE DATABASE IF NOT EXISTS swish_gms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE swish_gms;

-- ═══════════════════════════════════════════════════════════════
-- Table 1: admin_users
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(150) NOT NULL DEFAULT '',
  role          VARCHAR(50) DEFAULT 'admin',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════
-- Table 2: staff
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS staff (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  staff_code       VARCHAR(20) UNIQUE NOT NULL,
  full_name        VARCHAR(150) NOT NULL,
  role             VARCHAR(100),
  mobile_no        VARCHAR(15),
  date_of_joining  DATE,
  monthly_salary   DECIMAL(10,2) DEFAULT 0.00,
  is_active        TINYINT(1) DEFAULT 1,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════
-- Table 3: job_cards (UPDATED — removed old single-service fields, added completion_type)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS job_cards (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  job_no            VARCHAR(30) UNIQUE NOT NULL,
  reg_no            VARCHAR(20) NOT NULL,
  car_name          VARCHAR(100) NOT NULL,
  owner_name        VARCHAR(150) NOT NULL DEFAULT '',
  mobile_no         VARCHAR(15),
  assigned_staff_id INT,
  status            ENUM('active','done') DEFAULT 'active',
  completion_type   ENUM('invoice','estimate') NULL DEFAULT NULL,
  final_amount      DECIMAL(10,2) NULL DEFAULT NULL,
  payment_mode      ENUM('cash','upi','card','bank') NULL DEFAULT NULL,
  notes             TEXT,
  job_date          DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at         DATETIME NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX idx_job_cards_date ON job_cards(job_date);
CREATE INDEX idx_job_cards_status ON job_cards(status);
CREATE INDEX idx_job_cards_reg ON job_cards(reg_no);
CREATE INDEX idx_job_cards_completion ON job_cards(completion_type);

-- ═══════════════════════════════════════════════════════════════
-- Table 4: job_card_services (NEW — line-item services per job card)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS job_card_services (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT NOT NULL,
  service_name  VARCHAR(200) NOT NULL,
  amount        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);

CREATE INDEX idx_jcs_job_card ON job_card_services(job_card_id);

-- ═══════════════════════════════════════════════════════════════
-- Table 5: invoices (NEW — generated when job is completed with GST)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS invoices (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT NOT NULL UNIQUE,
  invoice_no    VARCHAR(30) UNIQUE NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL,
  gst_percent   DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  gst_amount    DECIMAL(10,2) NOT NULL,
  total_amount  DECIMAL(10,2) NOT NULL,
  payment_mode  ENUM('cash','upi','card','bank') NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);

CREATE INDEX idx_invoices_date ON invoices(created_at);

-- ═══════════════════════════════════════════════════════════════
-- Table 6: estimates (NEW — saved when job is completed without GST)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS estimates (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id   INT NOT NULL UNIQUE,
  estimate_no   VARCHAR(30) UNIQUE NOT NULL,
  subtotal      DECIMAL(10,2) NOT NULL,
  payment_mode  ENUM('cash','upi','card','bank') NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);

CREATE INDEX idx_estimates_date ON estimates(created_at);

-- ═══════════════════════════════════════════════════════════════
-- Table 7: attendance
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS attendance (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  staff_id        INT NOT NULL,
  attendance_date DATE NOT NULL,
  status          ENUM('present','absent','half') NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_staff_date (staff_id, attendance_date),
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

CREATE INDEX idx_attendance_date ON attendance(attendance_date);

-- ═══════════════════════════════════════════════════════════════
-- Table 8: staff_payments
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS staff_payments (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  staff_id           INT NOT NULL,
  payment_date       DATE NOT NULL,
  payment_month      VARCHAR(50) NOT NULL,
  days_present       INT DEFAULT 0,
  calculated_salary  DECIMAL(10,2) DEFAULT 0.00,
  paid_amount        DECIMAL(10,2) NOT NULL,
  payment_type       ENUM('salary','advance','bonus','deduction') NOT NULL,
  payment_mode       ENUM('cash','bank','upi') NOT NULL,
  notes              TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT
);

CREATE INDEX idx_payments_staff ON staff_payments(staff_id);
CREATE INDEX idx_payments_date ON staff_payments(payment_date);

-- ═══════════════════════════════════════════════════════════════
-- Table 9: product_sales (simplified — no inventory tracking)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS product_sales (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  product_name   VARCHAR(200) NOT NULL,
  price          DECIMAL(10,2) NOT NULL,
  customer_name  VARCHAR(150),
  payment_mode   ENUM('cash','upi','card','bank') NOT NULL,
  sale_date      DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_sales_date ON product_sales(sale_date);

-- ═══════════════════════════════════════════════════════════════
-- Table 10: cash_ledger
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cash_ledger (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  entry_type   ENUM('in','out') NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  category     VARCHAR(100),
  description  VARCHAR(500) NOT NULL,
  entry_date   DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_cash_ledger_date ON cash_ledger(entry_date);

-- Run seed.js after schema creation to seed admin user and staff data
