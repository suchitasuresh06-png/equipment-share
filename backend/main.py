"""
main.py
-------
FastAPI entry point for the Equipment Share backend.

Wires the four OOP classes (User, Equipment, Booking, OwnerManager) to
MySQL through simple REST endpoints. Business logic itself lives in the
classes — this file is only responsible for HTTP plumbing: request
parsing, calling the right class method, and shaping the JSON response.
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
    name: str
    phone: str
    role: str  # "buyer" or "seller"


class EquipmentIn(BaseModel):
    owner_id: int
    name: str
    category: str
    rent_price: float
    location: str
    condition: str
    availability: str = "Available"
    image_base64: Optional[str] = None


class AvailabilityIn(BaseModel):
    availability: str
    owner_id: int


class BookingIn(BaseModel):
    name: str
    phone: str
    equipment_id: int
    rental_start_date: str  # "YYYY-MM-DD"
    rental_days: int


# ---------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "Equipment Share API"}


# ---------------------------------------------------------------------
# AUTH — real login/registration by phone number
# ---------------------------------------------------------------------
@app.post("/auth/login")
def login(payload: LoginIn):
    user = User(name=payload.name, phone=payload.phone, role=payload.role.lower())
    ok, message = user.validate()
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message, result_user = user.login(cursor)
        if not ok:
            raise HTTPException(status_code=409, detail=message)
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
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        query = """
            SELECT e.equipment_id, e.owner_id, e.name, e.category, e.rent_price,
                   e.location, e.`condition`, e.availability, e.image_base64,
                   u.name AS owner_name
              FROM equipment e
              JOIN users u ON u.user_id = e.owner_id
        """
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

    # Plain loop + condition based filtering (name / category / location).
    for row in rows:
        item = {
            "equipment_id": row[0],
            "owner_id": row[1],
            "name": row[2],
            "category": row[3],
            "rent_price": float(row[4]),
            "location": row[5],
            "condition": row[6],
            "availability": row[7],
            "image_base64": row[8],
            "owner_name": row[9],
        }

        if category_filter and category_filter != "All" and item["category"] != category_filter:
            continue

        if search_term:
            haystack = f"{item['name']} {item['category']} {item['location']}".lower()
            if search_term not in haystack:
                continue

        results.append(item)

    return results


@app.get("/equipment/{equipment_id}")
def get_equipment(equipment_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT e.equipment_id, e.owner_id, e.name, e.category, e.rent_price,
                   e.location, e.`condition`, e.availability, e.image_base64,
                   u.name AS owner_name
              FROM equipment e
              JOIN users u ON u.user_id = e.owner_id
             WHERE e.equipment_id = %s
            """,
            (equipment_id,),
        )
        row = cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Equipment not found.")

    return {
        "equipment_id": row[0],
        "owner_id": row[1],
        "name": row[2],
        "category": row[3],
        "rent_price": float(row[4]),
        "location": row[5],
        "condition": row[6],
        "availability": row[7],
        "image_base64": row[8],
        "owner_name": row[9],
    }


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


@app.patch("/equipment/{equipment_id}/availability")
def update_equipment_availability(equipment_id: int, payload: AvailabilityIn):
    manager = OwnerManager()

    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message = manager.update_availability(cursor, equipment_id, payload.availability, payload.owner_id)
        if not ok:
            status_code = 404 if message == "Equipment not found." else (
                403 if "only update" in message else 400
            )
            raise HTTPException(status_code=status_code, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": message}


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
    user = User(name=payload.name, phone=payload.phone)
    ok, message = user.validate_name()
    if ok:
        ok, message = user.validate_phone()
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    booking = Booking(
        equipment_id=payload.equipment_id,
        rental_start_date=payload.rental_start_date,
        rental_days=payload.rental_days,
    )
    ok, message = booking.validate_booking()
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT rent_price, availability FROM equipment WHERE equipment_id = %s",
            (payload.equipment_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Equipment not found.")

        rent_price, availability = row
        if availability != "Available":
            raise HTTPException(
                status_code=409,
                detail="This equipment has been paused by its owner and isn't bookable right now.",
            )

        is_free, conflict_message = booking.check_availability(cursor)
        if not is_free:
            raise HTTPException(status_code=409, detail=conflict_message)

        booking.calculate_total(rent_price)

        try:
            user_id = user.register(cursor)
        except ValueError as err:
            raise HTTPException(status_code=409, detail=str(err)) from err

        booking.user_id = user_id
        booking.create_booking(cursor)

        # Note: equipment availability is NOT auto-flipped to 'Rented' here.
        # It stays bookable for any other date range that doesn't overlap
        # this one — the date-overlap check above is what actually blocks
        # conflicting bookings.

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
