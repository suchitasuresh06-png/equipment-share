"use client";

import { getEquipmentImage, getStatusPill, formatCurrency } from "@/lib/display";
import CategoryIcon from "@/components/CategoryIcon";

export default function EquipmentCard({ equipment, onOpen, onRent }) {
  const status = getStatusPill(equipment.availability);
  const image = getEquipmentImage(equipment);

  return (
    <div className="equipment-card">
      <button
        type="button"
        onClick={() => onOpen(equipment)}
        style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
      >
        <div className="image-wrap">
          {image ? (
            <img src={image} alt={equipment.name} />
          ) : (
            <div className="image-fallback">
              <CategoryIcon category={equipment.category} size={40} />
            </div>
          )}
        </div>

        <div className="content">
          <div className="name">{equipment.name}</div>
          <div className="meta-line">ID · GEN-{String(equipment.equipment_id).padStart(4, "0")}</div>
          {equipment.owner_name && (
            <div className="meta-line" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              Listed by {equipment.owner_name}
              {equipment.owner_gst_verified && <span className="gst-badge">GST Verified</span>}
              {equipment.owner_trusted && <span className="trusted-badge">Trusted Seller</span>}
            </div>
          )}
          {equipment.delivery_available && <div className="delivery-tag">🚚 Delivery available</div>}
          <div className="location-line">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {equipment.location} · {equipment.condition}
          </div>

          <span className={`status-pill ${status.tone}`}>{status.label}</span>

          <div className="price-row">
            <div className="price-block">
              <span className="price">{formatCurrency(equipment.rent_price)}</span>
              <span className="per-day">/ day</span>
            </div>
          </div>
        </div>
      </button>

      <div style={{ padding: "0 16px 16px", display: "flex", justifyContent: "flex-end" }}>
        {/* Rent Now is never disabled: even "Available later" equipment can
            still be booked for whichever dates aren't already taken — the
            backend blocks only the specific overlapping dates at submit time. */}
        <button
          type="button"
          className="rent-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRent(equipment);
          }}
        >
          Rent now
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
