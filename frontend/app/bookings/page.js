"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBookings } from "@/lib/api";
import { getSession } from "@/lib/session";
import { formatCurrency, getRentedUntilDate, formatDate } from "@/lib/display";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";

export default function BookingsPage() {
  const router = useRouter();
  const [session, setSessionState] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/start");
      return;
    }
    setSessionState(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    getBookings(session.role === "buyer" ? { phone: session.phone } : {})
      .then(setBookings)
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) {
    return <div className="loading-state">Loading...</div>;
  }

  const isBuyer = session.role === "buyer";

  return (
    <div className="screen">
      <div className="header-row">
        <Logo />
      </div>

      <div className="greeting">{isBuyer ? "Your rentals" : "All bookings"}</div>
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

      {loading && <div className="loading-state">Loading bookings...</div>}
      {errorMsg && <div className="form-message error">{errorMsg}</div>}

      {!loading && !errorMsg && bookings.length === 0 && (
        <div className="empty-state">
          {isBuyer ? "You haven't rented any equipment yet." : "No bookings have been made yet."}
        </div>
      )}

      {!loading &&
        bookings.map((b) => {
          const until = getRentedUntilDate(b.booking_date, b.rental_days);
          return (
            <div className="booking-row" key={b.booking_id}>
              <div className="booking-row-top">
                <span className="customer">{isBuyer ? b.equipment_name : b.customer_name}</span>
                <span className="status-tag">{b.status}</span>
              </div>
              {!isBuyer && <div className="equipment">{b.equipment_name}</div>}
              <div className="meta">
                <span>
                  {b.rental_days} day{b.rental_days > 1 ? "s" : ""}
                </span>
                <span>{formatCurrency(b.total_amount)}</span>
              </div>
              <div className="booking-dates">
                Booked {formatDate(b.booking_date)} → rented until <strong>{formatDate(until)}</strong>
              </div>
            </div>
          );
        })}

      <BottomNav role={session.role} active="bookings" />
    </div>
  );
}
