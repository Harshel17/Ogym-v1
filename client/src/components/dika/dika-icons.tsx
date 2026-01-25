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
      <defs>
        <radialGradient id="sunflowerCenter" cx="40%" cy="40%">
          <stop offset="0%" stopColor="#A16207" />
          <stop offset="100%" stopColor="#451A03" />
        </radialGradient>
        <linearGradient id="petalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      {/* Outer petals layer */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
        <ellipse
          key={i}
          cx="12"
          cy="4"
          rx="2"
          ry="4.5"
          fill="url(#petalGradient)"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      {/* Inner petals layer */}
      {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((angle, i) => (
        <ellipse
          key={`inner-${i}`}
          cx="12"
          cy="5.5"
          rx="1.5"
          ry="3.5"
          fill="#FBBF24"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      {/* Center */}
      <circle cx="12" cy="12" r="5" fill="url(#sunflowerCenter)" />
      {/* Seed pattern */}
      <circle cx="10.5" cy="10.5" r="0.7" fill="#78350F" />
      <circle cx="12" cy="10" r="0.7" fill="#78350F" />
      <circle cx="13.5" cy="10.5" r="0.7" fill="#78350F" />
      <circle cx="11" cy="12" r="0.7" fill="#78350F" />
      <circle cx="13" cy="12" r="0.7" fill="#78350F" />
      <circle cx="10.5" cy="13.5" r="0.7" fill="#78350F" />
      <circle cx="12" cy="14" r="0.7" fill="#78350F" />
      <circle cx="13.5" cy="13.5" r="0.7" fill="#78350F" />
      {/* Highlight */}
      <circle cx="10.5" cy="10.5" r="2" fill="white" fillOpacity="0.15" />
    </svg>
  );
}

export function BatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <defs>
        <linearGradient id="batGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Elegant bat silhouette */}
      <path 
        d="M12 3.5
           C12 3.5 12.5 5 13 5.5
           C13.5 6 14.5 5.5 15 6
           C16 6.5 17.5 7 19.5 8.5
           C21 9.5 22.5 11 23 12
           C23 12 20 11 18.5 11.5
           C17.5 12 17 13 16 14.5
           C15 16 13.5 18 12 19.5
           C10.5 18 9 16 8 14.5
           C7 13 6.5 12 5.5 11.5
           C4 11 1 12 1 12
           C1.5 11 3 9.5 4.5 8.5
           C6.5 7 8 6.5 9 6
           C9.5 5.5 10.5 6 11 5.5
           C11.5 5 12 3.5 12 3.5Z"
        fill="url(#batGradient)"
      />
      {/* Wing detail lines */}
      <path 
        d="M7 11.5 Q9 13 10.5 15.5"
        stroke="currentColor"
        strokeWidth="0.3"
        strokeOpacity="0.4"
        fill="none"
      />
      <path 
        d="M17 11.5 Q15 13 13.5 15.5"
        stroke="currentColor"
        strokeWidth="0.3"
        strokeOpacity="0.4"
        fill="none"
      />
      {/* Head highlight */}
      <ellipse cx="12" cy="6" rx="1" ry="0.8" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}
