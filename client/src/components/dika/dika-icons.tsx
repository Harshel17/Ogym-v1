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
      {/* Outer petals - larger, more natural shape */}
      {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map((angle, i) => (
        <path
          key={`outer-${angle}`}
          d={`M12,12 Q${11 + (i % 2) * 0.5},${4 - (i % 3) * 0.3} 12,2 Q${13 - (i % 2) * 0.5},${4 + (i % 3) * 0.3} 12,12`}
          fill="#FFC107"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      {/* Inner petals - smaller accent layer */}
      {[11.25, 33.75, 56.25, 78.75, 101.25, 123.75, 146.25, 168.75, 191.25, 213.75, 236.25, 258.75, 281.25, 303.75, 326.25, 348.75].map((angle) => (
        <path
          key={`inner-${angle}`}
          d="M12,12 Q11,6 12,4 Q13,6 12,12"
          fill="#FFB300"
          transform={`rotate(${angle} 12 12)`}
        />
      ))}
      {/* Seed head with texture */}
      <circle cx="12" cy="12" r="5" fill="#5D4037" />
      <circle cx="12" cy="12" r="4" fill="#6D4C41" />
      {/* Seed pattern */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <circle key={`seed-${angle}`} cx="12" cy="10" r="0.6" fill="#4E342E" transform={`rotate(${angle} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="1.5" fill="#3E2723" />
    </svg>
  );
}

export function BatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      {/* Batman-style bat symbol */}
      <path d="
        M12 3
        C11 3 10 3.5 9.5 4.5
        L8 4
        C6 4 4.5 5.5 3.5 7
        C4.5 7.5 5.5 8.5 5.5 10
        L4 11
        C2.5 11.5 1.5 12.5 1.5 14
        C2.5 14 4 14.5 5.5 15.5
        C6 17 7 18.5 8.5 19
        C9 18 10 17.5 12 17.5
        C14 17.5 15 18 15.5 19
        C17 18.5 18 17 18.5 15.5
        C20 14.5 21.5 14 22.5 14
        C22.5 12.5 21.5 11.5 20 11
        L18.5 10
        C18.5 8.5 19.5 7.5 20.5 7
        C19.5 5.5 18 4 16 4
        L14.5 4.5
        C14 3.5 13 3 12 3
        Z
        M10 8
        C10.5 8.5 10.5 9 10 10
        L9 11
        C9.5 12 10.5 12.5 12 12.5
        C13.5 12.5 14.5 12 15 11
        L14 10
        C13.5 9 13.5 8.5 14 8
        C13 8.5 12.5 9 12 9
        C11.5 9 11 8.5 10 8
        Z
      " fillRule="evenodd" />
    </svg>
  );
}
