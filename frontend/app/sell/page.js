"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getEquipmentList,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  getBookings,
} from "@/lib/api";
import { formatCurrency, getStatusPill } from "@/lib/display";
import { getSession } from "@/lib/session";
import { addNotification, getLastSeenBookingId, setLastSeenBookingId } from "@/lib/notifications";
import BottomNav from "@/components/BottomNav";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import CategoryIcon from "@/components/CategoryIcon";
import ImageUploadField from "@/components/ImageUploadField";
import Toast from "@/components/Toast";

const CATEGORY_OPTIONS = ["Excavator", "Backhoe", "Loader"];
const CONDITION_OPTIONS = ["Excellent", "Good", "Fair"];
const EMPTY_FORM = {
  name: "",
  category: "Excavator",
  rent_price: "",
  location: "",
  condition: "Good",
  image_base64: null,
  delivery_available: false,
};

function greetingWord() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function SellPage() {
  const router = useRouter();
  const [session, setSessionState] = useState(null);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [message, setMessage] = useState(null);
  const [toast, setToast] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const pollRef = useRef(null);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/start");
      return;
    }
    if (s.role !== "seller") {
      router.replace("/rent");
      return;
    }
    setSessionState(s);
  }, [router]);

  async function loadEquipment(ownerId) {
    try {
      // Scoped to this seller only — a brand new seller sees an empty
      // list until they add their first machine.
      const data = await getEquipmentList({ ownerId });
      setEquipmentList(data);
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  async function checkForNewBookings(ownerId) {
    try {
      const bookings = await getBookings({ ownerId });
      if (!bookings.length) return;
      const lastSeen = getLastSeenBookingId();
      const newest = Math.max(...bookings.map((b) => b.booking_id));

      if (lastSeen && newest > lastSeen) {
        const freshOnes = bookings.filter((b) => b.booking_id > lastSeen);
        freshOnes.forEach((b) => {
          addNotification(`"${b.equipment_name}" was booked from ${b.rental_start_date} for ${b.rental_days} day(s).`);
        });
        setToast(`"${freshOnes[0].equipment_name}" was just booked!`);
        loadEquipment(ownerId);
      }
      setLastSeenBookingId(newest);
    } catch (err) {
      // Silent failure — polling shouldn't disrupt the page.
    }
  }

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    loadEquipment(session.user_id).finally(() => setLoading(false));

    checkForNewBookings(session.user_id);
    pollRef.current = setInterval(() => checkForNewBookings(session.user_id), 15000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session) {
    return <div className="loading-state">Loading...</div>;
  }

  function openAddForm() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  }

  function openEditForm(item) {
    setEditingId(item.equipment_id);
    setFormData({
      name: item.name,
      category: item.category,
      rent_price: String(item.rent_price),
      location: item.location,
      condition: item.condition,
      image_base64: item.image_base64 || null,
      delivery_available: item.delivery_available || false,
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function validateForm() {
    const errs = {};
    if (!formData.name.trim() || formData.name.trim().length < 3) {
      errs.name = "Equipment name must be at least 3 characters long.";
    }
    const price = Number(formData.rent_price);
    if (!formData.rent_price || Number.isNaN(price) || price <= 0) {
      errs.rent_price = "Rent price must be a number greater than 0.";
    }
    if (!formData.location.trim()) {
      errs.location = "Location cannot be empty.";
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setMessage(null);
    if (!validateForm()) return;

    const payload = {
      owner_id: session.user_id,
      name: formData.name.trim(),
      category: formData.category,
      rent_price: Number(formData.rent_price),
      location: formData.location.trim(),
      condition: formData.condition,
      image_base64: formData.image_base64,
      delivery_available: formData.delivery_available,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateEquipment(editingId, payload);
        setMessage({ type: "success", text: "Equipment updated successfully." });
      } else {
        await createEquipment(payload);
        setMessage({ type: "success", text: "Equipment added successfully." });
      }
      setFormOpen(false);
      await loadEquipment(session.user_id);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    setMessage(null);
    try {
      const res = await deleteEquipment(item.equipment_id, session.user_id);
      setMessage({ type: "success", text: res.message });
      await loadEquipment(session.user_id);
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  return (
    <div className="screen">
      <div className="header-row">
        <Logo />
        <div className="header-icons">
          <NotificationBell />
        </div>
      </div>

      <div className="greeting">Hi {session.name.split(" ")[0]}, {greetingWord()}</div>
      <h1 className="hero-heading">
        List your machines, <span className="accent">earn more every day.</span>
      </h1>

      {message && <div className={`form-message ${message.type}`}>{message.text}</div>}
      {errorMsg && <div className="form-message error">{errorMsg}</div>}

      {loading && <div className="loading-state">Loading...</div>}

      {!loading && (
        <>
          <div className="section-header">
            <h2>Your equipment</h2>
            <span className="count">{equipmentList.length} listed</span>
          </div>

          {equipmentList.length === 0 && (
            <div className="empty-state">No equipment listed yet. Tap the + button to add your first machine.</div>
          )}

          {equipmentList.map((item) => (
            <div className="owner-card" key={item.equipment_id}>
              <div className="owner-card-header">
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div className="owner-thumb">
                    {item.image_base64 ? (
                      <img src={item.image_base64} alt={item.name} />
                    ) : (
                      <CategoryIcon category={item.category} size={22} />
                    )}
                  </div>
                  <div>
                    <div className="owner-card-title">{item.name}</div>
                    <div className="owner-card-sub">
                      {item.category} · {item.location} · {item.condition}
                    </div>
                    {item.delivery_available && <div className="delivery-tag">🚚 Delivery offered</div>}
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: "var(--navy)", whiteSpace: "nowrap" }}>
                  {formatCurrency(item.rent_price)}/day
                </div>
              </div>

              <span className={`status-pill ${getStatusPill(item.availability).tone}`}>
                {getStatusPill(item.availability).label}
              </span>

              <div className="owner-card-actions">
                <button type="button" className="pill-btn" onClick={() => openEditForm(item)}>
                  Edit
                </button>
                <button type="button" className="pill-btn danger" onClick={() => handleDelete(item)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <button type="button" className="fab-add" onClick={openAddForm} aria-label="Add equipment">
        +
      </button>

      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <button className="close-btn" type="button" onClick={() => setFormOpen(false)} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>

            <div className="modal-title">{editingId ? "Edit equipment" : "Add equipment"}</div>
            <div className="modal-subtitle">All fields are required and validated before saving.</div>

            <form onSubmit={handleFormSubmit}>
              <ImageUploadField
                value={formData.image_base64}
                onChange={(val) => setFormData({ ...formData, image_base64: val })}
                category={formData.category}
              />

              <div className="form-field">
                <label htmlFor="eq-name">Equipment name</label>
                <input
                  id="eq-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Volvo EC210 Excavator"
                />
                {formErrors.name && <div className="field-error">{formErrors.name}</div>}
              </div>

              <div className="form-field">
                <label htmlFor="eq-category">Category</label>
                <select
                  id="eq-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="eq-price">Rent price per day (₹)</label>
                <input
                  id="eq-price"
                  type="number"
                  min="1"
                  value={formData.rent_price}
                  onChange={(e) => setFormData({ ...formData, rent_price: e.target.value })}
                  placeholder="e.g. 15000"
                />
                {formErrors.rent_price && <div className="field-error">{formErrors.rent_price}</div>}
              </div>

              <div className="form-field">
                <label htmlFor="eq-location">Location</label>
                <input
                  id="eq-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Pune, Maharashtra"
                />
                {formErrors.location && <div className="field-error">{formErrors.location}</div>}
              </div>

              <div className="form-field">
                <label htmlFor="eq-condition">Condition</label>
                <select
                  id="eq-condition"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                >
                  {CONDITION_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.delivery_available}
                    onChange={(e) => setFormData({ ...formData, delivery_available: e.target.checked })}
                  />
                  Offer delivery for this equipment (+₹500 flat fee to the buyer)
                </label>
              </div>

              <button className="btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add equipment"}
              </button>
            </form>
          </div>
        </div>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />

      <BottomNav role="seller" active="sell" />
    </div>
  );
}
