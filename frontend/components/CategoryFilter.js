"use client";

import CategoryIcon from "@/components/CategoryIcon";

const CATEGORIES = [
  { id: "All", label: "All" },
  { id: "Excavator", label: "Excavator" },
  { id: "Backhoe", label: "Backhoe" },
  { id: "Loader", label: "Loader" },
];

export default function CategoryFilter({ selected, onSelect }) {
  return (
    <div className="chip-row">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`chip ${selected === cat.id ? "active" : ""}`}
          onClick={() => onSelect(cat.id)}
        >
          {cat.id !== "All" && <CategoryIcon category={cat.id} size={16} />}
          {cat.label}
        </button>
      ))}
    </div>
  );
}
