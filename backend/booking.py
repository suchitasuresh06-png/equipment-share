"""
booking.py
----------
Booking: handles the rental process end to end — validates the booking
details, checks the equipment is actually free for the requested dates,
calculates the rental cost, and saves everything to MySQL.

A machine is booked for a specific date range (rental_start_date to
rental_start_date + rental_days - 1). A new booking is only accepted if
that range doesn't overlap any other Confirmed booking for the same
equipment — this is what lets the same machine be booked again for a
different, later date range ("rent later") instead of going fully
unavailable the moment it's booked once.

Attributes: booking_id, user_id, equipment_id, rental_start_date, rental_days,
            total_amount, status, booking_date
Methods:    validate_booking(), check_availability(), calculate_total(), create_booking()
"""

from datetime import date, datetime, timedelta


class Booking:
    def __init__(
        self,
        user_id=None,
        equipment_id=None,
        rental_start_date=None,
        rental_days=0,
        total_amount=0,
        status="Confirmed",
        booking_id=None,
        booking_date=None,
    ):
        self.booking_id = booking_id
        self.user_id = user_id
        self.equipment_id = equipment_id
        self.rental_start_date = rental_start_date
        self.rental_days = rental_days
        self.total_amount = total_amount
        self.status = status
        self.booking_date = booking_date

    def validate_booking(self):
        """Rental days must be a whole number greater than 0, and the
        start date must be a real date that isn't in the past."""
        try:
            days = int(self.rental_days)
        except (TypeError, ValueError):
            return False, "Rental days must be a valid whole number."
        if days <= 0:
            return False, "Rental days must be greater than 0."
        self.rental_days = days

        parsed_start = self._parse_date(self.rental_start_date)
        if parsed_start is None:
            return False, "Please choose a valid start date."
        if parsed_start < date.today():
            return False, "Start date cannot be in the past."
        self.rental_start_date = parsed_start

        return True, ""

    @staticmethod
    def _parse_date(value):
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except ValueError:
                return None
        return None

    def end_date(self):
        """Last day this booking occupies the equipment for."""
        return self.rental_start_date + timedelta(days=self.rental_days - 1)

    def check_availability(self, cursor):
        """Looks for any other Confirmed booking on this equipment whose
        date range overlaps the requested one. Two ranges overlap when
        one starts on or before the other one ends, in both directions.
        Returns (is_available, message)."""
        requested_end = self.end_date()

        cursor.execute(
            """
            SELECT rental_start_date, rental_days
              FROM bookings
             WHERE equipment_id = %s
               AND status = 'Confirmed'
            """,
            (self.equipment_id,),
        )
        for existing_start, existing_days in cursor.fetchall():
            existing_end = existing_start + timedelta(days=existing_days - 1)
            overlaps = self.rental_start_date <= existing_end and existing_start <= requested_end
            if overlaps:
                return False, (
                    f"This equipment is already booked from {existing_start} to {existing_end}. "
                    "Please choose different dates."
                )

        return True, ""

    def calculate_total(self, rent_price):
        """Total Amount = Price Per Day x Rental Days."""
        self.total_amount = round(float(rent_price) * int(self.rental_days), 2)
        return self.total_amount

    def create_booking(self, cursor):
        """Persists the booking row and returns the new booking_id."""
        cursor.execute(
            """
            INSERT INTO bookings
                (user_id, equipment_id, rental_start_date, rental_days, total_amount, status)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                self.user_id,
                self.equipment_id,
                self.rental_start_date,
                self.rental_days,
                self.total_amount,
                self.status,
            ),
        )
        self.booking_id = cursor.lastrowid
        return self.booking_id

    def to_dict(self):
        return {
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "equipment_id": self.equipment_id,
            "rental_start_date": str(self.rental_start_date) if self.rental_start_date else None,
            "rental_days": self.rental_days,
            "total_amount": float(self.total_amount),
            "status": self.status,
            "booking_date": str(self.booking_date) if self.booking_date else None,
        }
