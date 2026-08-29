"use client";

import { useRef, useState } from "react";
import CategoryIcon from "@/components/CategoryIcon";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

export default function ImageUploadField({ value, onChange, category }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, etc).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large. Please choose one under 4MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.onerror = () => setError("Couldn't read that image. Please try another file.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="form-field">
      <label>Equipment photo (optional)</label>
      <div className="image-upload-box" onClick={() => inputRef.current?.click()}>
        {value ? (
          <img src={value} alt="Equipment preview" />
        ) : (
          <div className="image-upload-placeholder">
            <CategoryIcon category={category} size={26} />
            <span>Tap to attach a photo</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        style={{ display: "none" }}
      />
      <div className="image-upload-actions">
        <button type="button" className="pill-btn" onClick={() => inputRef.current?.click()}>
          {value ? "Change photo" : "Choose photo"}
        </button>
        {value && (
          <button type="button" className="pill-btn danger" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
