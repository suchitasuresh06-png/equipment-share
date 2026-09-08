"use client";

import { useEffect, useMemo, useState } from "react";
import { getBookedDates } from "@/lib/api";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toISO(date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * Renders a month calendar for one piece of equipment, shading any date
 * that falls inside an existing Confirmed booking so the buyer can see —
 * before they even pick anything — exactly which dates are already
 * taken and which are free. Tapping a free day sets it as the rental
 * start date; if a rental length is already chosen, the resulting range
 * is highlighted too so a would-be conflict is visible immediately,
 * before the booking is ever submitted.
 */
export default function AvailabilityCalendar({ equipmentId, selectedStartDate, rentalDays, onSelectStart }) {
  const [bookedRanges, setBookedRanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));

  useEffect(() => {
    let active = true;
    setLoading(true);
    getBookedDates(equipmentId)
      .then((data) => active && setBookedRanges(data))
      .catch((err) => active && setErrorMsg(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [equipmentId]);

  const today = useMemo(() => toISO(new Date()), []);

  function isBooked(dateStr) {
    return bookedRanges.some((r) => dateStr >= r.start_date && dateStr <= r.end_date);
  }

  const selectionEnd = useMemo(() => {
    if (!selectedStartDate || !rentalDays || rentalDays <= 0) return null;
    const start = new Date(selectedStartDate);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + rentalDays - 1);
    return toISO(end);
  }, [selectedStartDate, rentalDays]);

  function isInSelection(dateStr) {
    if (!selectedStartDate) return false;
    if (!selectionEnd) return dateStr === selectedStartDate;
    return dateStr >= selectedStartDate && dateStr <= selectionEnd;
  }

  // Build the grid: blank leading cells + one cell per day of the month.
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const isCurrentRealMonth = isSameMonth(visibleMonth, new Date());

  function changeMonth(delta) {
    setVisibleMonth(new Date(year, month + delta, 1));
  }

  return (
    <div className="calendar-card">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav-btn"
          onClick={() => changeMonth(-1)}
          disabled={isCurrentRealMonth}
          aria-label="Previous month"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="calendar-month-label">
          {MONTH_NAMES[month]} {year}
        </div>
        <button type="button" className="calendar-nav-btn" onClick={() => changeMonth(1)} aria-label="Next month">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {loading && <div className="calendar-loading">Loading availability...</div>}
      {errorMsg && <div className="field-error">{errorMsg}</div>}

      {!loading && !errorMsg && (
        <>
          <div className="calendar-grid calendar-weekdays">
            {WEEKDAYS.map((d, i) => (
              <div key={i} className="calendar-weekday">
                {d}
              </div>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} />;

              const dateStr = toISO(new Date(year, month, day));
              const isPast = dateStr < today;
              const booked = !isPast && isBooked(dateStr);
              const selected = !isPast && !booked && isInSelection(dateStr);
              const isStart = dateStr === selectedStartDate;

              let className = "calendar-day";
              if (isPast) className += " calendar-day-past";
              else if (booked) className += " calendar-day-booked";
              else if (selected) className += isStart ? " calendar-day-start" : " calendar-day-selected";
              else className += " calendar-day-free";

              return (
                <button
                  key={dateStr}
                  type="button"
                  className={className}
                  disabled={isPast || booked}
                  onClick={() => onSelectStart(dateStr)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="calendar-legend">
            <span>
              <i className="calendar-dot calendar-dot-free" /> Free
            </span>
            <span>
              <i className="calendar-dot calendar-dot-booked" /> Booked
            </span>
            <span>
              <i className="calendar-dot calendar-dot-selected" /> Your dates
            </span>
          </div>
        </>
      )}
    </div>
  );
}
