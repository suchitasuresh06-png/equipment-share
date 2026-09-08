"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBookings, cancelBooking, extendBooking } from "@/lib/api";
import { getSession } from "@/lib/session";
import { formatCurrency, getRentedUntilDate, formatDate } from "@/lib/display";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import MessageThread from "@/components/MessageThread";

export default function BookingsPage() {
  const router = useRouter();
  const [session, setSessionState] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [messageThreadBooking, setMessageThreadBooking] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/start");
      return;
    }
    setSessionState(s);
  }, [router]);

  function loadBookings(s) {
    setLoading(true);
    return getBookings(s.role === "buyer" ? { phone: s.phone } : { ownerId: s.user_id })
      .then(setBookings)
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!session) return;
    loadBookings(session);
  }, [session]);

  if (!session) {
    return <div className="loading-state">Loading...</div>;
  }

  const isBuyer = session.role === "buyer";

  async function handleCancel(booking) {
    if (!confirm(`Cancel this booking for "${booking.equipment_name}"? This can't be undone.`)) return;
    setMessage(null);
    setBusyId(booking.booking_id);
    try {
      const res = await cancelBooking(booking.booking_id, session.user_id);
      setMessage({ type: "success", text: res.message });
      await loadBookings(session);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  async function handleExtend(booking) {
    const input = prompt(`Extend "${booking.equipment_name}" by how many more days?`, "3");
    if (!input) return;
    const additionalDays = Number(input);
    if (!Number.isInteger(additionalDays) || additionalDays <= 0) {
      setMessage({ type: "error", text: "Please enter a whole number of days greater than 0." });
      return;
    }

    setMessage(null);
    setBusyId(booking.booking_id);
    try {
      const res = await extendBooking(booking.booking_id, session.user_id, additionalDays);
      setMessage({ type: "success", text: res.message });
      await loadBookings(session);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="screen">
      <div className="header-row">
        <Logo />
      </div>

      <div className="greeting">{isBuyer ? "Your rentals" : "Bookings for your equipment"}</div>
      <h1 className="hero-heading" style={{ fontSize: 22 }}>
        {isBuyer ? (
          <>
            Your <span className="accent">bookings</span>
          </>
        ) : (
          <>
            Booking <span className="accent">activity</span>
          </>
        )}
      </h1>

      {message && <div className={`form-message ${message.type}`}>{message.text}</div>}
      {loading && <div className="loading-state">Loading bookings...</div>}
      {errorMsg && <div className="form-message error">{errorMsg}</div>}

      {!loading && !errorMsg && bookings.length === 0 && (
        <div className="empty-state">
          {isBuyer ? "You haven't rented any equipment yet." : "No bookings have been made yet."}
        </div>
      )}

      {!loading &&
        bookings.map((b) => {
          const until = getRentedUntilDate(b.rental_start_date, b.rental_days);
          const isCancelled = b.status === "Cancelled";
          const isBusy = busyId === b.booking_id;

          return (
            <div className="booking-row" key={b.booking_id}>
              <div className="booking-row-top">
                <span className="customer">{isBuyer ? b.equipment_name : b.customer_name}</span>
                <span className={`status-tag ${isCancelled ? "cancelled" : ""}`}>{b.status}</span>
              </div>
              {!isBuyer && <div className="equipment">{b.equipment_name}</div>}

              <div className="booking-dates">
                From {formatDate(b.rental_start_date)} ({b.rental_days} day{b.rental_days > 1 ? "s" : ""})
                → rented until <strong>{formatDate(until)}</strong>
              </div>

              <div className="price-breakdown">
                <div className="price-breakdown-row">
                  <span>Subtotal</span>
                  <span>{formatCurrency(b.subtotal_amount)}</span>
                </div>
                {b.discount_percent > 0 && (
                  <div className="price-breakdown-row" style={{ color: "var(--green-text)" }}>
                    <span>Discount ({b.discount_percent}% off)</span>
                    <span>-{formatCurrency((b.subtotal_amount * b.discount_percent) / 100)}</span>
                  </div>
                )}
                {b.delivery_requested && (
                  <div className="price-breakdown-row">
                    <span>Delivery fee</span>
                    <span>{formatCurrency(b.delivery_fee)}</span>
                  </div>
                )}
                <div className="price-breakdown-row total">
                  <span>Total</span>
                  <span>{formatCurrency(b.total_amount)}</span>
                </div>
              </div>

              {b.delivery_requested && (
                <div className="delivery-tag">🚚 Delivery to: {b.delivery_address}</div>
              )}

              {!isCancelled && (
                <div className="booking-row-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="pill-btn" onClick={() => setMessageThreadBooking(b)}>
                    Messages
                  </button>
                  {isBuyer && (
                    <button
                      type="button"
                      className="pill-btn"
                      onClick={() => handleExtend(b)}
                      disabled={isBusy}
                    >
                      {isBusy ? "..." : "Extend booking"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="pill-btn danger"
                    onClick={() => handleCancel(b)}
                    disabled={isBusy}
                  >
                    {isBusy ? "..." : "Cancel booking"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

      {messageThreadBooking && (
        <MessageThread
          booking={messageThreadBooking}
          currentUserId={session.user_id}
          onClose={() => setMessageThreadBooking(null)}
        />
      )}

      <BottomNav role={session.role} active="bookings" />
    </div>
  );
}
