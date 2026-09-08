"use client";

import { useMemo, useState } from "react";
import { createBooking } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/display";
import { addNotification } from "@/lib/notifications";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";

// Mirrors backend/booking.py's DISCOUNT_TIERS exactly, so the buyer sees
// an accurate live preview before submitting — the backend recalculates
// the authoritative figures anyway, this is just for instant feedback.
const DISCOUNT_TIERS = [
  { minDays: 30, percent: 20 },
  { minDays: 7, percent: 10 },
];
const FLAT_DELIVERY_FEE = 500;

function getDiscountPercent(days) {
  for (const tier of DISCOUNT_TIERS) {
    if (days >= tier.minDays) return tier.percent;
  }
  return 0;
}

function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

export default function BookingForm({ equipment, buyer, onClose, onSuccess }) {
  const [startDate, setStartDate] = useState(null);
  const [days, setDays] = useState("1");
  const [wantsDelivery, setWantsDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(buyer.address || "");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const numericDays = Number(days);
  const isValidDays = numericDays > 0 && !Number.isNaN(numericDays);

  const pricing = useMemo(() => {
    if (!isValidDays) return null;
    const subtotal = equipment.rent_price * numericDays;
    const discountPercent = getDiscountPercent(numericDays);
    const discountAmount = (subtotal * discountPercent) / 100;
    const deliveryFee = wantsDelivery ? FLAT_DELIVERY_FEE : 0;
    const total = subtotal - discountAmount + deliveryFee;
    return { subtotal, discountPercent, discountAmount, deliveryFee, total };
  }, [equipment.rent_price, numericDays, isValidDays, wantsDelivery]);

  const endDateLabel = useMemo(() => {
    if (!startDate || !isValidDays) return null;
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + numericDays - 1);
    return formatDate(end);
  }, [startDate, numericDays, isValidDays]);

  function validate() {
    const next = {};
    if (!startDate) {
      next.startDate = "Please tap a date on the calendar below to choose a start date.";
    } else if (startDate < todayISO()) {
      next.startDate = "Start date cannot be in the past.";
    }
    if (!isValidDays || !Number.isInteger(numericDays)) {
      next.days = "Rental days must be a whole number greater than 0.";
    }
    if (wantsDelivery && !deliveryAddress.trim()) {
      next.deliveryAddress = "Please enter a delivery address.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await createBooking({
        userId: buyer.user_id,
        equipmentId: equipment.equipment_id,
        rentalStartDate: startDate,
        rentalDays: numericDays,
        deliveryRequested: wantsDelivery,
        deliveryAddress: wantsDelivery ? deliveryAddress.trim() : null,
      });
      setMessage({ type: "success", text: res.message || "Booking confirmed successfully." });
      addNotification(`You booked "${equipment.name}" for ${startDate} (${numericDays} day${numericDays > 1 ? "s" : ""}).`);
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
          {startDate && (
            <div className="summary-row">
              <span className="label">Start date</span>
              <span>{formatDate(startDate)}</span>
            </div>
          )}
          {endDateLabel && (
            <div className="summary-row">
              <span className="label">Rented until</span>
              <span>{endDateLabel}</span>
            </div>
          )}

          {pricing && (
            <>
              <div className="summary-row">
                <span className="label">Subtotal ({formatCurrency(equipment.rent_price)} × {numericDays})</span>
                <span>{formatCurrency(pricing.subtotal)}</span>
              </div>
              {pricing.discountPercent > 0 && (
                <div className="summary-row" style={{ color: "var(--green-text)" }}>
                  <span className="label" style={{ color: "var(--green-text)" }}>
                    Long-rental discount ({pricing.discountPercent}% off)
                  </span>
                  <span>-{formatCurrency(pricing.discountAmount)}</span>
                </div>
              )}
              {pricing.deliveryFee > 0 && (
                <div className="summary-row">
                  <span className="label">Delivery fee</span>
                  <span>{formatCurrency(pricing.deliveryFee)}</span>
                </div>
              )}
              <div className="summary-row total">
                <span>Total amount</span>
                <span>{formatCurrency(pricing.total)}</span>
              </div>
            </>
          )}
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
            {isValidDays && numericDays < 7 && (
              <p className="hint-text">Rent for 7+ days to unlock a 10% discount, or 30+ days for 20% off.</p>
            )}
          </div>

          {equipment.delivery_available && (
            <div className="form-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={wantsDelivery}
                  onChange={(e) => setWantsDelivery(e.target.checked)}
                />
                Deliver to me (+{formatCurrency(FLAT_DELIVERY_FEE)})
              </label>
              {wantsDelivery && (
                <>
                  <input
                    type="text"
                    placeholder="Delivery address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                  {errors.deliveryAddress && <div className="field-error">{errors.deliveryAddress}</div>}
                </>
              )}
            </div>
          )}

          <div className="form-field">
            <label>Choose a start date</label>
            <AvailabilityCalendar
              equipmentId={equipment.equipment_id}
              selectedStartDate={startDate}
              rentalDays={numericDays}
              onSelectStart={setStartDate}
            />
            {errors.startDate && <div className="field-error">{errors.startDate}</div>}
          </div>

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Confirming..." : "Confirm booking"}
          </button>
        </form>
      </div>
    </div>
  );
}
