-- ═══════════════════════════════════════════════════════════════
-- SWISH AUTO CARE — AutoRox-Style Service Entry & Billing Migration
-- Run AFTER migration_crm.sql
-- ═══════════════════════════════════════════════════════════════

USE swish_gms;

-- ───── 1. service_catalog — Master service/part definitions ─────
CREATE TABLE IF NOT EXISTS service_catalog (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  category        ENUM('mechanical','electrical','body','detailing','ac','tyre','oil','general','parts') DEFAULT 'general',
  item_type       ENUM('part','labour') DEFAULT 'labour',
  default_rate    DECIMAL(10,2) DEFAULT 0.00,
  hsn_sac         VARCHAR(20) NULL,
  tax_pct         DECIMAL(5,2) DEFAULT 18.00,
  is_active       TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_catalog_category ON service_catalog(category);
CREATE INDEX idx_catalog_name ON service_catalog(name);

-- ───── 2. bill_dispatch_log — WhatsApp / SMS dispatch audit ─────
CREATE TABLE IF NOT EXISTS bill_dispatch_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  job_card_id     INT NOT NULL,
  dispatch_type   ENUM('whatsapp','sms') NOT NULL,
  recipient_no    VARCHAR(20) NOT NULL,
  template_name   VARCHAR(100) NULL,
  status          ENUM('sent','failed','pending') DEFAULT 'pending',
  provider_ref    VARCHAR(200) NULL,
  error_message   TEXT NULL,
  dispatched_by   INT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (dispatched_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_dispatch_job ON bill_dispatch_log(job_card_id);
CREATE INDEX idx_dispatch_date ON bill_dispatch_log(created_at);

-- ═══════════════════════════════════════════════════════════════
-- 3. Alter job_card_services — Add AutoRox columns
-- ═══════════════════════════════════════════════════════════════
-- These use IF NOT EXISTS to be safe for re-runs
ALTER TABLE job_card_services
  ADD COLUMN IF NOT EXISTS part_no VARCHAR(50) NULL AFTER part_code,
  ADD COLUMN IF NOT EXISTS labour_code VARCHAR(30) NULL AFTER part_no,
  ADD COLUMN IF NOT EXISTS price_type ENUM('fixed','variable') DEFAULT 'fixed' AFTER labour_code,
  ADD COLUMN IF NOT EXISTS is_selected TINYINT(1) DEFAULT 1 AFTER tax_amount,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0 AFTER is_selected;

-- ═══════════════════════════════════════════════════════════════
-- 4. Alter job_cards — Add insurance/corporate/approval/parts fields
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE job_cards
  ADD COLUMN IF NOT EXISTS insurance_company VARCHAR(200) NULL AFTER is_inhouse,
  ADD COLUMN IF NOT EXISTS claim_no VARCHAR(100) NULL AFTER insurance_company,
  ADD COLUMN IF NOT EXISTS policy_no VARCHAR(100) NULL AFTER claim_no,
  ADD COLUMN IF NOT EXISTS corporate_name VARCHAR(200) NULL AFTER policy_no,
  ADD COLUMN IF NOT EXISTS approval_status ENUM('pending','approved','rejected') DEFAULT 'pending' AFTER corporate_name,
  ADD COLUMN IF NOT EXISTS approved_amount DECIMAL(10,2) NULL AFTER approval_status,
  ADD COLUMN IF NOT EXISTS parts_ordered INT DEFAULT 0 AFTER approved_amount,
  ADD COLUMN IF NOT EXISTS parts_inward INT DEFAULT 0 AFTER parts_ordered,
  ADD COLUMN IF NOT EXISTS parts_issued INT DEFAULT 0 AFTER parts_inward,
  ADD COLUMN IF NOT EXISTS parts_pending INT DEFAULT 0 AFTER parts_issued;

-- ═══════════════════════════════════════════════════════════════
-- 5. Seed service_catalog with Indian automotive service data
-- ═══════════════════════════════════════════════════════════════
INSERT IGNORE INTO service_catalog (name, category, item_type, default_rate, hsn_sac, tax_pct) VALUES
-- Mechanical
('Engine Oil Change', 'oil', 'labour', 500.00, '998714', 18.00),
('Oil Filter Replacement', 'oil', 'part', 350.00, '842123', 18.00),
('Air Filter Cleaning', 'mechanical', 'labour', 200.00, '998714', 18.00),
('Air Filter Replacement', 'mechanical', 'part', 450.00, '842131', 18.00),
('Brake Pad Replacement (Front)', 'mechanical', 'part', 1800.00, '681381', 18.00),
('Brake Pad Replacement (Rear)', 'mechanical', 'part', 1500.00, '681381', 18.00),
('Disc Skimming', 'mechanical', 'labour', 800.00, '998714', 18.00),
('Clutch Plate Replacement', 'mechanical', 'part', 4500.00, '870893', 18.00),
('Timing Belt Replacement', 'mechanical', 'part', 3500.00, '401039', 18.00),
('Coolant Flush', 'mechanical', 'labour', 600.00, '998714', 18.00),
('Radiator Repair', 'mechanical', 'labour', 1200.00, '998714', 18.00),
('Suspension Check & Repair', 'mechanical', 'labour', 2000.00, '998714', 18.00),
-- Electrical
('Battery Replacement', 'electrical', 'part', 4500.00, '850710', 18.00),
('Alternator Repair', 'electrical', 'labour', 2500.00, '998714', 18.00),
('Starter Motor Repair', 'electrical', 'labour', 2000.00, '998714', 18.00),
('Head Light Replacement', 'electrical', 'part', 1500.00, '851210', 18.00),
('Wiring Harness Repair', 'electrical', 'labour', 1800.00, '998714', 18.00),
-- Body
('Denting', 'body', 'labour', 3000.00, '998714', 18.00),
('Painting (Per Panel)', 'body', 'labour', 4000.00, '998714', 18.00),
('Full Body Polish', 'body', 'labour', 5000.00, '998714', 18.00),
('Bumper Repair', 'body', 'labour', 2500.00, '998714', 18.00),
('Windshield Replacement', 'body', 'part', 8000.00, '700711', 18.00),
-- Detailing
('Interior Deep Clean', 'detailing', 'labour', 2500.00, '998714', 18.00),
('Exterior Wash & Wax', 'detailing', 'labour', 800.00, '998714', 18.00),
('Ceramic Coating', 'detailing', 'labour', 15000.00, '998714', 18.00),
('PPF Installation (Per Panel)', 'detailing', 'labour', 5000.00, '998714', 18.00),
('Seat Cover Installation', 'detailing', 'labour', 1500.00, '998714', 18.00),
-- AC
('AC Gas Top-Up', 'ac', 'labour', 1500.00, '998714', 18.00),
('AC Compressor Repair', 'ac', 'labour', 5000.00, '998714', 18.00),
('AC Condenser Cleaning', 'ac', 'labour', 800.00, '998714', 18.00),
('Cabin Filter Replacement', 'ac', 'part', 600.00, '842139', 18.00),
-- Tyre
('Wheel Alignment', 'tyre', 'labour', 600.00, '998714', 18.00),
('Wheel Balancing', 'tyre', 'labour', 400.00, '998714', 18.00),
('Tyre Rotation', 'tyre', 'labour', 300.00, '998714', 18.00),
('Puncture Repair', 'tyre', 'labour', 150.00, '998714', 18.00),
('Tyre Replacement', 'tyre', 'part', 4000.00, '401110', 18.00),
-- General
('Scanning / Diagnostics', 'general', 'labour', 500.00, '998714', 18.00),
('Road Test', 'general', 'labour', 0.00, '998714', 18.00),
('Pickup & Drop', 'general', 'labour', 300.00, '998714', 18.00),
('Towing Charges', 'general', 'labour', 1500.00, '998714', 18.00),
('General Inspection', 'general', 'labour', 0.00, '998714', 18.00);
