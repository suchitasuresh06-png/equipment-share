-- Equipment Share — MySQL schema
-- Run this once to create the database and tables.
-- Sample equipment is inserted automatically by the backend on first run
-- (backend/database.py checks for existing rows before inserting, so it
-- never duplicates data on restart).

CREATE DATABASE IF NOT EXISTS equipment_share
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE equipment_share;

-- ---------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id     INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(10)  NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- EQUIPMENT
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment (
  equipment_id  INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  category      VARCHAR(50)  NOT NULL,
  rent_price    DECIMAL(10,2) NOT NULL,
  location      VARCHAR(150) NOT NULL,
  `condition`   VARCHAR(50)  NOT NULL,
  availability  ENUM('Available', 'Rented') NOT NULL DEFAULT 'Available',
  image_base64  LONGTEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_rent_price CHECK (rent_price > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- BOOKINGS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  booking_id    INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  equipment_id  INT NOT NULL,
  rental_days   INT NOT NULL,
  total_amount  DECIMAL(10,2) NOT NULL,
  status        ENUM('Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
  booking_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_rental_days CHECK (rental_days > 0),
  CONSTRAINT chk_total_amount CHECK (total_amount > 0)
) ENGINE=InnoDB;
