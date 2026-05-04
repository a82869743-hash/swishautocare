-- Vehicle Master Migration
-- Pre-loaded catalog of all Indian car brands & models with fuel type mapping

CREATE TABLE IF NOT EXISTS vehicle_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  fuel_types JSON DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  INDEX idx_vm_make (make),
  INDEX idx_vm_model (model)
);

-- ═══════════════════════════════════
-- SEED: All Indian Car Brands + Models
-- ═══════════════════════════════════

INSERT INTO vehicle_master (make, model, fuel_types) VALUES
-- MARUTI SUZUKI
('Maruti Suzuki', 'Alto 800', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'Alto K10', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'S-Presso', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'Celerio', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'WagonR', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'Swift', '["Petrol"]'),
('Maruti Suzuki', 'Dzire', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'Baleno', '["Petrol"]'),
('Maruti Suzuki', 'Ignis', '["Petrol"]'),
('Maruti Suzuki', 'Fronx', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'Brezza', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'Ertiga', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'XL6', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'Grand Vitara', '["Petrol", "Hybrid"]'),
('Maruti Suzuki', 'Jimny', '["Petrol"]'),
('Maruti Suzuki', 'Invicto', '["Petrol", "Hybrid"]'),
('Maruti Suzuki', 'Ciaz', '["Petrol"]'),
('Maruti Suzuki', 'Eeco', '["Petrol", "CNG"]'),
('Maruti Suzuki', 'Super Carry', '["Petrol", "CNG"]'),

-- HYUNDAI
('Hyundai', 'Grand i10 Nios', '["Petrol", "CNG"]'),
('Hyundai', 'i20', '["Petrol", "Diesel"]'),
('Hyundai', 'Aura', '["Petrol", "CNG"]'),
('Hyundai', 'Venue', '["Petrol", "Diesel"]'),
('Hyundai', 'Creta', '["Petrol", "Diesel"]'),
('Hyundai', 'Creta Electric', '["Electric"]'),
('Hyundai', 'Alcazar', '["Petrol", "Diesel"]'),
('Hyundai', 'Tucson', '["Petrol", "Diesel"]'),
('Hyundai', 'Verna', '["Petrol"]'),
('Hyundai', 'Exter', '["Petrol", "CNG"]'),
('Hyundai', 'Ioniq 5', '["Electric"]'),
('Hyundai', 'Ioniq 6', '["Electric"]'),

-- TATA
('Tata', 'Tiago', '["Petrol", "CNG"]'),
('Tata', 'Tiago EV', '["Electric"]'),
('Tata', 'Tigor', '["Petrol", "CNG"]'),
('Tata', 'Tigor EV', '["Electric"]'),
('Tata', 'Altroz', '["Petrol", "Diesel", "CNG"]'),
('Tata', 'Altroz EV', '["Electric"]'),
('Tata', 'Punch', '["Petrol", "CNG"]'),
('Tata', 'Punch EV', '["Electric"]'),
('Tata', 'Nexon', '["Petrol", "Diesel"]'),
('Tata', 'Nexon EV', '["Electric"]'),
('Tata', 'Harrier', '["Diesel"]'),
('Tata', 'Safari', '["Diesel"]'),
('Tata', 'Curvv', '["Petrol", "Diesel"]'),
('Tata', 'Curvv EV', '["Electric"]'),
('Tata', 'Sierra EV', '["Electric"]'),

-- MAHINDRA
('Mahindra', 'KUV100', '["Petrol", "Diesel"]'),
('Mahindra', 'Bolero', '["Diesel"]'),
('Mahindra', 'Bolero Neo', '["Diesel"]'),
('Mahindra', 'Scorpio Classic', '["Diesel"]'),
('Mahindra', 'Scorpio N', '["Petrol", "Diesel"]'),
('Mahindra', 'XUV300', '["Petrol", "Diesel"]'),
('Mahindra', 'XUV400 EV', '["Electric"]'),
('Mahindra', 'XUV700', '["Petrol", "Diesel"]'),
('Mahindra', 'Thar', '["Petrol", "Diesel"]'),
('Mahindra', 'Thar Roxx', '["Petrol", "Diesel"]'),
('Mahindra', 'BE 6', '["Electric"]'),
('Mahindra', 'XEV 9e', '["Electric"]'),
('Mahindra', 'Marazzo', '["Diesel"]'),
('Mahindra', 'Supro', '["Petrol", "CNG", "Electric"]'),

-- TOYOTA
('Toyota', 'Glanza', '["Petrol"]'),
('Toyota', 'Urban Cruiser Hyryder', '["Petrol", "Hybrid"]'),
('Toyota', 'Urban Cruiser Taisor', '["Petrol", "CNG"]'),
('Toyota', 'Innova Crysta', '["Diesel"]'),
('Toyota', 'Innova HyCross', '["Petrol", "Hybrid"]'),
('Toyota', 'Fortuner', '["Petrol", "Diesel"]'),
('Toyota', 'Hilux', '["Diesel"]'),
('Toyota', 'Camry', '["Petrol", "Hybrid"]'),
('Toyota', 'Vellfire', '["Hybrid"]'),
('Toyota', 'Land Cruiser 300', '["Diesel"]'),
('Toyota', 'Rumion', '["Petrol", "CNG"]'),

-- HONDA
('Honda', 'Amaze', '["Petrol", "Diesel"]'),
('Honda', 'City', '["Petrol", "Hybrid"]'),
('Honda', 'Elevate', '["Petrol"]'),
('Honda', 'WR-V', '["Petrol", "Diesel"]'),
('Honda', 'Jazz', '["Petrol"]'),
('Honda', 'CR-V', '["Petrol", "Diesel"]'),

-- VOLKSWAGEN
('Volkswagen', 'Polo', '["Petrol"]'),
('Volkswagen', 'Vento', '["Petrol"]'),
('Volkswagen', 'Virtus', '["Petrol"]'),
('Volkswagen', 'Taigun', '["Petrol"]'),
('Volkswagen', 'Tiguan', '["Petrol"]'),

-- SKODA
('Skoda', 'Rapid', '["Petrol"]'),
('Skoda', 'Slavia', '["Petrol"]'),
('Skoda', 'Kushaq', '["Petrol"]'),
('Skoda', 'Octavia', '["Petrol"]'),
('Skoda', 'Superb', '["Petrol"]'),
('Skoda', 'Kodiaq', '["Petrol"]'),

-- KIA
('Kia', 'Sonet', '["Petrol", "Diesel"]'),
('Kia', 'Seltos', '["Petrol", "Diesel"]'),
('Kia', 'Carens', '["Petrol", "Diesel"]'),
('Kia', 'EV6', '["Electric"]'),
('Kia', 'EV9', '["Electric"]'),

-- MG
('MG', 'Hector', '["Petrol", "Diesel", "CNG", "Hybrid"]'),
('MG', 'Hector Plus', '["Petrol", "Diesel", "CNG", "Hybrid"]'),
('MG', 'Astor', '["Petrol"]'),
('MG', 'Gloster', '["Diesel"]'),
('MG', 'ZS EV', '["Electric"]'),
('MG', 'Comet EV', '["Electric"]'),
('MG', 'Windsor EV', '["Electric"]'),
('MG', 'Cyberster', '["Electric"]'),

-- RENAULT
('Renault', 'Kwid', '["Petrol"]'),
('Renault', 'Triber', '["Petrol"]'),
('Renault', 'Kiger', '["Petrol"]'),

-- NISSAN
('Nissan', 'Magnite', '["Petrol"]'),
('Nissan', 'X-Trail', '["Petrol", "Hybrid"]'),

-- JEEP
('Jeep', 'Compass', '["Petrol", "Diesel"]'),
('Jeep', 'Meridian', '["Diesel"]'),
('Jeep', 'Wrangler', '["Petrol"]'),
('Jeep', 'Grand Cherokee', '["Diesel"]'),

-- FORD (discontinued but still on roads)
('Ford', 'Figo', '["Petrol", "Diesel"]'),
('Ford', 'Aspire', '["Petrol", "Diesel"]'),
('Ford', 'EcoSport', '["Petrol", "Diesel"]'),
('Ford', 'Endeavour', '["Diesel"]'),

-- CHEVROLET (discontinued)
('Chevrolet', 'Beat', '["Petrol", "Diesel"]'),
('Chevrolet', 'Cruze', '["Diesel"]'),
('Chevrolet', 'Tavera', '["Diesel"]'),
('Chevrolet', 'Captiva', '["Diesel"]'),

-- BMW
('BMW', '3 Series', '["Petrol", "Diesel"]'),
('BMW', '5 Series', '["Petrol", "Diesel"]'),
('BMW', '7 Series', '["Petrol"]'),
('BMW', 'X1', '["Petrol", "Diesel"]'),
('BMW', 'X3', '["Petrol", "Diesel"]'),
('BMW', 'X5', '["Petrol", "Diesel"]'),
('BMW', 'X7', '["Petrol", "Diesel"]'),
('BMW', '2 Series Gran Coupe', '["Petrol"]'),
('BMW', 'iX', '["Electric"]'),
('BMW', 'i4', '["Electric"]'),
('BMW', 'i7', '["Electric"]'),
('BMW', 'XM', '["Hybrid"]'),

-- MERCEDES-BENZ
('Mercedes-Benz', 'A-Class Limousine', '["Petrol"]'),
('Mercedes-Benz', 'C-Class', '["Petrol", "Diesel"]'),
('Mercedes-Benz', 'E-Class', '["Petrol", "Diesel"]'),
('Mercedes-Benz', 'S-Class', '["Petrol"]'),
('Mercedes-Benz', 'GLA', '["Petrol", "Diesel"]'),
('Mercedes-Benz', 'GLB', '["Petrol", "Diesel"]'),
('Mercedes-Benz', 'GLC', '["Diesel"]'),
('Mercedes-Benz', 'GLE', '["Diesel"]'),
('Mercedes-Benz', 'GLS', '["Diesel"]'),
('Mercedes-Benz', 'EQB', '["Electric"]'),
('Mercedes-Benz', 'EQE', '["Electric"]'),
('Mercedes-Benz', 'EQS', '["Electric"]'),
('Mercedes-Benz', 'AMG GT', '["Petrol"]'),
('Mercedes-Benz', 'Maybach S-Class', '["Petrol"]'),

-- AUDI
('Audi', 'A4', '["Petrol"]'),
('Audi', 'A6', '["Petrol"]'),
('Audi', 'A8 L', '["Petrol"]'),
('Audi', 'Q3', '["Petrol"]'),
('Audi', 'Q5', '["Petrol"]'),
('Audi', 'Q7', '["Petrol"]'),
('Audi', 'Q8', '["Petrol"]'),
('Audi', 'e-tron', '["Electric"]'),
('Audi', 'e-tron GT', '["Electric"]'),
('Audi', 'RS5', '["Petrol"]'),
('Audi', 'RS7', '["Petrol"]'),

-- LAND ROVER / RANGE ROVER
('Land Rover', 'Defender', '["Diesel", "Petrol"]'),
('Land Rover', 'Discovery Sport', '["Diesel", "Petrol"]'),
('Land Rover', 'Discovery', '["Diesel"]'),
('Land Rover', 'Range Rover Evoque', '["Diesel", "Petrol"]'),
('Land Rover', 'Range Rover Velar', '["Diesel", "Petrol"]'),
('Land Rover', 'Range Rover Sport', '["Diesel", "Petrol"]'),
('Land Rover', 'Range Rover', '["Diesel", "Petrol"]'),

-- VOLVO
('Volvo', 'XC40', '["Petrol", "Electric"]'),
('Volvo', 'XC60', '["Petrol"]'),
('Volvo', 'XC90', '["Petrol", "Hybrid"]'),
('Volvo', 'S60', '["Petrol"]'),
('Volvo', 'S90', '["Petrol", "Hybrid"]'),
('Volvo', 'EX40', '["Electric"]'),
('Volvo', 'EX90', '["Electric"]'),

-- PORSCHE
('Porsche', 'Cayenne', '["Petrol", "Hybrid"]'),
('Porsche', 'Macan', '["Petrol", "Electric"]'),
('Porsche', 'Panamera', '["Petrol", "Hybrid"]'),
('Porsche', '911', '["Petrol"]'),
('Porsche', 'Taycan', '["Electric"]'),

-- LAMBORGHINI
('Lamborghini', 'Urus', '["Petrol"]'),
('Lamborghini', 'Huracan', '["Petrol"]'),
('Lamborghini', 'Revuelto', '["Hybrid"]'),

-- FERRARI
('Ferrari', 'Roma', '["Petrol"]'),
('Ferrari', 'Purosangue', '["Petrol"]'),
('Ferrari', '296 GTB', '["Hybrid"]'),

-- BENTLEY
('Bentley', 'Bentayga', '["Petrol", "Hybrid"]'),
('Bentley', 'Flying Spur', '["Petrol", "Hybrid"]'),
('Bentley', 'Continental GT', '["Petrol"]'),

-- ROLLS-ROYCE
('Rolls-Royce', 'Ghost', '["Petrol"]'),
('Rolls-Royce', 'Cullinan', '["Petrol"]'),
('Rolls-Royce', 'Phantom', '["Petrol"]'),
('Rolls-Royce', 'Spectre', '["Electric"]'),

-- LEXUS
('Lexus', 'NX', '["Hybrid"]'),
('Lexus', 'RX', '["Hybrid"]'),
('Lexus', 'UX', '["Hybrid"]'),
('Lexus', 'ES', '["Hybrid"]'),
('Lexus', 'LS', '["Hybrid"]'),
('Lexus', 'LX', '["Hybrid"]'),

-- CITROEN
('Citroen', 'C3', '["Petrol"]'),
('Citroen', 'C3 Aircross', '["Petrol"]'),
('Citroen', 'eC3', '["Electric"]'),
('Citroen', 'C5 Aircross', '["Diesel"]');
