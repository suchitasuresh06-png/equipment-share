"""
booking.py
----------
Booking: handles the rental process end to end — validates the booking
details, calculates the rental cost, and saves everything to MySQL.

Attributes: booking_id, user_id, equipment_id, rental_days, total_amount, status, booking_date
Methods:    validate_booking(), calculate_total(), create_booking()
"""

class Booking:
    def __init__(
        self,
        user_id=None,
        equipment_id=None,
        rental_days=0,
        total_amount=0,
        status="Confirmed",
        booking_id=None,
        booking_date=None,
    ):
        self.booking_id = booking_id
        self.user_id = user_id
        self.equipment_id = equipment_id
        self.rental_days = rental_days
        self.total_amount = total_amount
        self.status = status
        self.booking_date = booking_date

    def validate_booking(self):
        """Rental days must be a whole number greater than 0."""
        try:
            days = int(self.rental_days)
        except (TypeError, ValueError):
            return False, "Rental days must be a valid whole number."

        if days <= 0:
            return False, "Rental days must be greater than 0."

        self.rental_days = days
        return True, ""

    def calculate_total(self, rent_price):
        """Total Amount = Price Per Day x Rental Days."""
        self.total_amount = round(float(rent_price) * int(self.rental_days), 2)
        return self.total_amount

    def create_booking(self, cursor):
        """Persists the booking row and returns the new booking_id.
        Caller is responsible for updating equipment availability and
        committing the transaction."""
        cursor.execute(
            """
            INSERT INTO bookings (user_id, equipment_id, rental_days, total_amount, status)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (self.user_id, self.equipment_id, self.rental_days, self.total_amount, self.status),
        )
        self.booking_id = cursor.lastrowid
        return self.booking_id

    def to_dict(self):
        return {
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "equipment_id": self.equipment_id,
            "rental_days": self.rental_days,
            "total_amount": float(self.total_amount),
            "status": self.status,
            "booking_date": str(self.booking_date) if self.booking_date else None,
        }
