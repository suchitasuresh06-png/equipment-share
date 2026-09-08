"""
database.py
------------
Small helper module that is NOT one of the four main OOP classes.
It only knows how to:
  1. open a MySQL connection using credentials from environment variables
  2. make sure the required tables exist (and migrate older databases)
  3. clean up any old demo/sample data automatically

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

DEMO_SELLER_PHONE = "9000000000"


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
      user_id        INT AUTO_INCREMENT PRIMARY KEY,
      name           VARCHAR(100) NOT NULL,
      phone          VARCHAR(10)  NOT NULL,
      role           ENUM('buyer', 'seller') NOT NULL DEFAULT 'buyer',
      email          VARCHAR(150) NULL,
      address        VARCHAR(255) NULL,
      business_name  VARCHAR(150) NULL,
      gstin          VARCHAR(15)  NULL,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_users_phone (phone)
    ) ENGINE=InnoDB
    """,
    """
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
      subtotal_amount    DECIMAL(10,2) NOT NULL,
      discount_percent   INT NOT NULL DEFAULT 0,
      delivery_requested BOOLEAN NOT NULL DEFAULT FALSE,
      delivery_address   VARCHAR(255) NULL,
      delivery_fee       DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount       DECIMAL(10,2) NOT NULL,
      status             ENUM('Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Confirmed',
      booking_date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
      CONSTRAINT fk_bookings_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id) ON DELETE RESTRICT
    ) ENGINE=InnoDB
    """,
    """
    CREATE TABLE IF NOT EXISTS messages (
      message_id    INT AUTO_INCREMENT PRIMARY KEY,
      booking_id    INT NOT NULL,
      sender_id     INT NOT NULL,
      message_text  VARCHAR(1000) NOT NULL,
      sent_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_messages_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
      CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE RESTRICT
    ) ENGINE=InnoDB
    """,
]


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


def _ensure_role_column(cursor):
    if not _column_exists(cursor, "users", "role"):
        cursor.execute(
            "ALTER TABLE users ADD COLUMN role ENUM('buyer','seller') NOT NULL DEFAULT 'buyer'"
        )


def _ensure_registration_columns(cursor):
    if not _column_exists(cursor, "users", "email"):
        cursor.execute("ALTER TABLE users ADD COLUMN email VARCHAR(150) NULL")
    if not _column_exists(cursor, "users", "address"):
        cursor.execute("ALTER TABLE users ADD COLUMN address VARCHAR(255) NULL")
    if not _column_exists(cursor, "users", "business_name"):
        cursor.execute("ALTER TABLE users ADD COLUMN business_name VARCHAR(150) NULL")
    if not _column_exists(cursor, "users", "gstin"):
        cursor.execute("ALTER TABLE users ADD COLUMN gstin VARCHAR(15) NULL")


def _ensure_image_column(cursor):
    if not _column_exists(cursor, "equipment", "image_base64"):
        cursor.execute("ALTER TABLE equipment ADD COLUMN image_base64 LONGTEXT NULL")


def _ensure_delivery_column(cursor):
    if not _column_exists(cursor, "equipment", "delivery_available"):
        cursor.execute(
            "ALTER TABLE equipment ADD COLUMN delivery_available BOOLEAN NOT NULL DEFAULT FALSE"
        )


def _ensure_owner_column(cursor):
    """Older databases won't have owner_id on equipment yet. We add it as
    nullable first, backfill every existing row to a one-off demo seller,
    then lock it to NOT NULL."""
    if not _column_exists(cursor, "equipment", "owner_id"):
        cursor.execute("ALTER TABLE equipment ADD COLUMN owner_id INT NULL")

        cursor.execute("SELECT user_id FROM users WHERE phone = %s", (DEMO_SELLER_PHONE,))
        row = cursor.fetchone()
        if row:
            demo_seller_id = row[0]
        else:
            cursor.execute(
                "INSERT INTO users (name, phone, role, email, address) "
                "VALUES ('Demo Seller', %s, 'seller', 'demo@example.com', 'Unknown')",
                (DEMO_SELLER_PHONE,),
            )
            demo_seller_id = cursor.lastrowid

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
    if not _column_exists(cursor, "bookings", "rental_start_date"):
        cursor.execute("ALTER TABLE bookings ADD COLUMN rental_start_date DATE NULL")
        cursor.execute(
            "UPDATE bookings SET rental_start_date = DATE(booking_date) WHERE rental_start_date IS NULL"
        )
        cursor.execute("ALTER TABLE bookings MODIFY rental_start_date DATE NOT NULL")


def _ensure_pricing_columns(cursor):
    """Older bookings won't have the discount/delivery breakdown columns
    yet. Backfill subtotal_amount = total_amount (0% discount, assumed)
    so historical rows stay internally consistent."""
    if not _column_exists(cursor, "bookings", "subtotal_amount"):
        cursor.execute("ALTER TABLE bookings ADD COLUMN subtotal_amount DECIMAL(10,2) NULL")
        cursor.execute(
            "UPDATE bookings SET subtotal_amount = total_amount WHERE subtotal_amount IS NULL"
        )
        cursor.execute("ALTER TABLE bookings MODIFY subtotal_amount DECIMAL(10,2) NOT NULL")
    if not _column_exists(cursor, "bookings", "discount_percent"):
        cursor.execute(
            "ALTER TABLE bookings ADD COLUMN discount_percent INT NOT NULL DEFAULT 0"
        )
    if not _column_exists(cursor, "bookings", "delivery_requested"):
        cursor.execute(
            "ALTER TABLE bookings ADD COLUMN delivery_requested BOOLEAN NOT NULL DEFAULT FALSE"
        )
    if not _column_exists(cursor, "bookings", "delivery_address"):
        cursor.execute("ALTER TABLE bookings ADD COLUMN delivery_address VARCHAR(255) NULL")
    if not _column_exists(cursor, "bookings", "delivery_fee"):
        cursor.execute(
            "ALTER TABLE bookings ADD COLUMN delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0"
        )


def _drop_availability_column(cursor):
    if _column_exists(cursor, "equipment", "availability"):
        cursor.execute("ALTER TABLE equipment DROP COLUMN availability")


def _remove_demo_data(cursor):
    cursor.execute("SELECT user_id FROM users WHERE phone = %s", (DEMO_SELLER_PHONE,))
    row = cursor.fetchone()
    if not row:
        return
    demo_seller_id = row[0]

    cursor.execute(
        """
        DELETE e FROM equipment e
        LEFT JOIN bookings b ON b.equipment_id = e.equipment_id
        WHERE e.owner_id = %s AND b.booking_id IS NULL
        """,
        (demo_seller_id,),
    )

    cursor.execute("SELECT COUNT(*) FROM equipment WHERE owner_id = %s", (demo_seller_id,))
    (remaining,) = cursor.fetchone()
    if remaining == 0:
        cursor.execute("DELETE FROM users WHERE user_id = %s", (demo_seller_id,))


def init_db():
    """Create tables if they don't exist yet, migrate older databases to
    the current schema, and clean up any leftover demo data. Safe to
    call every time the backend starts."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for statement in CREATE_TABLES_SQL:
            cursor.execute(statement)
        conn.commit()

        _ensure_role_column(cursor)
        _ensure_registration_columns(cursor)
        _ensure_image_column(cursor)
        _ensure_delivery_column(cursor)
        _ensure_owner_column(cursor)
        _ensure_rental_start_date_column(cursor)
        _ensure_pricing_columns(cursor)
        _drop_availability_column(cursor)
        conn.commit()

        _remove_demo_data(cursor)
        conn.commit()
    finally:
        cursor.close()
        conn.close()
