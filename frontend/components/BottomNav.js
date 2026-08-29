"use client";

import { useRouter } from "next/navigation";

function NavIcon({ id }) {
  if (id === "rent") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 17h8M5 17V9l6-3 5 4-3 3M14 10l4 2v5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="19" r="1.5" />
        <circle cx="16" cy="19" r="1.5" />
      </svg>
    );
  }
  if (id === "sell") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3 21 12l-9 9-9-9V3h9Z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === "bookings") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="5" width="16" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M4 10h16" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 15a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4 20c1.6-3 4.6-4.5 8-4.5S18.4 17 20 20" strokeLinecap="round" />
    </svg>
  );
}

export default function BottomNav({ active, role }) {
  const router = useRouter();

  const items =
    role === "seller"
      ? [
          { id: "sell", label: "Sell", path: "/sell" },
          { id: "bookings", label: "Bookings", path: "/bookings" },
          { id: "profile", label: "Profile", path: "/profile" },
        ]
      : [
          { id: "rent", label: "Rent", path: "/rent" },
          { id: "bookings", label: "Bookings", path: "/bookings" },
          { id: "profile", label: "Profile", path: "/profile" },
        ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => router.push(item.path)}
        >
          <NavIcon id={item.id} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
