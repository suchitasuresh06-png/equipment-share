"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";
import Logo from "@/components/Logo";

const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const PHONE_PATTERN = /^[0-9]{10}$/;

export default function StartPage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});

  function validate() {
    const next = {};
    if (!name.trim() || !NAME_PATTERN.test(name.trim())) {
      next.name = "Please enter a valid name using only letters and spaces.";
    }
    if (!phone.trim() || !PHONE_PATTERN.test(phone.trim())) {
      next.phone = "Please enter a valid 10-digit phone number.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleContinue(e) {
    e.preventDefault();
    if (!role) return;
    if (!validate()) return;

    setSession({ role, name: name.trim(), phone: phone.trim() });
    router.push(role === "seller" ? "/sell" : "/rent");
  }

  return (
    <div className="screen" style={{ paddingTop: 48 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Logo size={64} />
      </div>
      <h1 className="hero-heading" style={{ textAlign: "center", fontSize: 24 }}>
        Welcome to <span className="accent">Equipment Share</span>
      </h1>
      <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 26 }}>
        Rent or list second-hand professional and heavy equipment.
      </p>

      <div className="role-grid">
        <button
          type="button"
          className={`role-card ${role === "buyer" ? "active" : ""}`}
          onClick={() => setRole("buyer")}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 17h8M5 17V9l6-3 5 4-3 3M14 10l4 2v5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="19" r="1.6" />
            <circle cx="16" cy="19" r="1.6" />
          </svg>
          <div className="role-card-title">I want to rent</div>
          <div className="role-card-sub">Browse and book equipment</div>
        </button>

        <button
          type="button"
          className={`role-card ${role === "seller" ? "active" : ""}`}
          onClick={() => setRole("seller")}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3 21 12l-9 9-9-9V3h9Z" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="8.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
          </svg>
          <div className="role-card-title">I want to list</div>
          <div className="role-card-sub">Manage your equipment</div>
        </button>
      </div>

      {role && (
        <form onSubmit={handleContinue} style={{ marginTop: 24 }}>
          <div className="form-field">
            <label htmlFor="start-name">Your full name</label>
            <input
              id="start-name"
              type="text"
              placeholder="e.g. Aditya Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && <div className="field-error">{errors.name}</div>}
          </div>

          <div className="form-field">
            <label htmlFor="start-phone">Phone number</label>
            <input
              id="start-phone"
              type="tel"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
            />
            {errors.phone && <div className="field-error">{errors.phone}</div>}
          </div>

          <button className="btn-primary" type="submit">
            Continue as {role === "seller" ? "Seller" : "Buyer"}
          </button>
        </form>
      )}
    </div>
  );
}
