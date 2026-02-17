import { useState, useCallback } from "react";

interface BodyMapProps {
  highlightedMuscles: string[];
  onMuscleClick?: (muscle: string) => void;
  selectedMuscle?: string | null;
  className?: string;
}

const baseMuscleToRegions: Record<string, string[]> = {
  "chest": ["chest"],
  "back": ["upper-back", "lats"],
  "shoulders": ["shoulders"],
  "front deltoids": ["shoulders"],
  "rear deltoids": ["shoulders"],
  "arms": ["biceps", "triceps", "forearms"],
  "biceps": ["biceps"],
  "triceps": ["triceps"],
  "forearms": ["forearms"],
  "legs": ["quads", "hamstrings", "calves"],
  "quadriceps": ["quads"],
  "quads": ["quads"],
  "hamstrings": ["hamstrings"],
  "calves": ["calves"],
  "glutes": ["glutes"],
  "core": ["abs", "obliques"],
  "abs": ["abs"],
  "lower abs": ["abs"],
  "upper abs": ["abs"],
  "obliques": ["obliques"],
  "lats": ["lats"],
  "upper back": ["upper-back"],
  "lower back": ["upper-back"],
  "full body": ["chest", "upper-back", "quads", "shoulders", "biceps", "triceps", "abs", "glutes", "hamstrings"],
  "cardio": [],
  "other": [],
  "rest": [],
  "stretching": [],
  "mobility": []
};

export const muscleToRegions: Record<string, string[]> = Object.fromEntries(
  Object.entries(baseMuscleToRegions).flatMap(([key, value]) => [
    [key, value],
    [key.charAt(0).toUpperCase() + key.slice(1), value],
    [key.toUpperCase(), value]
  ])
);

export const regionToMuscle: Record<string, string> = {
  "chest": "Chest",
  "upper-back": "Back",
  "lats": "Back",
  "shoulders": "Shoulders",
  "biceps": "Arms",
  "triceps": "Arms",
  "forearms": "Arms",
  "quads": "Legs",
  "hamstrings": "Legs",
  "calves": "Calves",
  "glutes": "Glutes",
  "abs": "Core",
  "obliques": "Core"
};

const regionLabels: Record<string, string> = {
  "chest": "Chest",
  "upper-back": "Upper Back",
  "lats": "Lats",
  "shoulders": "Delts",
  "biceps": "Biceps",
  "triceps": "Triceps",
  "forearms": "Forearms",
  "quads": "Quads",
  "hamstrings": "Hamstrings",
  "calves": "Calves",
  "glutes": "Glutes",
  "abs": "Abs",
  "obliques": "Obliques"
};

function Tooltip({ x, y, label, visible }: { x: number; y: number; label: string; visible: boolean }) {
  if (!visible) return null;
  const textLen = label.length * 5.5 + 14;
  return (
    <g className="pointer-events-none" style={{ opacity: visible ? 1 : 0, transition: "opacity 0.2s" }}>
      <rect
        x={x - textLen / 2}
        y={y - 22}
        width={textLen}
        height={20}
        rx={6}
        fill="hsl(var(--popover))"
        stroke="hsl(var(--border))"
        strokeWidth={0.8}
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))" }}
      />
      <polygon
        points={`${x - 4},${y - 2} ${x + 4},${y - 2} ${x},${y + 3}`}
        fill="hsl(var(--popover))"
      />
      <text
        x={x}
        y={y - 9}
        textAnchor="middle"
        fill="hsl(var(--popover-foreground))"
        fontSize="8.5"
        fontWeight="600"
        fontFamily="system-ui, sans-serif"
        letterSpacing="0.3"
      >
        {label}
      </text>
    </g>
  );
}

export function BodyMapFront({ 
  highlightedMuscles, 
  onMuscleClick, 
  selectedMuscle,
  className = "" 
}: BodyMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const isHighlighted = (region: string) => highlightedMuscles.includes(region);
  const isSelected = (region: string) => selectedMuscle === region;
  const isHovered = (region: string) => hoveredRegion === region;
  
  const getMuscleStyle = (region: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      transformOrigin: "center"
    };
    
    if (isSelected(region)) {
      return {
        ...base,
        fill: "url(#selectedGradF)",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
        filter: "url(#glowF)",
      };
    }
    if (isHighlighted(region)) {
      return {
        ...base,
        fill: "url(#highlightGradF)",
        stroke: "hsl(var(--primary) / 0.5)",
        strokeWidth: 1.2,
        filter: isHovered(region) ? "url(#glowF)" : "url(#softGlowF)",
      };
    }
    return {
      ...base,
      fill: "url(#skinGradF)",
      stroke: "hsl(var(--muted-foreground) / 0.15)",
      strokeWidth: 0.8,
      opacity: isHovered(region) ? 0.85 : 1,
    };
  };

  const handleMouseEnter = useCallback((region: string) => setHoveredRegion(region), []);
  const handleMouseLeave = useCallback(() => setHoveredRegion(null), []);

  const tooltipPositions: Record<string, { x: number; y: number }> = {
    shoulders: { x: 100, y: 62 },
    chest: { x: 100, y: 78 },
    biceps: { x: 42, y: 100 },
    forearms: { x: 40, y: 140 },
    abs: { x: 100, y: 148 },
    obliques: { x: 68, y: 148 },
    quads: { x: 100, y: 240 },
    calves: { x: 100, y: 320 },
  };

  return (
    <svg viewBox="0 0 200 400" className={`w-full max-w-[200px] ${className}`}>
      <defs>
        <linearGradient id="highlightGradF" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
          <stop offset="40%" stopColor="hsl(var(--primary))" stopOpacity="0.65" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="selectedGradF" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
        </linearGradient>
        <radialGradient id="skinGradF" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.14" />
          <stop offset="70%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.08" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.04" />
        </radialGradient>
        <radialGradient id="bodyGradF" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.16" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.06" />
        </radialGradient>
        <radialGradient id="auraGradF" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
          <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fiberGradF" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.08" />
          <stop offset="50%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.06" />
        </linearGradient>
        <filter id="glowF" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.45"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softGlowF" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.2"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="bodyShadowF" x="-10%" y="-5%" width="120%" height="115%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.1"/>
        </filter>
        <clipPath id="bodyClipF">
          <ellipse cx="100" cy="32" rx="24" ry="28" />
          <path d="M76 58 Q62 62 56 76 Q48 100 46 130 Q44 155 50 175 Q56 178 64 172 Q70 150 74 90 Q76 70 78 60 Z" />
          <path d="M124 58 Q138 62 144 76 Q152 100 154 130 Q156 155 150 175 Q144 178 136 172 Q130 150 126 90 Q124 70 122 60 Z" />
          <path d="M78 58 L122 58 Q126 80 128 110 Q130 150 126 195 Q124 210 120 240 Q118 265 120 300 Q122 340 126 360 L110 364 Q105 300 102 270 L100 240 L98 270 Q95 300 90 364 L74 360 Q78 340 80 300 Q82 265 80 240 Q76 210 74 195 Q70 150 72 110 Q74 80 78 58 Z" />
        </clipPath>
      </defs>
      
      {highlightedMuscles.length > 0 && (
        <ellipse cx="100" cy="200" rx="85" ry="190" fill="url(#auraGradF)" className="animate-pulse" style={{ animationDuration: "4s" }} />
      )}

      <g filter="url(#bodyShadowF)">
        <ellipse cx="100" cy="32" rx="24" ry="28" fill="url(#bodyGradF)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1.2" />
        <path d="M76 58 Q62 62 56 76 Q48 100 46 130 Q44 155 50 175 Q56 178 64 172 Q70 150 74 90 Q76 70 78 60 Z" 
              fill="url(#bodyGradF)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1.2" />
        <path d="M124 58 Q138 62 144 76 Q152 100 154 130 Q156 155 150 175 Q144 178 136 172 Q130 150 126 90 Q124 70 122 60 Z" 
              fill="url(#bodyGradF)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1.2" />
        <path d="M78 58 L122 58 Q126 80 128 110 Q130 150 126 195 Q124 210 120 240 Q118 265 120 300 Q122 340 126 360 L110 364 Q105 300 102 270 L100 240 L98 270 Q95 300 90 364 L74 360 Q78 340 80 300 Q82 265 80 240 Q76 210 74 195 Q70 150 72 110 Q74 80 78 58 Z" 
              fill="url(#bodyGradF)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1.2" />
      </g>
      
      <g className="muscles">
        <path 
          data-region="shoulders"
          data-testid="region-shoulders-front"
          d="M66 62 Q56 66 54 80 Q52 92 56 98 Q60 96 66 90 Q72 82 76 68 Q74 62 66 62 Z M134 62 Q144 66 146 80 Q148 92 144 98 Q140 96 134 90 Q128 82 124 68 Q126 62 134 62 Z"
          style={getMuscleStyle("shoulders")}
          onMouseEnter={() => handleMouseEnter("shoulders")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("shoulders")}
        />
        {isHighlighted("shoulders") && (
          <path d="M60 74 Q64 82 68 78 M140 74 Q136 82 132 78" stroke="white" strokeOpacity="0.12" strokeWidth="0.6" fill="none" className="pointer-events-none" />
        )}
        
        <path 
          data-region="chest"
          data-testid="region-chest"
          d="M78 64 Q76 72 74 86 Q72 100 76 112 Q82 118 92 120 L100 122 L108 120 Q118 118 124 112 Q128 100 126 86 Q124 72 122 64 Q112 58 100 56 Q88 58 78 64 Z"
          style={getMuscleStyle("chest")}
          onMouseEnter={() => handleMouseEnter("chest")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("chest")}
        />
        {isHighlighted("chest") && (
          <>
            <path d="M84 76 Q90 82 96 78 M104 78 Q110 82 116 76" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" fill="none" className="pointer-events-none" />
            <path d="M82 90 Q92 96 100 92 M100 92 Q108 96 118 90" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" fill="none" className="pointer-events-none" />
          </>
        )}
        
        <path 
          data-region="biceps"
          data-testid="region-biceps"
          d="M54 98 Q50 112 48 128 Q46 138 50 142 Q56 140 62 134 Q66 122 68 106 Q66 96 60 96 Z M146 98 Q150 112 152 128 Q154 138 150 142 Q144 140 138 134 Q134 122 132 106 Q134 96 140 96 Z"
          style={getMuscleStyle("biceps")}
          onMouseEnter={() => handleMouseEnter("biceps")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("biceps")}
        />
        {isHighlighted("biceps") && (
          <path d="M56 110 Q58 118 54 124 M144 110 Q142 118 146 124" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" fill="none" className="pointer-events-none" />
        )}
        
        <path 
          data-region="forearms"
          data-testid="region-forearms"
          d="M48 142 Q44 156 42 168 Q42 175 46 178 Q52 176 56 170 Q60 158 62 144 Q58 140 52 140 Z M152 142 Q156 156 158 168 Q158 175 154 178 Q148 176 144 170 Q140 158 138 144 Q142 140 148 140 Z"
          style={getMuscleStyle("forearms")}
          onMouseEnter={() => handleMouseEnter("forearms")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("forearms")}
        />
        
        <path 
          data-region="abs"
          data-testid="region-abs"
          d="M86 122 Q84 138 82 155 Q80 172 82 192 Q84 200 92 204 L100 206 L108 204 Q116 200 118 192 Q120 172 118 155 Q116 138 114 122 Q108 120 100 122 Q92 120 86 122 Z"
          style={getMuscleStyle("abs")}
          onMouseEnter={() => handleMouseEnter("abs")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("abs")}
        />
        {isHighlighted("abs") && (
          <>
            <line x1="88" y1="138" x2="112" y2="138" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" className="pointer-events-none" />
            <line x1="87" y1="152" x2="113" y2="152" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" className="pointer-events-none" />
            <line x1="86" y1="166" x2="114" y2="166" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" className="pointer-events-none" />
            <line x1="86" y1="180" x2="114" y2="180" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" className="pointer-events-none" />
            <line x1="100" y1="124" x2="100" y2="202" stroke="white" strokeOpacity="0.06" strokeWidth="0.4" className="pointer-events-none" />
          </>
        )}
        
        <path 
          data-region="obliques"
          data-testid="region-obliques"
          d="M72 112 Q74 118 78 122 Q82 130 82 155 Q80 180 78 200 Q74 196 70 188 Q68 170 70 150 Q72 130 72 112 Z M128 112 Q126 118 122 122 Q118 130 118 155 Q120 180 122 200 Q126 196 130 188 Q132 170 130 150 Q128 130 128 112 Z"
          style={getMuscleStyle("obliques")}
          onMouseEnter={() => handleMouseEnter("obliques")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("obliques")}
        />
        
        <path 
          data-region="quads"
          data-testid="region-quads"
          d="M80 208 Q78 230 76 255 Q74 280 76 300 Q78 314 86 318 Q94 320 98 310 L100 270 L100 212 Q92 206 82 206 Z M120 208 Q122 230 124 255 Q126 280 124 300 Q122 314 114 318 Q106 320 102 310 L100 270 L100 212 Q108 206 118 206 Z"
          style={getMuscleStyle("quads")}
          onMouseEnter={() => handleMouseEnter("quads")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("quads")}
        />
        {isHighlighted("quads") && (
          <>
            <path d="M86 230 Q92 240 88 250 M114 230 Q108 240 112 250" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" fill="none" className="pointer-events-none" />
            <path d="M84 270 Q90 276 86 285 M116 270 Q110 276 114 285" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" fill="none" className="pointer-events-none" />
          </>
        )}
        
        <path 
          data-region="calves"
          data-testid="region-calves-front"
          d="M78 322 Q76 338 74 355 Q74 362 80 364 Q88 366 92 360 Q94 344 96 330 Q92 320 84 320 Z M122 322 Q124 338 126 355 Q126 362 120 364 Q112 366 108 360 Q106 344 104 330 Q108 320 116 320 Z"
          style={getMuscleStyle("calves")}
          onMouseEnter={() => handleMouseEnter("calves")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("calves")}
        />
      </g>
      
      <g className="labels pointer-events-none">
        {isHighlighted("shoulders") && (
          <>
            <line x1="60" y1="76" x2="26" y2="68" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="26" cy="68" r="1.2" fill="hsl(var(--primary))" />
            <text x="24" y="64" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">DELTS</text>
          </>
        )}
        {isHighlighted("chest") && (
          <>
            <line x1="88" y1="88" x2="18" y2="96" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="18" cy="96" r="1.2" fill="hsl(var(--primary))" />
            <text x="16" y="92" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">CHEST</text>
          </>
        )}
        {isHighlighted("biceps") && (
          <>
            <line x1="152" y1="118" x2="178" y2="108" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="178" cy="108" r="1.2" fill="hsl(var(--primary))" />
            <text x="180" y="104" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">BICEPS</text>
          </>
        )}
        {isHighlighted("abs") && (
          <>
            <line x1="116" y1="160" x2="170" y2="155" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="170" cy="155" r="1.2" fill="hsl(var(--primary))" />
            <text x="172" y="151" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">ABS</text>
          </>
        )}
        {isHighlighted("obliques") && (
          <>
            <line x1="68" y1="155" x2="22" y2="158" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="22" cy="158" r="1.2" fill="hsl(var(--primary))" />
            <text x="20" y="154" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">OBLIQUES</text>
          </>
        )}
        {isHighlighted("quads") && (
          <>
            <line x1="120" y1="265" x2="168" y2="258" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="168" cy="258" r="1.2" fill="hsl(var(--primary))" />
            <text x="170" y="254" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">QUADS</text>
          </>
        )}
        {isHighlighted("calves") && (
          <>
            <line x1="78" y1="345" x2="40" y2="342" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="40" cy="342" r="1.2" fill="hsl(var(--primary))" />
            <text x="38" y="338" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">CALVES</text>
          </>
        )}
        {isHighlighted("forearms") && (
          <>
            <line x1="46" y1="160" x2="20" y2="175" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="20" cy="175" r="1.2" fill="hsl(var(--primary))" />
            <text x="18" y="171" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">FOREARMS</text>
          </>
        )}
      </g>

      {hoveredRegion && tooltipPositions[hoveredRegion] && (
        <Tooltip
          x={tooltipPositions[hoveredRegion].x}
          y={tooltipPositions[hoveredRegion].y}
          label={regionLabels[hoveredRegion] || hoveredRegion}
          visible={true}
        />
      )}
    </svg>
  );
}

export function BodyMapBack({ 
  highlightedMuscles, 
  onMuscleClick, 
  selectedMuscle,
  className = "" 
}: BodyMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const isHighlighted = (region: string) => highlightedMuscles.includes(region);
  const isSelected = (region: string) => selectedMuscle === region;
  const isHovered = (region: string) => hoveredRegion === region;
  
  const getMuscleStyle = (region: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      transformOrigin: "center"
    };
    
    if (isSelected(region)) {
      return {
        ...base,
        fill: "url(#selectedGradB)",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
        filter: "url(#glowB)",
      };
    }
    if (isHighlighted(region)) {
      return {
        ...base,
        fill: "url(#highlightGradB)",
        stroke: "hsl(var(--primary) / 0.5)",
        strokeWidth: 1.2,
        filter: isHovered(region) ? "url(#glowB)" : "url(#softGlowB)",
      };
    }
    return {
      ...base,
      fill: "url(#skinGradB)",
      stroke: "hsl(var(--muted-foreground) / 0.15)",
      strokeWidth: 0.8,
      opacity: isHovered(region) ? 0.85 : 1,
    };
  };

  const handleMouseEnter = useCallback((region: string) => setHoveredRegion(region), []);
  const handleMouseLeave = useCallback(() => setHoveredRegion(null), []);

  const tooltipPositions: Record<string, { x: number; y: number }> = {
    shoulders: { x: 100, y: 62 },
    "upper-back": { x: 100, y: 78 },
    lats: { x: 68, y: 135 },
    triceps: { x: 42, y: 100 },
    glutes: { x: 100, y: 198 },
    hamstrings: { x: 100, y: 248 },
    calves: { x: 100, y: 320 },
  };

  return (
    <svg viewBox="0 0 200 400" className={`w-full max-w-[200px] ${className}`}>
      <defs>
        <linearGradient id="highlightGradB" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
          <stop offset="40%" stopColor="hsl(var(--primary))" stopOpacity="0.65" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="selectedGradB" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
        </linearGradient>
        <radialGradient id="skinGradB" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.14" />
          <stop offset="70%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.08" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.04" />
        </radialGradient>
        <radialGradient id="bodyGradB" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.16" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.06" />
        </radialGradient>
        <radialGradient id="auraGradB" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.06" />
          <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
        <filter id="glowB" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.45"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softGlowB" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.2"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="bodyShadowB" x="-10%" y="-5%" width="120%" height="115%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.1"/>
        </filter>
      </defs>
      
      {highlightedMuscles.length > 0 && (
        <ellipse cx="100" cy="200" rx="85" ry="190" fill="url(#auraGradB)" className="animate-pulse" style={{ animationDuration: "4s" }} />
      )}

      <g filter="url(#bodyShadowB)">
        <ellipse cx="100" cy="32" rx="24" ry="28" fill="url(#bodyGradB)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1.2" />
        <path d="M76 58 Q62 62 56 76 Q48 100 46 130 Q44 155 50 175 Q56 178 64 172 Q70 150 74 90 Q76 70 78 60 Z" 
              fill="url(#bodyGradB)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1.2" />
        <path d="M124 58 Q138 62 144 76 Q152 100 154 130 Q156 155 150 175 Q144 178 136 172 Q130 150 126 90 Q124 70 122 60 Z" 
              fill="url(#bodyGradB)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1.2" />
        <path d="M78 58 L122 58 Q126 80 128 110 Q130 150 126 195 Q124 210 120 240 Q118 265 120 300 Q122 340 126 360 L110 364 Q105 300 102 270 L100 240 L98 270 Q95 300 90 364 L74 360 Q78 340 80 300 Q82 265 80 240 Q76 210 74 195 Q70 150 72 110 Q74 80 78 58 Z" 
              fill="url(#bodyGradB)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1.2" />
      </g>
      
      <g className="spine pointer-events-none" opacity="0.15">
        <path d="M100 48 Q100 80 100 120 Q100 160 100 195" stroke="hsl(var(--muted-foreground))" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
        <circle cx="100" cy="55" r="1.5" fill="hsl(var(--muted-foreground))" />
        <circle cx="100" cy="75" r="1.5" fill="hsl(var(--muted-foreground))" />
        <circle cx="100" cy="95" r="1.5" fill="hsl(var(--muted-foreground))" />
        <circle cx="100" cy="115" r="1.5" fill="hsl(var(--muted-foreground))" />
        <circle cx="100" cy="135" r="1.5" fill="hsl(var(--muted-foreground))" />
        <circle cx="100" cy="155" r="1.5" fill="hsl(var(--muted-foreground))" />
        <circle cx="100" cy="175" r="1.5" fill="hsl(var(--muted-foreground))" />
        <circle cx="100" cy="190" r="1.5" fill="hsl(var(--muted-foreground))" />
      </g>
      
      <g className="muscles">
        <path 
          data-region="shoulders"
          data-testid="region-shoulders-back"
          d="M66 62 Q56 66 54 80 Q52 92 56 98 Q60 96 66 90 Q72 82 76 68 Q74 62 66 62 Z M134 62 Q144 66 146 80 Q148 92 144 98 Q140 96 134 90 Q128 82 124 68 Q126 62 134 62 Z"
          style={getMuscleStyle("shoulders")}
          onMouseEnter={() => handleMouseEnter("shoulders")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("shoulders")}
        />
        
        <path 
          data-region="upper-back"
          data-testid="region-upper-back"
          d="M78 64 Q76 72 74 86 Q72 100 76 118 Q80 126 92 130 L100 132 L108 130 Q120 126 124 118 Q128 100 126 86 Q124 72 122 64 Q112 58 100 56 Q88 58 78 64 Z"
          style={getMuscleStyle("upper-back")}
          onMouseEnter={() => handleMouseEnter("upper-back")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("upper-back")}
        />
        {isHighlighted("upper-back") && (
          <>
            <path d="M82 78 Q90 84 98 80 M102 80 Q110 84 118 78" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" fill="none" className="pointer-events-none" />
            <path d="M80 96 Q90 102 100 98 M100 98 Q110 102 120 96" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" fill="none" className="pointer-events-none" />
          </>
        )}
        
        <path 
          data-region="lats"
          data-testid="region-lats"
          d="M72 118 Q68 140 66 158 Q66 168 72 172 Q78 170 82 162 Q86 148 88 132 Q84 126 76 122 Z M128 118 Q132 140 134 158 Q134 168 128 172 Q122 170 118 162 Q114 148 112 132 Q116 126 124 122 Z"
          style={getMuscleStyle("lats")}
          onMouseEnter={() => handleMouseEnter("lats")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("lats")}
        />
        {isHighlighted("lats") && (
          <>
            <path d="M74 132 Q78 140 76 148 M126 132 Q122 140 124 148" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" fill="none" className="pointer-events-none" />
          </>
        )}
        
        <path 
          data-region="triceps"
          data-testid="region-triceps"
          d="M54 98 Q50 112 48 128 Q46 138 50 142 Q56 140 62 134 Q66 122 68 106 Q66 96 60 96 Z M146 98 Q150 112 152 128 Q154 138 150 142 Q144 140 138 134 Q134 122 132 106 Q134 96 140 96 Z"
          style={getMuscleStyle("triceps")}
          onMouseEnter={() => handleMouseEnter("triceps")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("triceps")}
        />
        {isHighlighted("triceps") && (
          <path d="M56 110 Q58 120 54 128 M144 110 Q142 120 146 128" stroke="white" strokeOpacity="0.1" strokeWidth="0.5" fill="none" className="pointer-events-none" />
        )}
        
        <path 
          data-region="glutes"
          data-testid="region-glutes"
          d="M78 196 Q74 210 76 224 Q78 236 88 242 Q96 246 100 244 Q104 246 112 242 Q122 236 124 224 Q126 210 122 196 Q114 200 100 202 Q86 200 78 196 Z"
          style={getMuscleStyle("glutes")}
          onMouseEnter={() => handleMouseEnter("glutes")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("glutes")}
        />
        {isHighlighted("glutes") && (
          <path d="M86 216 Q92 222 100 218 Q108 222 114 216" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" fill="none" className="pointer-events-none" />
        )}
        
        <path 
          data-region="hamstrings"
          data-testid="region-hamstrings"
          d="M80 248 Q76 270 74 295 Q74 310 80 318 Q88 322 96 316 L100 280 L100 250 Q92 246 82 246 Z M120 248 Q124 270 126 295 Q126 310 120 318 Q112 322 104 316 L100 280 L100 250 Q108 246 118 246 Z"
          style={getMuscleStyle("hamstrings")}
          onMouseEnter={() => handleMouseEnter("hamstrings")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("hamstrings")}
        />
        {isHighlighted("hamstrings") && (
          <>
            <path d="M84 268 Q88 278 84 288 M116 268 Q112 278 116 288" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" fill="none" className="pointer-events-none" />
          </>
        )}
        
        <path 
          data-region="calves"
          data-testid="region-calves-back"
          d="M78 322 Q76 338 74 355 Q74 362 80 364 Q88 366 92 360 Q94 344 96 330 Q92 320 84 320 Z M122 322 Q124 338 126 355 Q126 362 120 364 Q112 366 108 360 Q106 344 104 330 Q108 320 116 320 Z"
          style={getMuscleStyle("calves")}
          onMouseEnter={() => handleMouseEnter("calves")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("calves")}
        />
        {isHighlighted("calves") && (
          <path d="M82 340 Q86 346 82 352 M118 340 Q114 346 118 352" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" fill="none" className="pointer-events-none" />
        )}
      </g>
      
      <g className="labels pointer-events-none">
        {isHighlighted("shoulders") && (
          <>
            <line x1="60" y1="76" x2="26" y2="68" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="26" cy="68" r="1.2" fill="hsl(var(--primary))" />
            <text x="24" y="64" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">DELTS</text>
          </>
        )}
        {isHighlighted("upper-back") && (
          <>
            <line x1="88" y1="92" x2="18" y2="86" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="18" cy="86" r="1.2" fill="hsl(var(--primary))" />
            <text x="16" y="82" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">BACK</text>
          </>
        )}
        {isHighlighted("lats") && (
          <>
            <line x1="68" y1="148" x2="22" y2="145" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="22" cy="145" r="1.2" fill="hsl(var(--primary))" />
            <text x="20" y="141" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">LATS</text>
          </>
        )}
        {isHighlighted("triceps") && (
          <>
            <line x1="152" y1="118" x2="178" y2="108" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="178" cy="108" r="1.2" fill="hsl(var(--primary))" />
            <text x="180" y="104" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">TRICEPS</text>
          </>
        )}
        {isHighlighted("glutes") && (
          <>
            <line x1="122" y1="220" x2="170" y2="215" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="170" cy="215" r="1.2" fill="hsl(var(--primary))" />
            <text x="172" y="211" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">GLUTES</text>
          </>
        )}
        {isHighlighted("hamstrings") && (
          <>
            <line x1="76" y1="280" x2="30" y2="275" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="30" cy="275" r="1.2" fill="hsl(var(--primary))" />
            <text x="28" y="271" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">HAMS</text>
          </>
        )}
        {isHighlighted("calves") && (
          <>
            <line x1="122" y1="345" x2="162" y2="342" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.7" strokeDasharray="2 1.5" />
            <circle cx="162" cy="342" r="1.2" fill="hsl(var(--primary))" />
            <text x="164" y="338" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.5">CALVES</text>
          </>
        )}
      </g>

      {hoveredRegion && tooltipPositions[hoveredRegion] && (
        <Tooltip
          x={tooltipPositions[hoveredRegion].x}
          y={tooltipPositions[hoveredRegion].y}
          label={regionLabels[hoveredRegion] || hoveredRegion}
          visible={true}
        />
      )}
    </svg>
  );
}

export function BodyMap(props: BodyMapProps & { view?: "front" | "back" | "both" }) {
  const { view = "both", ...mapProps } = props;
  
  if (view === "front") return <BodyMapFront {...mapProps} />;
  if (view === "back") return <BodyMapBack {...mapProps} />;
  
  return (
    <div className="flex justify-center items-start gap-8 py-4">
      <div className="text-center">
        <p className="text-[10px] font-semibold text-foreground/50 mb-2 uppercase tracking-[0.25em]">Front</p>
        <BodyMapFront {...mapProps} />
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold text-foreground/50 mb-2 uppercase tracking-[0.25em]">Back</p>
        <BodyMapBack {...mapProps} />
      </div>
    </div>
  );
}
