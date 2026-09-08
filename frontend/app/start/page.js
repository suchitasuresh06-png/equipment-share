"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/session";
import { login, register } from "@/lib/api";
import Logo from "@/components/Logo";

const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const PHONE_PATTERN = /^[0-9]{10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Step flow:
//   "phone"    → just enter a phone number (fast path for returning users)
//   "register" → phone wasn't found, so collect full details for a new account
const STEP_PHONE = "phone";
const STEP_REGISTER = "register";

export default function StartPage() {
  const router = useRouter();
  const [step, setStep] = useState(STEP_PHONE);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
    businessName: "",
    gstin: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function goToDestination(user) {
    setSession(user);
    router.push(user.role === "seller" ? "/sell" : "/rent");
  }

  // -----------------------------------------------------------------
  // Step 1: phone only. If it's a known account, log straight in.
  // If not, move to full registration.
  // -----------------------------------------------------------------
  async function handlePhoneSubmit(e) {
    e.preventDefault();
    setErrors({});

    if (!PHONE_PATTERN.test(phone)) {
      setErrors({ phone: "Please enter a valid 10-digit phone number." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await login({ phone });
      goToDestination(res.user);
    } catch (err) {
      // "No account found" is expected for new people — just move them
      // to registration instead of showing it as a scary error.
      if (err.message.includes("No account found")) {
        setStep(STEP_REGISTER);
      } else {
        setErrors({ phone: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // -----------------------------------------------------------------
  // Step 2: full registration for a brand-new account.
  // -----------------------------------------------------------------
  function validateRegistration() {
    const next = {};
    if (!role) next.role = "Please choose whether you're renting or listing equipment.";
    if (!form.name.trim() || !NAME_PATTERN.test(form.name.trim())) {
      next.name = "Please enter a valid name using only letters and spaces.";
    }
    if (!form.email.trim() || !EMAIL_PATTERN.test(form.email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!form.address.trim() || form.address.trim().length < 5) {
      next.address = "Please enter your full address.";
    }
    if (role === "seller") {
      if (!form.businessName.trim() || form.businessName.trim().length < 2) {
        next.businessName = "Please enter your business name.";
      }
      const gstinClean = form.gstin.trim().toUpperCase();
      if (!GSTIN_PATTERN.test(gstinClean)) {
        next.gstin = "Please enter a valid 15-character GSTIN.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    if (!validateRegistration()) return;

    setSubmitting(true);
    try {
      const res = await register({
        name: form.name.trim(),
        phone,
        role,
        email: form.email.trim(),
        address: form.address.trim(),
        businessName: role === "seller" ? form.businessName.trim() : "",
        gstin: role === "seller" ? form.gstin.trim().toUpperCase() : "",
      });
      goToDestination(res.user);
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="screen" style={{ paddingTop: 48 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Logo size={64} />
      </div>
      <h1 className="hero-heading" style={{ textAlign: "center", fontSize: 24 }}>
        Welcome to <span className="accent">Equipment Share</span>
      </h1>

      {step === STEP_PHONE && (
        <>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 26 }}>
            Enter your phone number to log in, or to get started if you&apos;re new here.
          </p>
          <form onSubmit={handlePhoneSubmit}>
            <div className="form-field">
              <label htmlFor="phone">Phone number</label>
              <input
                id="phone"
                type="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))}
                autoFocus
              />
              {errors.phone && <div className="field-error">{errors.phone}</div>}
            </div>
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? "Checking..." : "Continue"}
            </button>
          </form>
        </>
      )}

      {step === STEP_REGISTER && (
        <>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 18 }}>
            Looks like you&apos;re new! Let&apos;s set up your account for <strong>{phone}</strong>.
          </p>

          <div className="role-grid" style={{ marginBottom: 20 }}>
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
          {errors.role && <div className="field-error" style={{ marginBottom: 14 }}>{errors.role}</div>}

          {role && (
            <form onSubmit={handleRegisterSubmit}>
              <div className="form-field">
                <label htmlFor="reg-name">Full name</label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="e.g. Aditya Sharma"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                />
                {errors.name && <div className="field-error">{errors.name}</div>}
              </div>

              <div className="form-field">
                <label htmlFor="reg-email">Email address</label>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                />
                {errors.email && <div className="field-error">{errors.email}</div>}
              </div>

              <div className="form-field">
                <label htmlFor="reg-address">{role === "seller" ? "Business address" : "Address"}</label>
                <input
                  id="reg-address"
                  type="text"
                  placeholder="Street, city, state"
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                />
                {errors.address && <div className="field-error">{errors.address}</div>}
              </div>

              {role === "seller" && (
                <>
                  <div className="form-field">
                    <label htmlFor="reg-business">Business name</label>
                    <input
                      id="reg-business"
                      type="text"
                      placeholder="e.g. Kumar Equipment Co."
                      value={form.businessName}
                      onChange={(e) => updateForm("businessName", e.target.value)}
                    />
                    {errors.businessName && <div className="field-error">{errors.businessName}</div>}
                  </div>

                  <div className="form-field">
                    <label htmlFor="reg-gstin">GSTIN</label>
                    <input
                      id="reg-gstin"
                      type="text"
                      placeholder="15-character GSTIN"
                      maxLength={15}
                      style={{ textTransform: "uppercase" }}
                      value={form.gstin}
                      onChange={(e) => updateForm("gstin", e.target.value.toUpperCase())}
                    />
                    {errors.gstin && <div className="field-error">{errors.gstin}</div>}
                    <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 6 }}>
                      Used to verify your business — shown as a &ldquo;GST Verified&rdquo; badge on your listings.
                    </p>
                  </div>
                </>
              )}

              {errors.form && <div className="form-message error">{errors.form}</div>}

              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? "Creating account..." : "Create account"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: 10 }}
                onClick={() => {
                  setStep(STEP_PHONE);
                  setRole(null);
                  setErrors({});
                }}
              >
                Use a different number
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
