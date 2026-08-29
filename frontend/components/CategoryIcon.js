"use client";

export default function CategoryIcon({ category, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
  };

  if (category === "Excavator") {
    return (
      <svg {...common}>
        <path d="M3 17h8M5 17V9l6-3 5 4-3 3M14 10l4 2v5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="6" cy="19" r="1.6" />
        <circle cx="16" cy="19" r="1.6" />
      </svg>
    );
  }
  if (category === "Backhoe") {
    return (
      <svg {...common}>
        <path d="M2 12l4-4 3 2 4-5 3 4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="9" y="12" width="8" height="6" rx="1" />
        <circle cx="7" cy="19" r="1.6" />
        <circle cx="18" cy="19" r="1.6" />
      </svg>
    );
  }
  // Loader / default
  return (
    <svg {...common}>
      <path d="M3 16V8h6l3 4h6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="9" y="10" width="9" height="6" rx="1" />
      <circle cx="7" cy="19" r="1.6" />
      <circle cx="17" cy="19" r="1.6" />
    </svg>
  );
}
