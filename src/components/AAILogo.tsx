export function AAILogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" aria-label="Airports Authority of India">
      <defs>
        <linearGradient id="aai-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.17 200)" />
          <stop offset="100%" stopColor="oklch(0.62 0.22 250)" />
        </linearGradient>
      </defs>
      {/* Blue arch */}
      <path
        d="M8 50 Q32 4 56 50"
        fill="none"
        stroke="url(#aai-grad)"
        strokeWidth="6"
        strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 6px oklch(0.82 0.17 200 / 0.6))" }}
      />
      {/* Plane silhouette rising through arch */}
      <path
        d="M32 42 L26 52 L28 52 L32 48 L36 52 L38 52 Z M32 42 L20 38 L20 36 L32 36 L44 36 L44 38 Z M32 42 L32 20 L34 22 L34 42 Z"
        fill="oklch(0.97 0.02 240)"
        style={{ filter: "drop-shadow(0 0 4px oklch(0.82 0.17 200 / 0.8))" }}
      />
    </svg>
  );
}
