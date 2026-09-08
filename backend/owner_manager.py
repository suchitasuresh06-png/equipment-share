"""
owner_manager.py
----------------
OwnerManager: handles owner-side equipment management. Every method that
changes or deletes equipment checks that the equipment actually belongs
to the seller making the request — a seller can only manage their own
listings, never another seller's.

Attributes: equipment_list, selected_equipment_id
Methods:    add_equipment(), edit_equipment(), delete_equipment(), view_bookings()
"""

from equipment import Equipment


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
            INSERT INTO equipment (owner_id, name, category, rent_price, location, `condition`, image_base64, delivery_available)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                equipment.owner_id,
                equipment.name,
                equipment.category,
                equipment.rent_price,
                equipment.location,
                equipment.condition,
                equipment.image_base64,
                equipment.delivery_available,
            ),
        )
        equipment.equipment_id = cursor.lastrowid
        return True, "Equipment added successfully.", equipment.get_details()

    def _get_owner_id(self, cursor, equipment_id):
        cursor.execute("SELECT owner_id FROM equipment WHERE equipment_id = %s", (equipment_id,))
        row = cursor.fetchone()
        return row[0] if row else None

    # ---------------------------------------------------------------
    # UPDATE (full edit)
    # ---------------------------------------------------------------
    def edit_equipment(self, cursor, equipment_id: int, equipment: Equipment, requesting_owner_id: int):
        self.selected_equipment_id = equipment_id

        actual_owner_id = self._get_owner_id(cursor, equipment_id)
        if actual_owner_id is None:
            return False, "Equipment not found.", None
        if actual_owner_id != requesting_owner_id:
            return False, "You can only edit equipment you listed yourself.", None

        equipment.owner_id = actual_owner_id
        is_valid, message = equipment.validate_equipment()
        if not is_valid:
            return False, message, None

        cursor.execute(
            """
            UPDATE equipment
               SET name = %s, category = %s, rent_price = %s,
                   location = %s, `condition` = %s, image_base64 = %s, delivery_available = %s
             WHERE equipment_id = %s
            """,
            (
                equipment.name,
                equipment.category,
                equipment.rent_price,
                equipment.location,
                equipment.condition,
                equipment.image_base64,
                equipment.delivery_available,
                equipment_id,
            ),
        )
        equipment.equipment_id = equipment_id
        return True, "Equipment updated successfully.", equipment.get_details()

    # ---------------------------------------------------------------
    # DELETE
    # ---------------------------------------------------------------
    def delete_equipment(self, cursor, equipment_id: int, requesting_owner_id: int):
        actual_owner_id = self._get_owner_id(cursor, equipment_id)
        if actual_owner_id is None:
            return False, "Equipment not found."
        if actual_owner_id != requesting_owner_id:
            return False, "You can only delete equipment you listed yourself."

        cursor.execute("SELECT COUNT(*) FROM bookings WHERE equipment_id = %s", (equipment_id,))
        (booking_count,) = cursor.fetchone()
        if booking_count > 0:
            return False, (
                "This equipment can't be deleted because it has "
                f"{booking_count} existing booking(s) on record. "
                "Keep it listed instead."
            )

        cursor.execute("DELETE FROM equipment WHERE equipment_id = %s", (equipment_id,))
        return True, "Equipment deleted successfully."

    # ---------------------------------------------------------------
    # READ — bookings, with equipment + customer info joined in for display.
    # Pass owner_id to scope this to only bookings for that seller's own
    # equipment; omit it to get every booking.
    # ---------------------------------------------------------------
    def view_bookings(self, cursor, phone=None, owner_id=None):
        query = """
            SELECT b.booking_id, u.name AS customer_name, u.phone AS customer_phone,
                   e.name AS equipment_name, e.equipment_id,
                   b.rental_start_date, b.rental_days,
                   b.subtotal_amount, b.discount_percent,
                   b.delivery_requested, b.delivery_address, b.delivery_fee,
                   b.total_amount, b.status, b.booking_date
              FROM bookings b
              JOIN users u ON u.user_id = b.user_id
              JOIN equipment e ON e.equipment_id = b.equipment_id
        """
        conditions = []
        params = []
        if phone:
            conditions.append("u.phone = %s")
            params.append(phone)
        if owner_id:
            conditions.append("e.owner_id = %s")
            params.append(owner_id)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY b.booking_date DESC"

        cursor.execute(query, tuple(params))
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
                    "rental_start_date": str(row[5]),
                    "rental_days": row[6],
                    "subtotal_amount": float(row[7]),
                    "discount_percent": row[8],
                    "delivery_requested": bool(row[9]),
                    "delivery_address": row[10],
                    "delivery_fee": float(row[11]),
                    "total_amount": float(row[12]),
                    "status": row[13],
                    "booking_date": str(row[14]),
                }
            )
        self.equipment_list = bookings
        return bookings
