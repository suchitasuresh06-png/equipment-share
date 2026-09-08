-- Equipment Share — MySQL schema
-- Run this once to create the database and tables, or just let the
-- backend create everything automatically on first run.

CREATE DATABASE IF NOT EXISTS equipment_share
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE equipment_share;

-- ---------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id        INT AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  phone          VARCHAR(10)  NOT NULL,
  role           ENUM('buyer', 'seller') NOT NULL DEFAULT 'buyer',
  email          VARCHAR(150) NOT NULL,
  address        VARCHAR(255) NOT NULL,
  business_name  VARCHAR(150) NULL,
  gstin          VARCHAR(15)  NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- EQUIPMENT
-- delivery_available: whether this seller offers delivery for this
-- particular machine (a flat delivery fee applies at booking time).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment (
  equipment_id       INT AUTO_INCREMENT PRIMARY KEY,
  owner_id           INT NOT NULL,
  name               VARCHAR(150) NOT NULL,
  category           VARCHAR(50)  NOT NULL,
  rent_price         DECIMAL(10,2) NOT NULL,
  location           VARCHAR(150) NOT NULL,
  `condition`        VARCHAR(50)  NOT NULL,
  image_base64       LONGTEXT NULL,
  delivery_available BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_equipment_owner
    FOREIGN KEY (owner_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_rent_price CHECK (rent_price > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- BOOKINGS
-- subtotal_amount / discount_percent are stored (not recalculated
-- later) so a booking's original bill never silently changes if the
-- equipment's price changes afterwards.
-- delivery_* columns capture whether delivery was requested and what
-- it cost at the time — same reasoning.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  booking_id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id            INT NOT NULL,
  equipment_id       INT NOT NULL,
  rental_start_date  DATE NOT NULL,
  rental_days        INT NOT NULL,
  subtotal_amount    DECIMAL(10,2) NOT NULL,
  discount_percent   INT NOT NULL DEFAULT 0,
  delivery_requested BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_address   VARCHAR(255) NULL,
  delivery_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
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

-- ---------------------------------------------------------------
-- MESSAGES
-- A simple message thread scoped to one booking — lets the buyer and
-- the seller who owns that equipment coordinate directly.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  message_id    INT AUTO_INCREMENT PRIMARY KEY,
  booking_id    INT NOT NULL,
  sender_id     INT NOT NULL,
  message_text  VARCHAR(1000) NOT NULL,
  sent_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_booking
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(user_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
