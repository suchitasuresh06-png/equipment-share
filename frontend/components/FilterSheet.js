"use client";

import { useState } from "react";

export default function FilterSheet({ initialFilters, onApply, onClose }) {
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice || "");
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice || "");
  const [location, setLocation] = useState(initialFilters.location || "");
  const [error, setError] = useState("");

  function handleApply(e) {
    e.preventDefault();
    setError("");

    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;

    if ((minPrice && Number.isNaN(min)) || (maxPrice && Number.isNaN(max))) {
      setError("Price must be a number.");
      return;
    }
    if (min !== null && min < 0) {
      setError("Minimum price can't be negative.");
      return;
    }
    if (min !== null && max !== null && min > max) {
      setError("Minimum price can't be higher than maximum price.");
      return;
    }

    onApply({ minPrice: min, maxPrice: max, location: location.trim() });
  }

  function handleClear() {
    setMinPrice("");
    setMaxPrice("");
    setLocation("");
    setError("");
    onApply({ minPrice: null, maxPrice: null, location: "" });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <button className="close-btn" onClick={onClose} aria-label="Close" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <div className="modal-title">Filter equipment</div>
        <div className="modal-subtitle">Narrow results by price or location</div>

        <form onSubmit={handleApply}>
          <div className="form-field">
            <label>Price per day (₹)</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="filter-location">Location</label>
            <input
              id="filter-location"
              type="text"
              placeholder="e.g. Pune"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {error && <div className="field-error" style={{ marginBottom: 12 }}>{error}</div>}

          <button className="btn-primary" type="submit">
            Apply filters
          </button>
          <button type="button" className="btn-secondary" style={{ marginTop: 10 }} onClick={handleClear}>
            Clear filters
          </button>
        </form>
      </div>
    </div>
  );
}
