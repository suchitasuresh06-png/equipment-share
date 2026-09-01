"""
database.py
------------
Small helper module that is NOT one of the four main OOP classes.
It only knows how to:
  1. open a MySQL connection using credentials from environment variables
  2. make sure the required tables exist (and migrate older databases)
  3. seed a small set of realistic sample equipment (once only), owned
     by an automatically-created demo seller account

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
      role        ENUM('buyer', 'seller') NOT NULL DEFAULT 'buyer',
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_phone (phone)
    ) ENGINE=InnoDB
    """,
    # owner_id is added further down via migration so this base statement
    # still works for people creating a brand-new database from scratch.
    """
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
      CONSTRAINT fk_equipment_owner FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE RESTRICT
    ) ENGINE=InnoDB
    """,
    """
    CREATE TABLE IF NOT EXISTS bookings (
      booking_id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id            INT NOT NULL,
      equipment_id       INT NOT NULL,
      rental_start_date  DATE NOT NULL,
      rental_days        INT NOT NULL,
      total_amount       DECIMAL(10,2) NOT NULL,
      status             ENUM('Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
      booking_date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
      CONSTRAINT fk_bookings_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE RESTRICT
    ) ENGINE=InnoDB
    """,
]

# Realistic second-hand heavy equipment, matches the categories used by the
# Home screen filter chips (Excavator / Backhoe / Loader). These are all
# owned by the auto-created "Demo Seller" account (see _ensure_demo_seller).
SAMPLE_EQUIPMENT = [
    ("Volvo EC210 Excavator", "Excavator", 25000.00, "Mumbai, Maharashtra", "Good", "Available"),
    ("CAT 320 Hydraulic Excavator", "Excavator", 14200.00, "Nagpur, Maharashtra", "Fair", "Available"),
    ("Tata Hitachi ZX200 Excavator", "Excavator", 16800.00, "Pune, Maharashtra", "Good", "Available"),
    ("JCB 3DX Backhoe Loader", "Backhoe", 11500.00, "Nashik, Maharashtra", "Good", "Available"),
    ("Mahindra EarthMaster Backhoe", "Backhoe", 9800.00, "Aurangabad, Maharashtra", "Fair", "Available"),
    ("CAT 950M Wheel Loader", "Loader", 18500.00, "Pune, Maharashtra", "Excellent", "Available"),
    ("John Deere 744L Wheel Loader", "Loader", 18500.00, "Pune, Maharashtra", "Good", "Available"),
    ("Komatsu WA200 Loader", "Loader", 13200.00, "Thane, Maharashtra", "Fair", "Available"),
]

DEMO_SELLER_PHONE = "9000000000"
DEMO_SELLER_NAME = "Demo Seller"


def _column_exists(cursor, table, column):
    cursor.execute(
        """
        SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = %s AND table_name = %s AND column_name = %s
        """,
        (DB_NAME, table, column),
    )
    (exists,) = cursor.fetchone()
    return bool(exists)


def _ensure_image_column(cursor):
    """Older databases created before the image-upload feature existed
    won't have this column yet — add it automatically."""
    if not _column_exists(cursor, "equipment", "image_base64"):
        cursor.execute("ALTER TABLE equipment ADD COLUMN image_base64 LONGTEXT NULL")


def _ensure_role_column(cursor):
    """Older databases won't have a role on users yet — add it, defaulting
    everyone existing to 'buyer' (safe default, doesn't lock anyone out)."""
    if not _column_exists(cursor, "users", "role"):
        cursor.execute(
            "ALTER TABLE users ADD COLUMN role ENUM('buyer','seller') NOT NULL DEFAULT 'buyer'"
        )


def _ensure_owner_column(cursor):
    """Older databases won't have owner_id on equipment yet. We add it as
    nullable first, backfill every existing row to the demo seller, then
    lock it to NOT NULL — this way nothing breaks on an upgrade."""
    if not _column_exists(cursor, "equipment", "owner_id"):
        cursor.execute("ALTER TABLE equipment ADD COLUMN owner_id INT NULL")
        demo_seller_id = _ensure_demo_seller(cursor)
        cursor.execute(
            "UPDATE equipment SET owner_id = %s WHERE owner_id IS NULL", (demo_seller_id,)
        )
        cursor.execute("ALTER TABLE equipment MODIFY owner_id INT NOT NULL")
        cursor.execute(
            """
            ALTER TABLE equipment
            ADD CONSTRAINT fk_equipment_owner
            FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE RESTRICT
            """
        )


def _ensure_rental_start_date_column(cursor):
    """Older databases won't have rental_start_date on bookings yet.
    Backfill existing rows with their original booking_date so nothing
    breaks, then lock the column to NOT NULL."""
    if not _column_exists(cursor, "bookings", "rental_start_date"):
        cursor.execute("ALTER TABLE bookings ADD COLUMN rental_start_date DATE NULL")
        cursor.execute(
            "UPDATE bookings SET rental_start_date = DATE(booking_date) WHERE rental_start_date IS NULL"
        )
        cursor.execute("ALTER TABLE bookings MODIFY rental_start_date DATE NOT NULL")


def _ensure_demo_seller(cursor):
    """Creates (once) a demo seller account that owns all the auto-seeded
    sample equipment, so the equipment table's owner_id is always valid
    even before any real seller has signed up. Returns its user_id."""
    cursor.execute("SELECT user_id FROM users WHERE phone = %s", (DEMO_SELLER_PHONE,))
    row = cursor.fetchone()
    if row:
        return row[0]

    cursor.execute(
        "INSERT INTO users (name, phone, role) VALUES (%s, %s, 'seller')",
        (DEMO_SELLER_NAME, DEMO_SELLER_PHONE),
    )
    return cursor.lastrowid


def init_db():
    """Create tables if they don't exist yet, migrate older databases to
    the current schema, then seed sample equipment only if the equipment
    table is currently empty. Safe to call every time the backend starts —
    it will never duplicate rows."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for statement in CREATE_TABLES_SQL:
            cursor.execute(statement)
        conn.commit()

        _ensure_role_column(cursor)
        _ensure_image_column(cursor)
        _ensure_owner_column(cursor)
        _ensure_rental_start_date_column(cursor)
        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM equipment")
        (count,) = cursor.fetchone()

        if count == 0:
            demo_seller_id = _ensure_demo_seller(cursor)
            insert_sql = """
                INSERT INTO equipment
                    (owner_id, name, category, rent_price, location, `condition`, availability)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            for row in SAMPLE_EQUIPMENT:
                cursor.execute(insert_sql, (demo_seller_id, *row))
            conn.commit()
            print(f"Seeded {len(SAMPLE_EQUIPMENT)} sample equipment rows under '{DEMO_SELLER_NAME}'.")
        else:
            print("Equipment table already has data — skipping sample seed.")
    finally:
        cursor.close()
        conn.close()
