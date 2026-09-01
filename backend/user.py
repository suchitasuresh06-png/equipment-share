"""
user.py
-------
User: represents a person using the application — either a Buyer or a
Seller. A phone number is unique across the whole app: logging in again
with the same phone always returns the SAME account, never a duplicate.

Attributes: user_id, name, phone, role
Methods:    validate_name(), validate_phone(), register(), login()
"""

import re

VALID_ROLES = ("buyer", "seller")


class User:
    NAME_PATTERN = re.compile(r"^[A-Za-z]+(?: [A-Za-z]+)*$")
    PHONE_PATTERN = re.compile(r"^[0-9]{10}$")

    def __init__(self, name="", phone="", role="buyer", user_id=None):
        self.user_id = user_id
        self.name = (name or "").strip()
        self.phone = (phone or "").strip()
        self.role = (role or "buyer").strip().lower()

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
        if self.role not in VALID_ROLES:
            return False, "Role must be either 'buyer' or 'seller'."
        return True, ""

    @staticmethod
    def find_by_phone(cursor, phone):
        """Look up an existing account by phone number. Returns a User
        instance if found, otherwise None."""
        cursor.execute(
            "SELECT user_id, name, phone, role FROM users WHERE phone = %s", (phone,)
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return User(user_id=row[0], name=row[1], phone=row[2], role=row[3])

    def login(self, cursor):
        """Real login/registration flow used at onboarding.

        - If this phone number already has an account, that account is
          returned as-is (same user_id, same stored name, same role) —
          the phone number the person just typed is the login key, not
          a fresh registration.
        - If the requested role doesn't match the account's existing
          role, this is rejected: a phone number can't switch sides of
          the marketplace by re-typing a different role.
        - If the phone number is brand new, a new account is created
          with the given name/role.

        Returns (success, message, user_or_none).
        """
        existing = self.find_by_phone(cursor, self.phone)

        if existing:
            if existing.role != self.role:
                return (
                    False,
                    f"This phone number is already registered as a {existing.role}. "
                    f"Please continue as a {existing.role} instead.",
                    None,
                )
            return True, "Logged in successfully.", existing

        cursor.execute(
            "INSERT INTO users (name, phone, role) VALUES (%s, %s, %s)",
            (self.name, self.phone, self.role),
        )
        self.user_id = cursor.lastrowid
        return True, "Account created successfully.", self

    def register(self, cursor):
        """Used by the booking flow: find-or-create a buyer account by
        phone, updating the stored name to whatever was just typed.
        Rejects if this phone already belongs to a seller account —
        the same phone can't quietly act as both. Returns the user_id."""
        cursor.execute("SELECT user_id, role FROM users WHERE phone = %s", (self.phone,))
        existing = cursor.fetchone()

        if existing:
            existing_id, existing_role = existing
            if existing_role != "buyer":
                raise ValueError(
                    f"This phone number is registered as a {existing_role} and can't be used to book equipment."
                )
            self.user_id = existing_id
            cursor.execute(
                "UPDATE users SET name = %s WHERE user_id = %s",
                (self.name, self.user_id),
            )
            return self.user_id

        cursor.execute(
            "INSERT INTO users (name, phone, role) VALUES (%s, %s, 'buyer')",
            (self.name, self.phone),
        )
        self.user_id = cursor.lastrowid
        return self.user_id

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "name": self.name,
            "phone": self.phone,
            "role": self.role,
        }
