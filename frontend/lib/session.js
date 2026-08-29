// Simple localStorage-backed "session" for this demo app. There's no
// authentication system in scope — this just remembers which role the
// person picked (Buyer/Seller) and the name+phone they entered once at
// onboarding, so buyers never have to re-type their details when booking.

const KEY = "equipment_share_session";

export function getSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.role || !parsed?.name || !parsed?.phone) return null;
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
