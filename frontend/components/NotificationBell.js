"use client";

import { useEffect, useState } from "react";
import { getNotifications, getUnreadCount, markAllRead } from "@/lib/notifications";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  function refresh() {
    setItems(getNotifications());
    setUnread(getUnreadCount());
  }

  useEffect(() => {
    refresh();
    window.addEventListener("equipment-share-notifications-updated", refresh);
    return () => window.removeEventListener("equipment-share-notifications-updated", refresh);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  }

  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="icon-btn" onClick={toggle} aria-label="Notifications">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
        </svg>
        {unread > 0 && <span className="dot" />}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-dropdown">
            <div className="notif-title">Notifications</div>
            {items.length === 0 && <div className="notif-empty">No notifications yet.</div>}
            {items.map((n, i) => (
              <div className="notif-item" key={i}>
                <div className="notif-message">{n.message}</div>
                <div className="notif-time">{new Date(n.at).toLocaleString("en-IN")}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
