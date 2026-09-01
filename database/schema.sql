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
-- role: which side of the marketplace this account belongs to.
-- A phone number is unique across the whole app — logging in again
-- with the same phone returns the SAME account (same role, same data)
-- instead of creating a duplicate.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id     INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(10)  NOT NULL,
  role        ENUM('buyer', 'seller') NOT NULL DEFAULT 'buyer',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- EQUIPMENT
-- owner_id: which seller listed this machine. Every seller only ever
-- sees/manages equipment where owner_id matches their own user_id —
-- this is what makes it a real multi-vendor marketplace instead of one
-- shared pool. Two sellers can list the exact same machine name; they
-- simply become two separate rows (two separate cards).
--
-- `availability` is now a MANUAL seller switch only (e.g. "paused for
-- maintenance"). Whether a specific date range is actually free is
-- calculated from the bookings table, not from this single flag.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment (
  equipment_id  INT AUTO_INCREMENT PRIMARY KEY,
  owner_id      INT NOT NULL,
  name          VARCHAR(150) NOT NULL,
  category      VARCHAR(50)  NOT NULL,
  rent_price    DECIMAL(10,2) NOT NULL,
  location      VARCHAR(150) NOT NULL,
  `condition`   VARCHAR(50)  NOT NULL,
  availability  ENUM('Available', 'Rented') NOT NULL DEFAULT 'Available',
  image_base64  LONGTEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_equipment_owner
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_rent_price CHECK (rent_price > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- BOOKINGS
-- rental_start_date + rental_days together define the exact date
-- range a machine is booked for. A new booking is only accepted if
-- its date range does NOT overlap any other Confirmed booking for
-- the same equipment — this is what allows the same machine to be
-- booked again for a different, later date range ("rent later").
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  booking_id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id            INT NOT NULL,
  equipment_id       INT NOT NULL,
  rental_start_date  DATE NOT NULL,
  rental_days        INT NOT NULL,
  total_amount       DECIMAL(10,2) NOT NULL,
  status             ENUM('Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
  booking_date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_rental_days CHECK (rental_days > 0),
  CONSTRAINT chk_total_amount CHECK (total_amount > 0)
) ENGINE=InnoDB;
