"""
user.py
-------
User: represents a person using the application — either a Buyer or a
Seller. A phone number is unique across the whole app.

Logging in and registering are now two separate, deliberately different
experiences:
  - login()    → returning users only. Just a phone number — fast.
  - register() → new users only. Collects real details: name, email,
                 address, and (for sellers) business name + GSTIN.

Attributes: user_id, name, phone, role, email, address, business_name, gstin
Methods:    validate_name(), validate_phone(), validate_email(),
            validate_address(), validate_gstin(), login(), register()
"""

import re

VALID_ROLES = ("buyer", "seller")


class User:
    NAME_PATTERN = re.compile(r"^[A-Za-z]+(?: [A-Za-z]+)*$")
    PHONE_PATTERN = re.compile(r"^[0-9]{10}$")
    EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    # Standard 15-character Indian GSTIN format:
    # 2 digits (state code) + 10-char PAN + entity code + 'Z' + checksum
    GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")

    def __init__(
        self,
        name="",
        phone="",
        role="buyer",
        email="",
        address="",
        business_name="",
        gstin="",
        user_id=None,
    ):
        self.user_id = user_id
        self.name = (name or "").strip()
        self.phone = (phone or "").strip()
        self.role = (role or "buyer").strip().lower()
        self.email = (email or "").strip()
        self.address = (address or "").strip()
        self.business_name = (business_name or "").strip()
        self.gstin = (gstin or "").strip().upper()

    # ---------------------------------------------------------------
    # Field-level validation
    # ---------------------------------------------------------------
    def validate_name(self):
        if not self.name:
            return False, "Please enter a valid name using only letters and spaces."
        if not self.NAME_PATTERN.match(self.name):
            return False, "Please enter a valid name using only letters and spaces."
        return True, ""

    def validate_phone(self):
        if not self.phone:
            return False, "Please enter a valid 10-digit phone number."
        if not self.PHONE_PATTERN.match(self.phone):
            return False, "Please enter a valid 10-digit phone number."
        return True, ""

    def validate_email(self):
        if not self.email:
            return False, "Please enter a valid email address."
        if not self.EMAIL_PATTERN.match(self.email):
            return False, "Please enter a valid email address."
        return True, ""

    def validate_address(self):
        if not self.address or len(self.address) < 5:
            return False, "Please enter your full address (at least 5 characters)."
        return True, ""

    def validate_gstin(self):
        """Only required for sellers. A 15-character Indian GSTIN."""
        if not self.gstin:
            return False, "Please enter your business's 15-character GSTIN."
        if not self.GSTIN_PATTERN.match(self.gstin):
            return False, "That doesn't look like a valid 15-character GSTIN."
        return True, ""

    def validate_registration(self):
        """Full validation run before creating a brand-new account.
        Sellers additionally need a business name and a valid GSTIN."""
        for check in (self.validate_name, self.validate_phone, self.validate_email, self.validate_address):
            ok, message = check()
            if not ok:
                return False, message

        if self.role not in VALID_ROLES:
            return False, "Role must be either 'buyer' or 'seller'."

        if self.role == "seller":
            if not self.business_name or len(self.business_name) < 2:
                return False, "Please enter your business name."
            ok, message = self.validate_gstin()
            if not ok:
                return False, message

        return True, ""

    # ---------------------------------------------------------------
    # Lookups
    # ---------------------------------------------------------------
    @staticmethod
    def find_by_phone(cursor, phone):
        """Look up an existing account by phone number. Returns a User
        instance if found, otherwise None."""
        cursor.execute(
            """
            SELECT user_id, name, phone, role, email, address, business_name, gstin
              FROM users WHERE phone = %s
            """,
            (phone,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return User(
            user_id=row[0], name=row[1], phone=row[2], role=row[3],
            email=row[4] or "", address=row[5] or "",
            business_name=row[6] or "", gstin=row[7] or "",
        )

    # ---------------------------------------------------------------
    # LOGIN — returning users only
    # ---------------------------------------------------------------
    def login(self, cursor):
        """A quick, minimal flow for people who already have an account:
        just a phone number. Returns (success, message, user_or_none)."""
        ok, message = self.validate_phone()
        if not ok:
            return False, message, None

        existing = self.find_by_phone(cursor, self.phone)
        if not existing:
            return False, "No account found with this number. Please register instead.", None

        return True, "Logged in successfully.", existing

    # ---------------------------------------------------------------
    # REGISTER — new users only
    # ---------------------------------------------------------------
    def register(self, cursor):
        """A fuller flow for brand-new accounts: real name, email,
        address, and (for sellers) business details. Rejects if this
        phone number is already registered — existing accounts should
        log in instead, never re-register. Returns (success, message, user_or_none)."""
        ok, message = self.validate_registration()
        if not ok:
            return False, message, None

        existing = self.find_by_phone(cursor, self.phone)
        if existing:
            return False, "This phone number is already registered. Please log in instead.", None

        cursor.execute(
            """
            INSERT INTO users (name, phone, role, email, address, business_name, gstin)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                self.name,
                self.phone,
                self.role,
                self.email,
                self.address,
                self.business_name or None,
                self.gstin or None,
            ),
        )
        self.user_id = cursor.lastrowid
        return True, "Account created successfully.", self

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "name": self.name,
            "phone": self.phone,
            "role": self.role,
            "email": self.email,
            "address": self.address,
            "business_name": self.business_name,
            "gstin": self.gstin,
        }
