"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getEquipmentById } from "@/lib/api";
import { getEquipmentImage, formatCurrency, getStatusPill } from "@/lib/display";
import { getSession } from "@/lib/session";
import BookingForm from "@/components/BookingForm";
import CategoryIcon from "@/components/CategoryIcon";

const DESCRIPTIONS = {
  Excavator:
    "A reliable second-hand excavator, well suited for digging, trenching and site clearing on small to mid-sized job sites. Inspected and ready for immediate deployment.",
  Backhoe:
    "A versatile backhoe loader that combines digging and loading in one machine — ideal for utility work, landscaping and general construction tasks.",
  Loader:
    "A dependable wheel loader built for moving material quickly around the site — earth, gravel, sand or debris — with a smooth, easy-to-operate control layout.",
};

export default function EquipmentDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [session, setSessionState] = useState(null);
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/start");
      return;
    }
    if (s.role !== "buyer") {
      router.replace("/sell");
      return;
    }
    setSessionState(s);
  }, [router]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getEquipmentById(id)
      .then((data) => active && setEquipment(data))
      .catch((err) => active && setErrorMsg(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (!session || loading) {
    return <div className="loading-state">Loading equipment details...</div>;
  }

  if (errorMsg || !equipment) {
    return (
      <div className="screen">
        <div className="form-message error">{errorMsg || "Equipment not found."}</div>
        <button className="btn-secondary" type="button" onClick={() => router.push("/rent")}>
          Back to home
        </button>
      </div>
    );
  }

  const status = getStatusPill(equipment.availability);
  const isAvailable = equipment.availability === "Available";
  const image = getEquipmentImage(equipment);

  return (
    <div>
      <div className="details-hero">
        {image ? (
          <img src={image} alt={equipment.name} />
        ) : (
          <div className="image-fallback" style={{ height: "100%" }}>
            <CategoryIcon category={equipment.category} size={64} />
          </div>
        )}
        <button className="back-btn" type="button" onClick={() => router.back()} aria-label="Go back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="details-sheet">
        <div className="details-name">{equipment.name}</div>
        <div className="details-id">ID · GEN-{String(equipment.equipment_id).padStart(4, "0")}</div>
        {equipment.owner_name && (
          <div className="details-id" style={{ marginTop: -8 }}>Listed by {equipment.owner_name}</div>
        )}

        <span className={`status-pill ${status.tone}`}>{status.label}</span>

        <div className="details-info-grid" style={{ marginTop: 14 }}>
          <div className="info-card">
            <div className="label">Category</div>
            <div className="value">{equipment.category}</div>
          </div>
          <div className="info-card">
            <div className="label">Condition</div>
            <div className="value">{equipment.condition}</div>
          </div>
          <div className="info-card">
            <div className="label">Location</div>
            <div className="value">{equipment.location}</div>
          </div>
          <div className="info-card">
            <div className="label">Price per day</div>
            <div className="value">{formatCurrency(equipment.rent_price)}</div>
          </div>
        </div>

        <div className="details-section-title">About this machine</div>
        <p className="details-description">
          {DESCRIPTIONS[equipment.category] ||
            "A well-maintained second-hand machine, ready to rent for your next project."}
        </p>
      </div>

      <div className="details-bottom-bar">
        <div className="price-block">
          <span className="price">{formatCurrency(equipment.rent_price)}</span>
          <span className="per-day">/ day</span>
        </div>
        <button
          type="button"
          className="rent-btn"
          disabled={!isAvailable}
          onClick={() => setShowBooking(true)}
        >
          {isAvailable ? "Rent now" : "Unavailable"}
        </button>
      </div>

      {showBooking && (
        <BookingForm
          equipment={equipment}
          buyer={{ name: session.name, phone: session.phone }}
          onClose={() => setShowBooking(false)}
          onSuccess={() => {
            setShowBooking(false);
            router.push("/rent");
          }}
        />
      )}
    </div>
  );
}
