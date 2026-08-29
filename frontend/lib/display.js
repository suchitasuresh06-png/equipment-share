// Presentation-only helpers used across the app.

export function formatCurrency(amount) {
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

export function getStatusPill(availability) {
  if (availability === "Available") {
    return { label: "Available now", tone: "green" };
  }
  return { label: "Currently rented", tone: "amber" };
}

// Returns a data-URI/base64 image if the equipment has one uploaded,
// otherwise null — callers should fall back to <CategoryIcon /> so the
// UI never shows a broken image or an endless loading spinner.
export function getEquipmentImage(equipment) {
  return equipment?.image_base64 || null;
}

// Booking date + rental_days - 1 = the last day the equipment is booked
// for (a 1-day rental starting today ends today). Shown so nobody has to
// do the math themselves on the bookings page.
export function getRentedUntilDate(bookingDateStr, rentalDays) {
  const start = new Date(bookingDateStr);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + Number(rentalDays || 1) - 1);
  return end;
}

export function formatDate(date) {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
