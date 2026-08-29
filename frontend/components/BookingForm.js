"use client";

import { useMemo, useState } from "react";
import { createBooking } from "@/lib/api";
import { formatCurrency } from "@/lib/display";
import { addNotification } from "@/lib/notifications";

export default function BookingForm({ equipment, buyer, onClose, onSuccess }) {
  const [days, setDays] = useState("1");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const numericDays = Number(days);
  const total = useMemo(() => {
    if (!numericDays || numericDays <= 0 || Number.isNaN(numericDays)) return 0;
    return equipment.rent_price * numericDays;
  }, [numericDays, equipment.rent_price]);

  function validate() {
    const next = {};
    if (!days || Number.isNaN(numericDays) || !Number.isInteger(numericDays) || numericDays <= 0) {
      next.days = "Rental days must be a whole number greater than 0.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!validate()) return;
    if (equipment.availability !== "Available") {
      setMessage({ type: "error", text: "This equipment is currently rented and not available." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await createBooking({
        name: buyer.name,
        phone: buyer.phone,
        equipment_id: equipment.equipment_id,
        rental_days: numericDays,
      });
      setMessage({ type: "success", text: res.message || "Booking confirmed successfully." });
      addNotification(`You booked "${equipment.name}" successfully.`);
      setTimeout(() => {
        onSuccess?.(res.booking);
      }, 900);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <button className="close-btn" onClick={onClose} aria-label="Close" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <div className="modal-title">Rent this machine</div>
        <div className="modal-subtitle">Booking as {buyer.name} · {buyer.phone}</div>

        <div className="summary-card">
          <div className="summary-row">
            <span className="label">Equipment</span>
            <span>{equipment.name}</span>
          </div>
          <div className="summary-row">
            <span className="label">Price per day</span>
            <span>{formatCurrency(equipment.rent_price)}</span>
          </div>
          <div className="summary-row">
            <span className="label">Rental days</span>
            <span>{numericDays > 0 ? numericDays : "-"}</span>
          </div>
          <div className="summary-row total">
            <span>Total amount</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {message && <div className={`form-message ${message.type}`}>{message.text}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="days">Rental days</label>
            <input
              id="days"
              type="number"
              min="1"
              placeholder="Number of days"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
            {errors.days && <div className="field-error">{errors.days}</div>}
          </div>

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Confirming..." : "Confirm booking"}
          </button>
        </form>
      </div>
    </div>
  );
}
