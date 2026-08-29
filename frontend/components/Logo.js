export default function Logo({ size = 44 }) {
  return (
    <div className="brand-logo" style={{ width: size, height: size }} aria-label="Equipment Share">
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
        <path d="M3 17h6M4 17V10l5-3 5 4-2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 12l4 1.5v3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="19" r="1.7" fill="#fff" stroke="none" />
        <circle cx="16" cy="19" r="1.7" fill="#fff" stroke="none" />
      </svg>
    </div>
  );
}
