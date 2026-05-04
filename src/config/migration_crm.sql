-- ═══════════════════════════════════════════════════════════════
-- SWISH AUTO CARE — CRM Dashboard Migration
-- Run AFTER the base schema.sql
-- ═══════════════════════════════════════════════════════════════

USE swish_gms;

-- ───── Table: customers ─────
CREATE TABLE IF NOT EXISTS customers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_type   ENUM('individual','corporate','fleet') DEFAULT 'individual',
  customer_name   VARCHAR(200) NOT NULL,
  company_name    VARCHAR(200),
  gstin           VARCHAR(20),
  ref_no          VARCHAR(50),
  mobile_no       VARCHAR(15) NOT NULL,
  alt_mobile      VARCHAR(15),
  email           VARCHAR(200),
  contact_person  VARCHAR(200),
  driver_name     VARCHAR(200),
  address_line    TEXT,
  colony_street   VARCHAR(200),
  city            VARCHAR(100),
  state           VARCHAR(100),
  state_code      VARCHAR(10),
  pincode         VARCHAR(10),
  birth_date      DATE,
  is_sez          TINYINT(1) DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_mobile ON customers(mobile_no);
CREATE INDEX idx_customers_name ON customers(customer_name);

-- ───── Table: vehicles ─────
CREATE TABLE IF NOT EXISTS vehicles (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT,
  reg_no          VARCHAR(20) NOT NULL,
  make            VARCHAR(100),
  model           VARCHAR(100),
  year            INT,
  variant         VARCHAR(100),
  vin             VARCHAR(50),
  engine_no       VARCHAR(50),
  fuel_type       ENUM('petrol','diesel','cng','electric','hybrid') DEFAULT 'petrol',
  vehicle_color   VARCHAR(50),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE INDEX idx_vehicles_reg ON vehicles(reg_no);
CREATE INDEX idx_vehicles_customer ON vehicles(customer_id);

-- ───── Table: customer_concerns ─────
CREATE TABLE IF NOT EXISTS customer_concerns (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id     INT NOT NULL,
  concern_text    TEXT NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);

-- ───── Table: advance_payments ─────
CREATE TABLE IF NOT EXISTS advance_payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id     INT NOT NULL,
  payment_type    ENUM('cash','upi','bank','cheque') NOT NULL,
  bank_name       VARCHAR(100),
  cheque_no       VARCHAR(50),
  amount          DECIMAL(10,2) NOT NULL,
  payment_date    DATE NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE
);

-- ───── Alter job_cards: add CRM columns ─────
ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS customer_id INT NULL AFTER mobile_no,
  ADD COLUMN IF NOT EXISTS vehicle_id INT NULL AFTER customer_id,
  ADD COLUMN IF NOT EXISTS rfe_no VARCHAR(30) NULL AFTER job_no,
  ADD COLUMN IF NOT EXISTS odometer INT NULL AFTER vehicle_id,
  ADD COLUMN IF NOT EXISTS avg_km_day INT DEFAULT 25 AFTER odometer,
  ADD COLUMN IF NOT EXISTS service_type VARCHAR(100) NULL AFTER avg_km_day,
  ADD COLUMN IF NOT EXISTS service_advisor VARCHAR(100) NULL AFTER service_type,
  ADD COLUMN IF NOT EXISTS estimated_delivery DATE NULL AFTER service_advisor,
  ADD COLUMN IF NOT EXISTS is_inhouse TINYINT(1) DEFAULT 0 AFTER estimated_delivery;

-- Update status enum to support full pipeline
ALTER TABLE job_cards MODIFY COLUMN status 
  ENUM('rfe','estimation','spares_pending','wip','ready','delivered','invoiced','active','done') DEFAULT 'rfe';

-- ───── Alter job_card_services: add parts/tax columns ─────
ALTER TABLE job_card_services
  ADD COLUMN IF NOT EXISTS item_type ENUM('part','labour') DEFAULT 'labour' AFTER service_name,
  ADD COLUMN IF NOT EXISTS part_code VARCHAR(30) NULL AFTER item_type,
  ADD COLUMN IF NOT EXISTS qty INT DEFAULT 1 AFTER part_code,
  ADD COLUMN IF NOT EXISTS rate DECIMAL(10,2) NULL AFTER qty,
  ADD COLUMN IF NOT EXISTS discount_pct DECIMAL(5,2) DEFAULT 0 AFTER rate,
  ADD COLUMN IF NOT EXISTS hsn_sac VARCHAR(20) NULL AFTER discount_pct,
  ADD COLUMN IF NOT EXISTS tax_pct DECIMAL(5,2) DEFAULT 18 AFTER hsn_sac,
  ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0 AFTER tax_pct;

-- ───── Alter admin_users: ensure role column ─────
ALTER TABLE admin_users MODIFY COLUMN role 
  ENUM('admin','service_advisor','technician') DEFAULT 'admin';

-- ───── Migrate existing flat customer data ─────
-- Populate customers table from existing job_cards
INSERT IGNORE INTO customers (customer_name, mobile_no)
  SELECT DISTINCT owner_name, mobile_no 
  FROM job_cards 
  WHERE owner_name IS NOT NULL AND owner_name != '' AND mobile_no IS NOT NULL AND mobile_no != '';

-- Link job_cards to customers
UPDATE job_cards jc
  JOIN customers c ON c.customer_name = jc.owner_name AND c.mobile_no = jc.mobile_no
  SET jc.customer_id = c.id
  WHERE jc.customer_id IS NULL AND jc.owner_name IS NOT NULL AND jc.owner_name != '';

-- Migrate active status to new pipeline
UPDATE job_cards SET status = 'wip' WHERE status = 'active';
UPDATE job_cards SET status = 'invoiced' WHERE status = 'done' AND completion_type = 'invoice';
UPDATE job_cards SET status = 'delivered' WHERE status = 'done' AND completion_type = 'estimate';
