// Small notification log, kept in localStorage per role. There's no
// push/websocket infrastructure in this project, so the seller's "new
// booking" alerts are produced by briefly polling GET /bookings and
// diffing against the last booking_id we've already seen.

const LOG_KEY = "equipment_share_notifications";
const LAST_SEEN_KEY = "equipment_share_last_seen_booking_id";
const MAX_ITEMS = 20;

export function getNotifications() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOG_KEY) || "[]");
  } catch (err) {
    return [];
  }
}

export function addNotification(message) {
  if (typeof window === "undefined") return;
  const existing = getNotifications();
  const next = [{ message, at: new Date().toISOString(), read: false }, ...existing].slice(0, MAX_ITEMS);
  window.localStorage.setItem(LOG_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("equipment-share-notifications-updated"));
}

export function markAllRead() {
  if (typeof window === "undefined") return;
  const existing = getNotifications().map((n) => ({ ...n, read: true }));
  window.localStorage.setItem(LOG_KEY, JSON.stringify(existing));
  window.dispatchEvent(new Event("equipment-share-notifications-updated"));
}

export function getUnreadCount() {
  return getNotifications().filter((n) => !n.read).length;
}

export function getLastSeenBookingId() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(LAST_SEEN_KEY) || 0);
}

export function setLastSeenBookingId(id) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SEEN_KEY, String(id));
}
