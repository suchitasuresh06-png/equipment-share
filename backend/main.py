"""
main.py
-------
FastAPI entry point for the Equipment Share backend.

Wires the four OOP classes (User, Equipment, Booking, OwnerManager) to
MySQL through simple REST endpoints. Business logic itself lives in the
classes — this file is only responsible for HTTP plumbing.

Equipment availability and a seller's "Trusted Seller" status are both
computed live from real data (bookings), never stored as a flag that
could go stale.
"""

import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from database import get_connection, init_db
from user import User
from equipment import Equipment
from booking import Booking
from owner_manager import OwnerManager

load_dotenv()

app = FastAPI(title="Equipment Share API", version="1.0.0")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


# ---------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------
class LoginIn(BaseModel):
    phone: str


class RegisterIn(BaseModel):
    name: str
    phone: str
    role: str  # "buyer" or "seller"
    email: str
    address: str
    business_name: Optional[str] = ""
    gstin: Optional[str] = ""


class EquipmentIn(BaseModel):
    owner_id: int
    name: str
    category: str
    rent_price: float
    location: str
    condition: str
    image_base64: Optional[str] = None
    delivery_available: bool = False


class BookingIn(BaseModel):
    user_id: int
    equipment_id: int
    rental_start_date: str  # "YYYY-MM-DD"
    rental_days: int
    delivery_requested: bool = False
    delivery_address: Optional[str] = None


class CancelBookingIn(BaseModel):
    user_id: int


class ExtendBookingIn(BaseModel):
    user_id: int
    additional_days: int


class MessageIn(BaseModel):
    sender_id: int
    message: str


# Availability is computed live from real bookings, never stored.
AVAILABILITY_SUBQUERY = """
    CASE WHEN EXISTS (
        SELECT 1 FROM bookings b
         WHERE b.equipment_id = e.equipment_id
           AND b.status = 'Confirmed'
           AND DATE_ADD(b.rental_start_date, INTERVAL b.rental_days - 1 DAY) >= CURDATE()
    ) THEN 'Available Later' ELSE 'Available' END AS availability
"""

# A seller is shown as "Trusted" once they have at least 5 bookings
# across their listings with a cancellation rate of 20% or lower.
# Computed live so it always reflects real, current behaviour.
TRUSTED_SELLER_SUBQUERY = """
    (
        SELECT CASE
            WHEN COUNT(*) >= 5
                 AND (SUM(CASE WHEN b2.status = 'Cancelled' THEN 1 ELSE 0 END) / COUNT(*)) <= 0.2
            THEN 1 ELSE 0
        END
        FROM bookings b2
        JOIN equipment e2 ON e2.equipment_id = b2.equipment_id
        WHERE e2.owner_id = e.owner_id
    ) AS owner_trusted
"""


def _equipment_row_to_dict(row):
    return {
        "equipment_id": row[0],
        "owner_id": row[1],
        "name": row[2],
        "category": row[3],
        "rent_price": float(row[4]),
        "location": row[5],
        "condition": row[6],
        "image_base64": row[7],
        "delivery_available": bool(row[8]),
        "owner_name": row[9],
        "owner_gst_verified": bool(row[10]),
        "owner_trusted": bool(row[11]),
        "availability": row[12],
    }


EQUIPMENT_SELECT = f"""
    SELECT e.equipment_id, e.owner_id, e.name, e.category, e.rent_price,
           e.location, e.`condition`, e.image_base64, e.delivery_available,
           u.name AS owner_name,
           (u.gstin IS NOT NULL AND u.gstin != '') AS owner_gst_verified,
           {TRUSTED_SELLER_SUBQUERY},
           {AVAILABILITY_SUBQUERY}
      FROM equipment e
      JOIN users u ON u.user_id = e.owner_id
"""


# ---------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "Equipment Share API"}


# ---------------------------------------------------------------------
# AUTH
# ---------------------------------------------------------------------
@app.post("/auth/login")
def login(payload: LoginIn):
    user = User(phone=payload.phone)
    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message, result_user = user.login(cursor)
        if not ok:
            raise HTTPException(status_code=404, detail=message)
    finally:
        cursor.close()
        conn.close()

    return {"message": message, "user": result_user.to_dict()}


@app.post("/auth/register")
def register(payload: RegisterIn):
    user = User(
        name=payload.name,
        phone=payload.phone,
        role=payload.role.lower(),
        email=payload.email,
        address=payload.address,
        business_name=payload.business_name,
        gstin=payload.gstin,
    )
    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message, result_user = user.register(cursor)
        if not ok:
            status_code = 409 if "already registered" in message else 400
            raise HTTPException(status_code=status_code, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": message, "user": result_user.to_dict()}


# ---------------------------------------------------------------------
# EQUIPMENT
# ---------------------------------------------------------------------
@app.get("/equipment")
def list_equipment(
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    owner_id: Optional[int] = Query(default=None),
    min_price: Optional[float] = Query(default=None),
    max_price: Optional[float] = Query(default=None),
    location: Optional[str] = Query(default=None),
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        query = EQUIPMENT_SELECT
        params = ()
        if owner_id:
            query += " WHERE e.owner_id = %s"
            params = (owner_id,)
        cursor.execute(query, params)
        rows = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    results = []
    search_term = (search or "").strip().lower()
    category_filter = (category or "All").strip()
    location_term = (location or "").strip().lower()

    for row in rows:
        item = _equipment_row_to_dict(row)

        if category_filter and category_filter != "All" and item["category"] != category_filter:
            continue
        if search_term:
            haystack = f"{item['name']} {item['category']} {item['location']}".lower()
            if search_term not in haystack:
                continue
        if location_term and location_term not in item["location"].lower():
            continue
        if min_price is not None and item["rent_price"] < min_price:
            continue
        if max_price is not None and item["rent_price"] > max_price:
            continue

        results.append(item)

    return results


@app.get("/equipment/{equipment_id}")
def get_equipment(equipment_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(EQUIPMENT_SELECT + " WHERE e.equipment_id = %s", (equipment_id,))
        row = cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Equipment not found.")

    return _equipment_row_to_dict(row)


@app.get("/equipment/{equipment_id}/booked-dates")
def get_booked_dates(equipment_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        ranges = Booking.get_booked_date_ranges(cursor, equipment_id)
    finally:
        cursor.close()
        conn.close()

    return ranges


@app.post("/equipment", status_code=201)
def create_equipment(payload: EquipmentIn):
    equipment = Equipment(**payload.model_dump())
    manager = OwnerManager()

    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message, details = manager.add_equipment(cursor, equipment)
        if not ok:
            raise HTTPException(status_code=400, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": message, "equipment": details}


@app.put("/equipment/{equipment_id}")
def update_equipment(equipment_id: int, payload: EquipmentIn):
    equipment = Equipment(**{k: v for k, v in payload.model_dump().items() if k != "owner_id"})
    manager = OwnerManager()

    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message, details = manager.edit_equipment(cursor, equipment_id, equipment, payload.owner_id)
        if not ok:
            status_code = 404 if message == "Equipment not found." else (
                403 if "only edit" in message else 400
            )
            raise HTTPException(status_code=status_code, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": message, "equipment": details}


@app.delete("/equipment/{equipment_id}")
def delete_equipment(equipment_id: int, owner_id: int = Query(...)):
    manager = OwnerManager()

    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message = manager.delete_equipment(cursor, equipment_id, owner_id)
        if not ok:
            status_code = 404 if message == "Equipment not found." else (
                403 if "only delete" in message else 409
            )
            raise HTTPException(status_code=status_code, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": message}


# ---------------------------------------------------------------------
# BOOKINGS
# ---------------------------------------------------------------------
@app.post("/bookings", status_code=201)
def create_booking(payload: BookingIn):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT role FROM users WHERE user_id = %s", (payload.user_id,))
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="User not found. Please log in again.")
        if row[0] != "buyer":
            raise HTTPException(status_code=403, detail="Only buyer accounts can book equipment.")

        cursor.execute(
            "SELECT rent_price, delivery_available FROM equipment WHERE equipment_id = %s",
            (payload.equipment_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Equipment not found.")
        rent_price, delivery_available = row

        if payload.delivery_requested and not delivery_available:
            raise HTTPException(status_code=400, detail="This seller doesn't offer delivery for this equipment.")

        booking = Booking(
            user_id=payload.user_id,
            equipment_id=payload.equipment_id,
            rental_start_date=payload.rental_start_date,
            rental_days=payload.rental_days,
            delivery_requested=payload.delivery_requested,
            delivery_address=payload.delivery_address,
        )
        ok, message = booking.validate_booking()
        if not ok:
            raise HTTPException(status_code=400, detail=message)

        is_free, conflict_message = booking.check_availability(cursor)
        if not is_free:
            raise HTTPException(status_code=409, detail=conflict_message)

        booking.calculate_total(rent_price)
        booking.create_booking(cursor)
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Booking could not be saved: {err}") from err
    finally:
        cursor.close()
        conn.close()

    return {
        "message": "Booking confirmed successfully.",
        "booking": booking.to_dict(),
    }


@app.post("/bookings/{booking_id}/extend")
def extend_booking(booking_id: int, payload: ExtendBookingIn):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message = Booking.extend_booking(cursor, booking_id, payload.user_id, payload.additional_days)
        if not ok:
            status_code = 404 if message == "Booking not found." else (
                403 if "only extend" in message else 409
            )
            raise HTTPException(status_code=status_code, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": message}


@app.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: int, payload: CancelBookingIn):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message = Booking.cancel_booking(cursor, booking_id, payload.user_id)
        if not ok:
            status_code = 404 if message == "Booking not found." else (
                403 if "only cancel" in message else 400
            )
            raise HTTPException(status_code=status_code, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": message}


@app.get("/bookings")
def list_bookings(
    phone: Optional[str] = Query(default=None),
    owner_id: Optional[int] = Query(default=None),
):
    manager = OwnerManager()
    conn = get_connection()
    cursor = conn.cursor()
    try:
        bookings = manager.view_bookings(cursor, phone=phone, owner_id=owner_id)
    finally:
        cursor.close()
        conn.close()

    return bookings


# ---------------------------------------------------------------------
# MESSAGES — a simple thread scoped to one booking
# ---------------------------------------------------------------------
@app.post("/bookings/{booking_id}/messages", status_code=201)
def send_message(booking_id: int, payload: MessageIn):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message, result = Booking.send_message(cursor, booking_id, payload.sender_id, payload.message)
        if not ok:
            status_code = 404 if message == "Booking not found." else (
                403 if "only message" in message else 400
            )
            raise HTTPException(status_code=status_code, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return result


@app.get("/bookings/{booking_id}/messages")
def get_messages(booking_id: int, user_id: int = Query(...)):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message, result = Booking.get_messages(cursor, booking_id, user_id)
        if not ok:
            status_code = 404 if message == "Booking not found." else 403
            raise HTTPException(status_code=status_code, detail=message)
    finally:
        cursor.close()
        conn.close()

    return result
