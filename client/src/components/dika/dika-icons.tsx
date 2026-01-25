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
      {/* Petals */}
      <path d="M12 1.5L13.5 6.5L12 7.5L10.5 6.5L12 1.5Z" fill="#F59E0B" />
      <path d="M16.6 3.1L15.5 8L14 7.5L14.5 6L16.6 3.1Z" fill="#F59E0B" />
      <path d="M20.5 7L16 9.5L15.5 8L17 7L20.5 7Z" fill="#F59E0B" />
      <path d="M22.5 12L17.5 13.5L17 12L18 10.5L22.5 12Z" fill="#F59E0B" />
      <path d="M20.5 17L16 14.5L17 13L18 14L20.5 17Z" fill="#F59E0B" />
      <path d="M16.6 20.9L15 15.5L16 14L16.5 15.5L16.6 20.9Z" fill="#F59E0B" />
      <path d="M12 22.5L10.5 17.5L12 16.5L13.5 17.5L12 22.5Z" fill="#F59E0B" />
      <path d="M7.4 20.9L8.5 16L10 16.5L9.5 18L7.4 20.9Z" fill="#F59E0B" />
      <path d="M3.5 17L8 14.5L8.5 16L7 17L3.5 17Z" fill="#F59E0B" />
      <path d="M1.5 12L6.5 10.5L7 12L6 13.5L1.5 12Z" fill="#F59E0B" />
      <path d="M3.5 7L8 9.5L7 11L6 10L3.5 7Z" fill="#F59E0B" />
      <path d="M7.4 3.1L9 8.5L8 10L7.5 8.5L7.4 3.1Z" fill="#F59E0B" />
      {/* Center */}
      <circle cx="12" cy="12" r="5" fill="#78350F" />
      <circle cx="12" cy="12" r="3.5" fill="#92400E" />
      <circle cx="11" cy="11" r="1" fill="#78350F" />
    </svg>
  );
}

export function BatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 5C12 5 10 7 10 9C10 9 8 7 5 7C5 7 7 10 7 12C7 12 4 11 2 12C2 12 5 14 7 15C7 15 6 18 8 20C8 20 10 18 12 18C14 18 16 20 16 20C18 18 17 15 17 15C19 14 22 12 22 12C20 11 17 12 17 12C17 10 19 7 19 7C16 7 14 9 14 9C14 7 12 5 12 5Z" />
    </svg>
  );
}
