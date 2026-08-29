"""
database.py
------------
Small helper module that is NOT one of the four main OOP classes.
It only knows how to:
  1. open a MySQL connection using credentials from environment variables
  2. make sure the required tables exist
  3. seed a small set of realistic sample equipment (once only)

Every other file (user.py, equipment.py, booking.py, owner_manager.py)
imports `get_connection()` from here whenever it needs to talk to MySQL.
"""

import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "equipment_share")


def get_connection():
    """Open and return a new MySQL connection. Raises on failure so the
    caller can turn it into a proper HTTP error instead of crashing."""
    try:
        return mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
        )
    except Error as err:
        raise ConnectionError(f"Could not connect to MySQL: {err}") from err


CREATE_TABLES_SQL = [
    """
    CREATE TABLE IF NOT EXISTS users (
      user_id     INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      phone       VARCHAR(10)  NOT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_phone (phone)
    ) ENGINE=InnoDB
    """,
    """
    CREATE TABLE IF NOT EXISTS equipment (
      equipment_id  INT AUTO_INCREMENT PRIMARY KEY,
      name          VARCHAR(150) NOT NULL,
      category      VARCHAR(50)  NOT NULL,
      rent_price    DECIMAL(10,2) NOT NULL,
      location      VARCHAR(150) NOT NULL,
      `condition`   VARCHAR(50)  NOT NULL,
      availability  ENUM('Available', 'Rented') NOT NULL DEFAULT 'Available',
      image_base64  LONGTEXT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
    """,
    """
    CREATE TABLE IF NOT EXISTS bookings (
      booking_id    INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT NOT NULL,
      equipment_id  INT NOT NULL,
      rental_days   INT NOT NULL,
      total_amount  DECIMAL(10,2) NOT NULL,
      status        ENUM('Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
      booking_date  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
      CONSTRAINT fk_bookings_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE RESTRICT
    ) ENGINE=InnoDB
    """,
]

# Realistic second-hand heavy equipment, matches the categories used by the
# Home screen filter chips (Excavator / Backhoe / Loader).
SAMPLE_EQUIPMENT = [
    ("Volvo EC210 Excavator", "Excavator", 25000.00, "Mumbai, Maharashtra", "Good", "Available"),
    ("CAT 320 Hydraulic Excavator", "Excavator", 14200.00, "Nagpur, Maharashtra", "Fair", "Available"),
    ("Tata Hitachi ZX200 Excavator", "Excavator", 16800.00, "Pune, Maharashtra", "Good", "Rented"),
    ("JCB 3DX Backhoe Loader", "Backhoe", 11500.00, "Nashik, Maharashtra", "Good", "Available"),
    ("Mahindra EarthMaster Backhoe", "Backhoe", 9800.00, "Aurangabad, Maharashtra", "Fair", "Available"),
    ("CAT 950M Wheel Loader", "Loader", 18500.00, "Pune, Maharashtra", "Excellent", "Available"),
    ("John Deere 744L Wheel Loader", "Loader", 18500.00, "Pune, Maharashtra", "Good", "Available"),
    ("Komatsu WA200 Loader", "Loader", 13200.00, "Thane, Maharashtra", "Fair", "Rented"),
]


def _ensure_image_column(cursor):
    """Older databases created before the image-upload feature existed
    won't have this column yet — add it automatically instead of making
    the user drop and recreate their database."""
    cursor.execute(
        """
        SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = %s AND table_name = 'equipment' AND column_name = 'image_base64'
        """,
        (DB_NAME,),
    )
    (exists,) = cursor.fetchone()
    if not exists:
        cursor.execute("ALTER TABLE equipment ADD COLUMN image_base64 LONGTEXT NULL")


def init_db():
    """Create tables if they don't exist yet, then seed sample equipment
    only if the equipment table is currently empty. Safe to call every
    time the backend starts — it will never duplicate rows."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for statement in CREATE_TABLES_SQL:
            cursor.execute(statement)
        conn.commit()

        _ensure_image_column(cursor)
        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM equipment")
        (count,) = cursor.fetchone()

        if count == 0:
            insert_sql = """
                INSERT INTO equipment
                    (name, category, rent_price, location, `condition`, availability)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            for row in SAMPLE_EQUIPMENT:
                cursor.execute(insert_sql, row)
            conn.commit()
            print(f"Seeded {len(SAMPLE_EQUIPMENT)} sample equipment rows.")
        else:
            print("Equipment table already has data — skipping sample seed.")
    finally:
        cursor.close()
        conn.close()
