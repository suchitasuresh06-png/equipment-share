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

export function getEquipmentList({ category, search } = {}) {
  const params = new URLSearchParams();
  if (category && category !== "All") params.set("category", category);
  if (search) params.set("search", search);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/equipment${query}`);
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

export function updateAvailability(id, availability) {
  return request(`/equipment/${id}/availability`, {
    method: "PATCH",
    body: JSON.stringify({ availability }),
  });
}

export function deleteEquipment(id) {
  return request(`/equipment/${id}`, { method: "DELETE" });
}

export function createBooking(data) {
  return request(`/bookings`, { method: "POST", body: JSON.stringify(data) });
}

export function getBookings({ phone } = {}) {
  const params = new URLSearchParams();
  if (phone) params.set("phone", phone);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/bookings${query}`);
}
