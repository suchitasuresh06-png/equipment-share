const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch (err) {
    body = null;
  }

  if (!res.ok) {
    const message = body?.detail || "Something went wrong. Please try again.";
    throw new Error(message);
  }

  return body;
}

// Returning users only — just a phone number.
export function login({ phone }) {
  return request(`/auth/login`, { method: "POST", body: JSON.stringify({ phone }) });
}

// Brand-new accounts only — full details.
export function register({ name, phone, role, email, address, businessName, gstin }) {
  return request(`/auth/register`, {
    method: "POST",
    body: JSON.stringify({
      name,
      phone,
      role,
      email,
      address,
      business_name: businessName,
      gstin,
    }),
  });
}

export function getEquipmentList({ category, search, ownerId, minPrice, maxPrice, location } = {}) {
  const params = new URLSearchParams();
  if (category && category !== "All") params.set("category", category);
  if (search) params.set("search", search);
  if (ownerId) params.set("owner_id", ownerId);
  if (minPrice) params.set("min_price", minPrice);
  if (maxPrice) params.set("max_price", maxPrice);
  if (location) params.set("location", location);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/equipment${query}`);
}

export function getBookedDates(equipmentId) {
  return request(`/equipment/${equipmentId}/booked-dates`);
}

export function getEquipmentById(id) {
  return request(`/equipment/${id}`);
}

export function createEquipment(data) {
  return request(`/equipment`, { method: "POST", body: JSON.stringify(data) });
}

export function updateEquipment(id, data) {
  return request(`/equipment/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteEquipment(id, ownerId) {
  return request(`/equipment/${id}?owner_id=${ownerId}`, { method: "DELETE" });
}

export function createBooking({ userId, equipmentId, rentalStartDate, rentalDays, deliveryRequested, deliveryAddress }) {
  return request(`/bookings`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      equipment_id: equipmentId,
      rental_start_date: rentalStartDate,
      rental_days: rentalDays,
      delivery_requested: deliveryRequested || false,
      delivery_address: deliveryAddress || null,
    }),
  });
}

export function extendBooking(bookingId, userId, additionalDays) {
  return request(`/bookings/${bookingId}/extend`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, additional_days: additionalDays }),
  });
}

export function cancelBooking(bookingId, userId) {
  return request(`/bookings/${bookingId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export function sendMessage(bookingId, senderId, message) {
  return request(`/bookings/${bookingId}/messages`, {
    method: "POST",
    body: JSON.stringify({ sender_id: senderId, message }),
  });
}

export function getMessages(bookingId, userId) {
  return request(`/bookings/${bookingId}/messages?user_id=${userId}`);
}

export function getBookings({ phone, ownerId } = {}) {
  const params = new URLSearchParams();
  if (phone) params.set("phone", phone);
  if (ownerId) params.set("owner_id", ownerId);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/bookings${query}`);
}
