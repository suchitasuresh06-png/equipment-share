"""
user.py
-------
User: represents the customer renting equipment.

Attributes: user_id, name, phone
Methods:    validate_name(), validate_phone(), register()
"""

import re


class User:
    NAME_PATTERN = re.compile(r"^[A-Za-z]+(?: [A-Za-z]+)*$")
    PHONE_PATTERN = re.compile(r"^[0-9]{10}$")

    def __init__(self, name="", phone="", user_id=None):
        self.user_id = user_id
        self.name = (name or "").strip()
        self.phone = (phone or "").strip()

    def validate_name(self):
        """Only letters and single spaces between words are allowed."""
        if not self.name:
            return False, "Please enter a valid name using only letters and spaces."
        if not self.NAME_PATTERN.match(self.name):
            return False, "Please enter a valid name using only letters and spaces."
        return True, ""

    def validate_phone(self):
        """Exactly 10 digits, numbers only."""
        if not self.phone:
            return False, "Please enter a valid 10-digit phone number."
        if not self.PHONE_PATTERN.match(self.phone):
            return False, "Please enter a valid 10-digit phone number."
        return True, ""

    def validate(self):
        ok, message = self.validate_name()
        if not ok:
            return False, message
        ok, message = self.validate_phone()
        if not ok:
            return False, message
        return True, ""

    def register(self, cursor):
        """Save the user to MySQL. If a user with this phone number already
        exists, reuse that record instead of creating a duplicate — this
        also keeps the booking's foreign key valid. Returns the user_id."""
        cursor.execute("SELECT user_id FROM users WHERE phone = %s", (self.phone,))
        existing = cursor.fetchone()

        if existing:
            self.user_id = existing[0]
            # Keep the stored name in sync with the latest booking form entry.
            cursor.execute(
                "UPDATE users SET name = %s WHERE user_id = %s",
                (self.name, self.user_id),
            )
            return self.user_id

        cursor.execute(
            "INSERT INTO users (name, phone) VALUES (%s, %s)",
            (self.name, self.phone),
        )
        self.user_id = cursor.lastrowid
        return self.user_id

    def to_dict(self):
        return {"user_id": self.user_id, "name": self.name, "phone": self.phone}
