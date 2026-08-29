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
class EquipmentIn(BaseModel):
    name: str
    category: str
    rent_price: float
    location: str
    condition: str
    availability: str = "Available"
    image_base64: Optional[str] = None


class AvailabilityIn(BaseModel):
    availability: str


class BookingIn(BaseModel):
    name: str
    phone: str
    equipment_id: int
    rental_days: int


# ---------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------
@app.get("/")
def root():
    return {"status": "ok", "service": "Equipment Share API"}


# ---------------------------------------------------------------------
# EQUIPMENT
# ---------------------------------------------------------------------
@app.get("/equipment")
def list_equipment(
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT equipment_id, name, category, rent_price, location, `condition`, availability, image_base64 "
            "FROM equipment"
        )
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
            "name": row[1],
            "category": row[2],
            "rent_price": float(row[3]),
            "location": row[4],
            "condition": row[5],
            "availability": row[6],
            "image_base64": row[7],
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
            "SELECT equipment_id, name, category, rent_price, location, `condition`, availability, image_base64 "
            "FROM equipment WHERE equipment_id = %s",
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
        "name": row[1],
        "category": row[2],
        "rent_price": float(row[3]),
        "location": row[4],
        "condition": row[5],
        "availability": row[6],
        "image_base64": row[7],
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
    equipment = Equipment(**payload.model_dump())
    manager = OwnerManager()

    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message, details = manager.edit_equipment(cursor, equipment_id, equipment)
        if not ok:
            status_code = 404 if message == "Equipment not found." else 400
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
        ok, message = manager.update_availability(cursor, equipment_id, payload.availability)
        if not ok:
            status_code = 404 if message == "Equipment not found." else 400
            raise HTTPException(status_code=status_code, detail=message)
        conn.commit()
    finally:
        cursor.close()
        conn.close()

    return {"message": message}


@app.delete("/equipment/{equipment_id}")
def delete_equipment(equipment_id: int):
    manager = OwnerManager()

    conn = get_connection()
    cursor = conn.cursor()
    try:
        ok, message = manager.delete_equipment(cursor, equipment_id)
        if not ok:
            status_code = 404 if message == "Equipment not found." else 409
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
    ok, message = user.validate()
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    booking = Booking(equipment_id=payload.equipment_id, rental_days=payload.rental_days)
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
            raise HTTPException(status_code=409, detail="This equipment is currently rented and not available.")

        booking.calculate_total(rent_price)

        user_id = user.register(cursor)
        booking.user_id = user_id
        booking.create_booking(cursor)

        cursor.execute(
            "UPDATE equipment SET availability = 'Rented' WHERE equipment_id = %s",
            (payload.equipment_id,),
        )

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
def list_bookings(phone: Optional[str] = Query(default=None)):
    manager = OwnerManager()
    conn = get_connection()
    cursor = conn.cursor()
    try:
        bookings = manager.view_bookings(cursor, phone=phone)
    finally:
        cursor.close()
        conn.close()

    return bookings
