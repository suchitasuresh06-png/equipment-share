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

export function login({ name, phone, role }) {
  return request(`/auth/login`, { method: "POST", body: JSON.stringify({ name, phone, role }) });
}

export function getEquipmentList({ category, search, ownerId } = {}) {
  const params = new URLSearchParams();
  if (category && category !== "All") params.set("category", category);
  if (search) params.set("search", search);
  if (ownerId) params.set("owner_id", ownerId);
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

export function updateAvailability(id, availability, ownerId) {
  return request(`/equipment/${id}/availability`, {
    method: "PATCH",
    body: JSON.stringify({ availability, owner_id: ownerId }),
  });
}

export function deleteEquipment(id, ownerId) {
  return request(`/equipment/${id}?owner_id=${ownerId}`, { method: "DELETE" });
}

export function createBooking(data) {
  return request(`/bookings`, { method: "POST", body: JSON.stringify(data) });
}

export function getBookings({ phone, ownerId } = {}) {
  const params = new URLSearchParams();
  if (phone) params.set("phone", phone);
  if (ownerId) params.set("owner_id", ownerId);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/bookings${query}`);
}
