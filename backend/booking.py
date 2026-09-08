"""
booking.py
----------
Booking: handles the rental process end to end — validates the booking
details, checks the equipment is actually free for the requested dates,
applies any long-rental discount, adds a delivery fee if requested,
calculates the final cost, and saves everything to MySQL.

A machine is booked for a specific date range (rental_start_date to
rental_start_date + rental_days - 1). A new booking is only accepted if
that range doesn't overlap any other Confirmed booking for the same
equipment — this is what lets the same machine be booked again for a
different, later date range, and also lets an existing booking be
*extended* as long as the extra days don't collide with someone else's
booking.

This class also owns the simple message thread attached to a booking,
so a buyer and the seller who owns that equipment can coordinate
directly (pickup time, delivery details, etc).

Attributes: booking_id, user_id, equipment_id, rental_start_date, rental_days,
            subtotal_amount, discount_percent, delivery_requested,
            delivery_address, delivery_fee, total_amount, status, booking_date
Methods:    validate_booking(), check_availability(), calculate_total(),
            create_booking(), extend_booking(), cancel_booking(),
            send_message(), get_messages()
"""

from datetime import date, datetime, timedelta

# Long-rental discount tiers: (minimum days, discount percent).
# Checked longest-first so a 30-day booking gets 20%, not 10%.
DISCOUNT_TIERS = [
    (30, 20),
    (7, 10),
]

FLAT_DELIVERY_FEE = 500.00


def get_discount_percent(rental_days):
    """Looks up the discount percent for a given rental length using a
    simple loop over the tier list — longer rentals get bigger
    discounts, e.g. 7+ days = 10% off, 30+ days = 20% off."""
    for min_days, percent in DISCOUNT_TIERS:
        if rental_days >= min_days:
            return percent
    return 0


class Booking:
    def __init__(
        self,
        user_id=None,
        equipment_id=None,
        rental_start_date=None,
        rental_days=0,
        subtotal_amount=0,
        discount_percent=0,
        delivery_requested=False,
        delivery_address=None,
        delivery_fee=0,
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
        self.subtotal_amount = subtotal_amount
        self.discount_percent = discount_percent
        self.delivery_requested = bool(delivery_requested)
        self.delivery_address = delivery_address
        self.delivery_fee = delivery_fee
        self.total_amount = total_amount
        self.status = status
        self.booking_date = booking_date

    def validate_booking(self):
        """Rental days must be a whole number greater than 0, the start
        date must be a real date that isn't in the past, and a delivery
        address is required if delivery was requested."""
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

        if self.delivery_requested and not (self.delivery_address or "").strip():
            return False, "Please enter a delivery address."

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

    def check_availability(self, cursor, exclude_booking_id=None):
        """Looks for any other Confirmed booking on this equipment whose
        date range overlaps the requested one. Pass exclude_booking_id
        when extending an existing booking, so it doesn't collide with
        itself. Returns (is_available, message)."""
        requested_end = self.end_date()

        query = """
            SELECT booking_id, rental_start_date, rental_days
              FROM bookings
             WHERE equipment_id = %s
               AND status = 'Confirmed'
        """
        params = [self.equipment_id]
        if exclude_booking_id:
            query += " AND booking_id != %s"
            params.append(exclude_booking_id)

        cursor.execute(query, tuple(params))
        for _, existing_start, existing_days in cursor.fetchall():
            existing_end = existing_start + timedelta(days=existing_days - 1)
            overlaps = self.rental_start_date <= existing_end and existing_start <= requested_end
            if overlaps:
                return False, (
                    f"This equipment is already booked from {existing_start} to {existing_end}. "
                    "Please choose different dates."
                )

        return True, ""

    def calculate_total(self, rent_price):
        """Subtotal = Price Per Day x Rental Days. A long-rental discount
        is applied automatically based on rental_days, then a flat
        delivery fee is added on top if delivery was requested."""
        self.subtotal_amount = round(float(rent_price) * int(self.rental_days), 2)
        self.discount_percent = get_discount_percent(self.rental_days)
        discount_amount = round(self.subtotal_amount * self.discount_percent / 100, 2)
        self.delivery_fee = FLAT_DELIVERY_FEE if self.delivery_requested else 0.0
        self.total_amount = round(self.subtotal_amount - discount_amount + self.delivery_fee, 2)
        return self.total_amount

    def create_booking(self, cursor):
        """Persists the booking row and returns the new booking_id."""
        cursor.execute(
            """
            INSERT INTO bookings
                (user_id, equipment_id, rental_start_date, rental_days,
                 subtotal_amount, discount_percent, delivery_requested,
                 delivery_address, delivery_fee, total_amount, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                self.user_id,
                self.equipment_id,
                self.rental_start_date,
                self.rental_days,
                self.subtotal_amount,
                self.discount_percent,
                self.delivery_requested,
                self.delivery_address,
                self.delivery_fee,
                self.total_amount,
                self.status,
            ),
        )
        self.booking_id = cursor.lastrowid
        return self.booking_id

    @staticmethod
    def get_booked_date_ranges(cursor, equipment_id):
        """Returns every Confirmed booking's date range for this
        equipment, as a list of {start_date, end_date} dicts. Used to
        draw the availability calendar so a buyer can see, before
        picking anything, exactly which dates are already taken."""
        cursor.execute(
            """
            SELECT rental_start_date, rental_days
              FROM bookings
             WHERE equipment_id = %s
               AND status = 'Confirmed'
            """,
            (equipment_id,),
        )
        ranges = []
        for start, days in cursor.fetchall():
            end = start + timedelta(days=days - 1)
            ranges.append({"start_date": str(start), "end_date": str(end)})
        return ranges

    @staticmethod
    def extend_booking(cursor, booking_id, requesting_user_id, additional_days):
        """Lets the buyer who made a booking extend it by more days,
        as long as the new, longer date range doesn't collide with any
        other Confirmed booking on the same equipment. The discount
        tier and total are recalculated for the new total length —
        extending into a longer tier can unlock a bigger discount.
        Returns (success, message)."""
        try:
            additional_days = int(additional_days)
        except (TypeError, ValueError):
            return False, "Additional days must be a whole number."
        if additional_days <= 0:
            return False, "Additional days must be greater than 0."

        cursor.execute(
            """
            SELECT user_id, equipment_id, rental_start_date, rental_days, status
              FROM bookings WHERE booking_id = %s
            """,
            (booking_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return False, "Booking not found."

        buyer_id, equipment_id, start_date, current_days, status = row
        if requesting_user_id != buyer_id:
            return False, "You can only extend your own bookings."
        if status != "Confirmed":
            return False, "Only confirmed bookings can be extended."

        new_days = current_days + additional_days

        booking = Booking(
            booking_id=booking_id,
            equipment_id=equipment_id,
            rental_start_date=start_date,
            rental_days=new_days,
        )
        is_free, conflict_message = booking.check_availability(cursor, exclude_booking_id=booking_id)
        if not is_free:
            return False, conflict_message

        cursor.execute("SELECT rent_price FROM equipment WHERE equipment_id = %s", (equipment_id,))
        (rent_price,) = cursor.fetchone()
        booking.calculate_total(rent_price)

        cursor.execute(
            """
            UPDATE bookings
               SET rental_days = %s, subtotal_amount = %s, discount_percent = %s, total_amount = %s
             WHERE booking_id = %s
            """,
            (new_days, booking.subtotal_amount, booking.discount_percent, booking.total_amount, booking_id),
        )
        return True, f"Booking extended by {additional_days} day(s)."

    @staticmethod
    def cancel_booking(cursor, booking_id, requesting_user_id):
        """Cancels a booking. Allowed for either the buyer who made it,
        or the seller who owns the equipment it's for — nobody else.
        A Cancelled booking's dates are immediately free again, since
        check_availability() only ever counts 'Confirmed' bookings.
        Returns (success, message)."""
        cursor.execute(
            """
            SELECT b.user_id, e.owner_id, b.status
              FROM bookings b
              JOIN equipment e ON e.equipment_id = b.equipment_id
             WHERE b.booking_id = %s
            """,
            (booking_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return False, "Booking not found."

        buyer_id, owner_id, status = row
        if requesting_user_id not in (buyer_id, owner_id):
            return False, "You can only cancel your own bookings."
        if status == "Cancelled":
            return False, "This booking is already cancelled."

        cursor.execute(
            "UPDATE bookings SET status = 'Cancelled' WHERE booking_id = %s",
            (booking_id,),
        )
        return True, "Booking cancelled successfully."

    # ---------------------------------------------------------------
    # Messaging — a simple thread scoped to this booking, between the
    # buyer and the seller who owns the equipment.
    # ---------------------------------------------------------------
    @staticmethod
    def _get_participants(cursor, booking_id):
        cursor.execute(
            """
            SELECT b.user_id, e.owner_id
              FROM bookings b
              JOIN equipment e ON e.equipment_id = b.equipment_id
             WHERE b.booking_id = %s
            """,
            (booking_id,),
        )
        return cursor.fetchone()

    @staticmethod
    def send_message(cursor, booking_id, sender_id, message_text):
        """Adds a message to a booking's thread. Only the buyer who made
        the booking or the seller who owns the equipment may post.
        Returns (success, message, message_dict_or_none)."""
        message_text = (message_text or "").strip()
        if not message_text:
            return False, "Message cannot be empty.", None
        if len(message_text) > 1000:
            return False, "Message is too long (max 1000 characters).", None

        participants = Booking._get_participants(cursor, booking_id)
        if participants is None:
            return False, "Booking not found.", None
        buyer_id, owner_id = participants
        if sender_id not in (buyer_id, owner_id):
            return False, "You can only message on your own bookings.", None

        cursor.execute(
            "INSERT INTO messages (booking_id, sender_id, message_text) VALUES (%s, %s, %s)",
            (booking_id, sender_id, message_text),
        )
        return True, "Message sent.", {
            "message_id": cursor.lastrowid,
            "booking_id": booking_id,
            "sender_id": sender_id,
            "message_text": message_text,
        }

    @staticmethod
    def get_messages(cursor, booking_id, requesting_user_id):
        """Returns the full message thread for a booking, oldest first.
        Only the buyer or the equipment's owner may read it.
        Returns (success, message, list_or_none)."""
        participants = Booking._get_participants(cursor, booking_id)
        if participants is None:
            return False, "Booking not found.", None
        buyer_id, owner_id = participants
        if requesting_user_id not in (buyer_id, owner_id):
            return False, "You can only view messages on your own bookings.", None

        cursor.execute(
            """
            SELECT m.message_id, m.sender_id, u.name AS sender_name, m.message_text, m.sent_at
              FROM messages m
              JOIN users u ON u.user_id = m.sender_id
             WHERE m.booking_id = %s
             ORDER BY m.sent_at ASC, m.message_id ASC
            """,
            (booking_id,),
        )
        messages = [
            {
                "message_id": row[0],
                "sender_id": row[1],
                "sender_name": row[2],
                "message_text": row[3],
                "sent_at": str(row[4]),
            }
            for row in cursor.fetchall()
        ]
        return True, "", messages

    def to_dict(self):
        return {
            "booking_id": self.booking_id,
            "user_id": self.user_id,
            "equipment_id": self.equipment_id,
            "rental_start_date": str(self.rental_start_date) if self.rental_start_date else None,
            "rental_days": self.rental_days,
            "subtotal_amount": float(self.subtotal_amount),
            "discount_percent": self.discount_percent,
            "delivery_requested": self.delivery_requested,
            "delivery_address": self.delivery_address,
            "delivery_fee": float(self.delivery_fee),
            "total_amount": float(self.total_amount),
            "status": self.status,
            "booking_date": str(self.booking_date) if self.booking_date else None,
        }
