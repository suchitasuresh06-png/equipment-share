// Session is now backed by a real login call to the backend (see
// app/start/page.js) — this just stores whatever the server returned
// (user_id, name, phone, role) in localStorage so the person doesn't
// have to log in again every time they open the app.

const KEY = "equipment_share_session";

export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.user_id || !parsed?.role || !parsed?.name || !parsed?.phone) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

export function setSession(session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function isBuyer(session) {
  return session?.role === "buyer";
}

export function isSeller(session) {
  return session?.role === "seller";
}
