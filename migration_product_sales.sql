-- ═══════════════════════════════════════════════════════════
-- Swish GMS — Product Sales Migration
-- Run this SQL on your MySQL database to create the new table
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  customer_name VARCHAR(255) DEFAULT NULL,
  payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash',
  sale_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- NOTE: The old `parts` and `parts_sales` tables are NOT dropped.
-- They remain in the database for historical data preservation.
-- The application no longer reads from or writes to them.
