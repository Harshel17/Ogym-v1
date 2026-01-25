export function DikaCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2" />
      <text x="12" y="16" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="bold" fontFamily="system-ui">D</text>
    </svg>
  );
}

export function SunflowerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="4" fill="#8B4513" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
        <ellipse
          key={angle}
          cx="12"
          cy="5"
          rx="2.5"
          ry="4"
          fill="#FFD700"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="3" fill="#654321" />
    </svg>
  );
}

export function BatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 4C10.5 4 9 5 8 6.5C6.5 5.5 4.5 5 3 6C4 8 4.5 10 4 12C3 12 2 12.5 2 14C3.5 14 5 14.5 6 15.5C6 17 6.5 18.5 8 19.5C9 18.5 10.5 18 12 18C13.5 18 15 18.5 16 19.5C17.5 18.5 18 17 18 15.5C19 14.5 20.5 14 22 14C22 12.5 21 12 20 12C19.5 10 20 8 21 6C19.5 5 17.5 5.5 16 6.5C15 5 13.5 4 12 4Z" />
    </svg>
  );
}
