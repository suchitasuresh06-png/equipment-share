"""
owner_manager.py
----------------
OwnerManager: handles owner-side equipment management. Performs the CRUD
operations for equipment listings and lets the owner view all bookings.

Attributes: equipment_list, selected_equipment_id
Methods:    add_equipment(), edit_equipment(), delete_equipment(),
            update_availability(), view_bookings()
"""

from equipment import Equipment, ALLOWED_AVAILABILITY


class OwnerManager:
    def __init__(self):
        self.equipment_list = []   # populated by view_bookings/list calls when needed
        self.selected_equipment_id = None

    # ---------------------------------------------------------------
    # CREATE
    # ---------------------------------------------------------------
    def add_equipment(self, cursor, equipment: Equipment):
        is_valid, message = equipment.validate_equipment()
        if not is_valid:
            return False, message, None

        cursor.execute(
            """
            INSERT INTO equipment (name, category, rent_price, location, `condition`, availability, image_base64)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                equipment.name,
                equipment.category,
                equipment.rent_price,
                equipment.location,
                equipment.condition,
                equipment.availability,
                equipment.image_base64,
            ),
        )
        equipment.equipment_id = cursor.lastrowid
        return True, "Equipment added successfully.", equipment.get_details()

    # ---------------------------------------------------------------
    # UPDATE (full edit)
    # ---------------------------------------------------------------
    def edit_equipment(self, cursor, equipment_id: int, equipment: Equipment):
        self.selected_equipment_id = equipment_id

        cursor.execute("SELECT equipment_id FROM equipment WHERE equipment_id = %s", (equipment_id,))
        if cursor.fetchone() is None:
            return False, "Equipment not found.", None

        is_valid, message = equipment.validate_equipment()
        if not is_valid:
            return False, message, None

        cursor.execute(
            """
            UPDATE equipment
               SET name = %s, category = %s, rent_price = %s,
                   location = %s, `condition` = %s, availability = %s, image_base64 = %s
             WHERE equipment_id = %s
            """,
            (
                equipment.name,
                equipment.category,
                equipment.rent_price,
                equipment.location,
                equipment.condition,
                equipment.availability,
                equipment.image_base64,
                equipment_id,
            ),
        )
        equipment.equipment_id = equipment_id
        return True, "Equipment updated successfully.", equipment.get_details()

    # ---------------------------------------------------------------
    # UPDATE (availability only — quick toggle from the UI)
    # ---------------------------------------------------------------
    def update_availability(self, cursor, equipment_id: int, availability: str):
        if availability not in ALLOWED_AVAILABILITY:
            return False, "Availability must be either 'Available' or 'Rented'."

        cursor.execute("SELECT equipment_id FROM equipment WHERE equipment_id = %s", (equipment_id,))
        if cursor.fetchone() is None:
            return False, "Equipment not found."

        cursor.execute(
            "UPDATE equipment SET availability = %s WHERE equipment_id = %s",
            (availability, equipment_id),
        )
        return True, "Availability updated successfully."

    # ---------------------------------------------------------------
    # DELETE
    # ---------------------------------------------------------------
    def delete_equipment(self, cursor, equipment_id: int):
        cursor.execute("SELECT equipment_id FROM equipment WHERE equipment_id = %s", (equipment_id,))
        if cursor.fetchone() is None:
            return False, "Equipment not found."

        cursor.execute("SELECT COUNT(*) FROM bookings WHERE equipment_id = %s", (equipment_id,))
        (booking_count,) = cursor.fetchone()
        if booking_count > 0:
            return False, (
                "This equipment can't be deleted because it has "
                f"{booking_count} existing booking(s) on record. "
                "Mark it as 'Rented' or keep it listed instead."
            )

        cursor.execute("DELETE FROM equipment WHERE equipment_id = %s", (equipment_id,))
        return True, "Equipment deleted successfully."

    # ---------------------------------------------------------------
    # READ — bookings, with equipment + customer info joined in for display
    # ---------------------------------------------------------------
    def view_bookings(self, cursor, phone=None):
        query = """
            SELECT b.booking_id, u.name AS customer_name, u.phone AS customer_phone,
                   e.name AS equipment_name, e.equipment_id,
                   b.rental_days, b.total_amount, b.status, b.booking_date
              FROM bookings b
              JOIN users u ON u.user_id = b.user_id
              JOIN equipment e ON e.equipment_id = b.equipment_id
        """
        params = ()
        if phone:
            query += " WHERE u.phone = %s"
            params = (phone,)
        query += " ORDER BY b.booking_date DESC"

        cursor.execute(query, params)
        rows = cursor.fetchall()
        bookings = []
        for row in rows:
            bookings.append(
                {
                    "booking_id": row[0],
                    "customer_name": row[1],
                    "customer_phone": row[2],
                    "equipment_name": row[3],
                    "equipment_id": row[4],
                    "rental_days": row[5],
                    "total_amount": float(row[6]),
                    "status": row[7],
                    "booking_date": str(row[8]),
                }
            )
        self.equipment_list = bookings
        return bookings
