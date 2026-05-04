-- ============================================================
-- QUICK JOB CARD + PUBLIC TRACKING TOKEN
-- migration_quick_jobcard.sql
-- Run AFTER all existing migrations
-- ============================================================

-- Add public tracking token to existing job_cards table
-- (Safe: will fail silently if columns already exist)
ALTER TABLE job_cards ADD COLUMN public_token VARCHAR(64) UNIQUE DEFAULT NULL;
ALTER TABLE job_cards ADD COLUMN is_quick_job TINYINT(1) DEFAULT 0;

-- Quick services preset table (for quick job card service buttons)
CREATE TABLE IF NOT EXISTS quick_services (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  service_name VARCHAR(150) NOT NULL,
  default_rate DECIMAL(10,2) DEFAULT 0.00,
  is_active    TINYINT(1) DEFAULT 1,
  sort_order   INT DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default quick services
INSERT IGNORE INTO quick_services (service_name, default_rate, sort_order) VALUES
  ('Exterior Wash',        300.00, 1),
  ('Interior Vacuum',      400.00, 2),
  ('Full Car Wash',        600.00, 3),
  ('Engine Bay Cleaning',  800.00, 4),
  ('Tyre Dressing',        250.00, 5),
  ('Dashboard Polish',     350.00, 6),
  ('Foam Wash',            500.00, 7),
  ('Ceramic Coating',     5000.00, 8);

-- ============================================================
