"""
equipment.py
------------
Equipment: represents a single second-hand equipment listing, owned by
exactly one seller (owner_id). Two different sellers can list a machine
with the exact same name — they are simply two separate Equipment rows
(two separate cards), never merged into one.

Attributes: equipment_id, owner_id, name, category, rent_price, location, condition, availability
Methods:    validate_equipment(), get_details()
"""

ALLOWED_AVAILABILITY = ("Available", "Rented")
NAME_MIN_LEN = 3


class Equipment:
    def __init__(
        self,
        name="",
        category="",
        rent_price=0,
        location="",
        condition="",
        availability="Available",
        equipment_id=None,
        owner_id=None,
        image_base64=None,
    ):
        self.equipment_id = equipment_id
        self.owner_id = owner_id
        self.name = (name or "").strip()
        self.category = (category or "").strip()
        self.rent_price = rent_price
        self.location = (location or "").strip()
        self.condition = (condition or "").strip()
        self.availability = (availability or "Available").strip()
        self.image_base64 = image_base64 or None

    def validate_equipment(self):
        """Runs every rule needed before this listing may be saved to MySQL.
        Returns (is_valid, error_message)."""
        if len(self.name) < NAME_MIN_LEN:
            return False, "Equipment name must be at least 3 characters long."

        if not self.category:
            return False, "Please select a category for this equipment."

        try:
            price = float(self.rent_price)
        except (TypeError, ValueError):
            return False, "Rent price must be a valid number."
        if price <= 0:
            return False, "Rent price must be greater than 0."
        self.rent_price = price

        if not self.location:
            return False, "Location cannot be empty."

        if not self.condition:
            return False, "Please specify the equipment's condition."

        if self.availability not in ALLOWED_AVAILABILITY:
            return False, "Availability must be either 'Available' or 'Rented'."

        if self.image_base64 and len(self.image_base64) > 6_000_000:
            return False, "Image is too large. Please use a smaller image (under ~4MB)."

        if not self.owner_id:
            return False, "Equipment must belong to a valid seller account."

        return True, ""

    def get_details(self):
        """Returns a plain dict representation, used for API responses."""
        return {
            "equipment_id": self.equipment_id,
            "owner_id": self.owner_id,
            "name": self.name,
            "category": self.category,
            "rent_price": float(self.rent_price),
            "location": self.location,
            "condition": self.condition,
            "availability": self.availability,
            "image_base64": self.image_base64,
        }
