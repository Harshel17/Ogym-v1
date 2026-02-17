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
      transition: "all 0.3s ease",
    };
    
    if (isSelected(region)) {
      return {
        ...base,
        fill: "url(#selectedGradF)",
        stroke: "hsl(var(--primary))",
        strokeWidth: 1.5,
        filter: "url(#glowF)",
      };
    }
    if (isHighlighted(region)) {
      return {
        ...base,
        fill: "url(#highlightGradF)",
        stroke: "hsl(var(--primary) / 0.6)",
        strokeWidth: 1,
        filter: isHovered(region) ? "url(#glowF)" : "url(#softGlowF)",
      };
    }
    return {
      ...base,
      fill: "url(#skinGradF)",
      stroke: "hsl(var(--muted-foreground) / 0.2)",
      strokeWidth: 0.5,
      opacity: isHovered(region) ? 0.9 : 1,
    };
  };

  const handleMouseEnter = useCallback((region: string) => setHoveredRegion(region), []);
  const handleMouseLeave = useCallback(() => setHoveredRegion(null), []);

  const tooltipPositions: Record<string, { x: number; y: number }> = {
    shoulders: { x: 100, y: 58 },
    chest: { x: 100, y: 78 },
    biceps: { x: 42, y: 105 },
    forearms: { x: 40, y: 145 },
    abs: { x: 100, y: 145 },
    obliques: { x: 65, y: 155 },
    quads: { x: 100, y: 230 },
    calves: { x: 100, y: 310 },
  };

  return (
    <svg viewBox="0 0 200 390" className={`w-full max-w-[180px] ${className}`}>
      <defs>
        <linearGradient id="highlightGradF" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="selectedGradF" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="skinGradF" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id="bodyGradF" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15" />
        </radialGradient>
        <filter id="glowF" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.4"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softGlowF" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.15"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <g className="body-outline" opacity="1">
        <ellipse data-testid="head-front" cx="100" cy="28" rx="18" ry="22" fill="url(#bodyGradF)" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="0.8" />
        <line x1="100" y1="50" x2="100" y2="56" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="3" />
        <path d="M68 60 Q60 62 54 72 Q48 88 46 108 Q44 128 46 148 Q48 158 52 162
                 M132 60 Q140 62 146 72 Q152 88 154 108 Q156 128 154 148 Q152 158 148 162" 
              fill="none" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="0.6" />
        <path d="M46 162 Q42 175 42 185
                 M154 162 Q158 175 158 185"
              fill="none" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="0.6" />
        <path d="M76 58 L124 58 Q130 62 134 75 Q136 100 136 130 Q136 155 132 180 Q130 200 128 210
                 Q126 230 122 248 Q120 260 120 280 Q120 300 122 320 Q124 340 126 358 L114 362
                 Q108 330 104 310 L100 290 L96 310 Q92 330 86 362 L74 358
                 Q76 340 78 320 Q80 300 80 280 Q80 260 78 248 Q74 230 72 210
                 Q70 200 68 180 Q64 155 64 130 Q64 100 66 75 Q70 62 76 58 Z"
              fill="url(#bodyGradF)" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="0.8" />
      </g>
      
      <g className="muscles">
        <path 
          data-region="shoulders"
          data-testid="region-shoulders-front"
          d="M68 60 Q62 64 58 74 Q54 86 56 96 Q60 94 66 86 Q72 76 76 66 Q74 60 68 60 Z
             M132 60 Q138 64 142 74 Q146 86 144 96 Q140 94 134 86 Q128 76 124 66 Q126 60 132 60 Z"
          style={getMuscleStyle("shoulders")}
          onMouseEnter={() => handleMouseEnter("shoulders")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("shoulders")}
        />
        
        <path 
          data-region="chest"
          data-testid="region-chest"
          d="M78 62 Q74 70 72 82 Q70 96 74 108 Q80 114 90 116 L100 118 L110 116 Q120 114 126 108 Q130 96 128 82 Q126 70 122 62 Q112 58 100 56 Q88 58 78 62 Z"
          style={getMuscleStyle("chest")}
          onMouseEnter={() => handleMouseEnter("chest")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("chest")}
        />
        
        <path 
          data-region="biceps"
          data-testid="region-biceps"
          d="M54 96 Q50 108 48 122 Q46 132 50 136 Q56 134 62 126 Q66 116 68 102 Q66 94 60 94 Z
             M146 96 Q150 108 152 122 Q154 132 150 136 Q144 134 138 126 Q134 116 132 102 Q134 94 140 94 Z"
          style={getMuscleStyle("biceps")}
          onMouseEnter={() => handleMouseEnter("biceps")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("biceps")}
        />
        
        <path 
          data-region="forearms"
          data-testid="region-forearms"
          d="M48 136 Q44 150 42 164 Q42 172 46 176 Q52 174 56 166 Q60 154 62 138 Q58 134 52 134 Z
             M152 136 Q156 150 158 164 Q158 172 154 176 Q148 174 144 166 Q140 154 138 138 Q142 134 148 134 Z"
          style={getMuscleStyle("forearms")}
          onMouseEnter={() => handleMouseEnter("forearms")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("forearms")}
        />
        
        <path 
          data-region="abs"
          data-testid="region-abs"
          d="M88 118 Q86 132 84 148 Q82 165 84 182 Q86 190 94 194 L100 196 L106 194 Q114 190 116 182 Q118 165 116 148 Q114 132 112 118 Q106 116 100 118 Q94 116 88 118 Z"
          style={getMuscleStyle("abs")}
          onMouseEnter={() => handleMouseEnter("abs")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("abs")}
        />
        
        <path 
          data-region="obliques"
          data-testid="region-obliques"
          d="M74 110 Q70 130 68 150 Q66 170 68 188 Q72 194 80 196 Q84 190 84 182 Q82 165 84 148 Q86 132 88 118 Q84 112 78 110 Z
             M126 110 Q130 130 132 150 Q134 170 132 188 Q128 194 120 196 Q116 190 116 182 Q118 165 116 148 Q114 132 112 118 Q116 112 122 110 Z"
          style={getMuscleStyle("obliques")}
          onMouseEnter={() => handleMouseEnter("obliques")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("obliques")}
        />
        
        <path 
          data-region="quads"
          data-testid="region-quads"
          d="M78 210 Q74 235 72 260 Q72 280 78 298 Q84 306 92 302 Q96 290 98 270 L100 248 L100 212 Q92 206 82 208 Z
             M122 210 Q126 235 128 260 Q128 280 122 298 Q116 306 108 302 Q104 290 102 270 L100 248 L100 212 Q108 206 118 208 Z"
          style={getMuscleStyle("quads")}
          onMouseEnter={() => handleMouseEnter("quads")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("quads")}
        />
        
        <path 
          data-region="calves"
          data-testid="region-calves"
          d="M78 310 Q76 326 74 342 Q74 350 80 354 Q86 356 90 350 Q92 338 94 322 Q90 310 84 308 Z
             M122 310 Q124 326 126 342 Q126 350 120 354 Q114 356 110 350 Q108 338 106 322 Q110 310 116 308 Z"
          style={getMuscleStyle("calves")}
          onMouseEnter={() => handleMouseEnter("calves")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("calves")}
        />
      </g>

      <g className="labels pointer-events-none">
        {isHighlighted("shoulders") && (
          <>
            <line x1="60" y1="74" x2="28" y2="66" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="28" cy="66" r="1.2" fill="hsl(var(--primary))" />
            <text x="26" y="62" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">DELTS</text>
          </>
        )}
        {isHighlighted("chest") && (
          <>
            <line x1="126" y1="85" x2="170" y2="78" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="170" cy="78" r="1.2" fill="hsl(var(--primary))" />
            <text x="172" y="74" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">CHEST</text>
          </>
        )}
        {isHighlighted("biceps") && (
          <>
            <line x1="148" y1="115" x2="172" y2="108" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="172" cy="108" r="1.2" fill="hsl(var(--primary))" />
            <text x="174" y="104" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">BICEPS</text>
          </>
        )}
        {isHighlighted("abs") && (
          <>
            <line x1="114" y1="155" x2="168" y2="150" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="168" cy="150" r="1.2" fill="hsl(var(--primary))" />
            <text x="170" y="146" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">ABS</text>
          </>
        )}
        {isHighlighted("obliques") && (
          <>
            <line x1="68" y1="150" x2="26" y2="148" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="26" cy="148" r="1.2" fill="hsl(var(--primary))" />
            <text x="24" y="144" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">OBLIQUES</text>
          </>
        )}
        {isHighlighted("quads") && (
          <>
            <line x1="126" y1="255" x2="162" y2="250" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="162" cy="250" r="1.2" fill="hsl(var(--primary))" />
            <text x="164" y="246" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">QUADS</text>
          </>
        )}
        {isHighlighted("calves") && (
          <>
            <line x1="76" y1="338" x2="40" y2="336" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="40" cy="336" r="1.2" fill="hsl(var(--primary))" />
            <text x="38" y="332" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">CALVES</text>
          </>
        )}
        {isHighlighted("forearms") && (
          <>
            <line x1="46" y1="155" x2="24" y2="170" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="24" cy="170" r="1.2" fill="hsl(var(--primary))" />
            <text x="22" y="166" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">FOREARMS</text>
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
      transition: "all 0.3s ease",
    };
    
    if (isSelected(region)) {
      return {
        ...base,
        fill: "url(#selectedGradB)",
        stroke: "hsl(var(--primary))",
        strokeWidth: 1.5,
        filter: "url(#glowB)",
      };
    }
    if (isHighlighted(region)) {
      return {
        ...base,
        fill: "url(#highlightGradB)",
        stroke: "hsl(var(--primary) / 0.6)",
        strokeWidth: 1,
        filter: isHovered(region) ? "url(#glowB)" : "url(#softGlowB)",
      };
    }
    return {
      ...base,
      fill: "url(#skinGradB)",
      stroke: "hsl(var(--muted-foreground) / 0.2)",
      strokeWidth: 0.5,
      opacity: isHovered(region) ? 0.9 : 1,
    };
  };

  const handleMouseEnter = useCallback((region: string) => setHoveredRegion(region), []);
  const handleMouseLeave = useCallback(() => setHoveredRegion(null), []);

  const tooltipPositions: Record<string, { x: number; y: number }> = {
    shoulders: { x: 100, y: 58 },
    "upper-back": { x: 100, y: 78 },
    lats: { x: 68, y: 135 },
    triceps: { x: 42, y: 105 },
    glutes: { x: 100, y: 198 },
    hamstrings: { x: 100, y: 248 },
    calves: { x: 100, y: 310 },
  };

  return (
    <svg viewBox="0 0 200 390" className={`w-full max-w-[180px] ${className}`}>
      <defs>
        <linearGradient id="highlightGradB" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="selectedGradB" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id="skinGradB" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.12" />
        </radialGradient>
        <radialGradient id="bodyGradB" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15" />
        </radialGradient>
        <filter id="glowB" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.4"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softGlowB" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.15"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <g className="body-outline" opacity="1">
        <ellipse data-testid="head-back" cx="100" cy="28" rx="18" ry="22" fill="url(#bodyGradB)" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="0.8" />
        <line x1="100" y1="50" x2="100" y2="56" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="3" />
        <path d="M68 60 Q60 62 54 72 Q48 88 46 108 Q44 128 46 148 Q48 158 52 162
                 M132 60 Q140 62 146 72 Q152 88 154 108 Q156 128 154 148 Q152 158 148 162" 
              fill="none" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="0.6" />
        <path d="M46 162 Q42 175 42 185
                 M154 162 Q158 175 158 185"
              fill="none" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="0.6" />
        <path d="M76 58 L124 58 Q130 62 134 75 Q136 100 136 130 Q136 155 132 180 Q130 200 128 210
                 Q126 230 122 248 Q120 260 120 280 Q120 300 122 320 Q124 340 126 358 L114 362
                 Q108 330 104 310 L100 290 L96 310 Q92 330 86 362 L74 358
                 Q76 340 78 320 Q80 300 80 280 Q80 260 78 248 Q74 230 72 210
                 Q70 200 68 180 Q64 155 64 130 Q64 100 66 75 Q70 62 76 58 Z"
              fill="url(#bodyGradB)" stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="0.8" />
      </g>

      <g className="spine pointer-events-none" opacity="0.2">
        <path d="M100 50 L100 195" stroke="hsl(var(--muted-foreground))" strokeWidth="1" fill="none" strokeDasharray="3 2" />
        {[58, 72, 86, 100, 114, 128, 142, 156, 170, 184].map(y => (
          <circle key={y} cx={100} cy={y} r={1.2} fill="hsl(var(--muted-foreground))" />
        ))}
      </g>
      
      <g className="muscles">
        <path 
          data-region="shoulders"
          data-testid="region-shoulders-back"
          d="M68 60 Q62 64 58 74 Q54 86 56 96 Q60 94 66 86 Q72 76 76 66 Q74 60 68 60 Z
             M132 60 Q138 64 142 74 Q146 86 144 96 Q140 94 134 86 Q128 76 124 66 Q126 60 132 60 Z"
          style={getMuscleStyle("shoulders")}
          onMouseEnter={() => handleMouseEnter("shoulders")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("shoulders")}
        />
        
        <path 
          data-region="upper-back"
          data-testid="region-upper-back"
          d="M78 62 Q74 70 72 82 Q70 96 74 108 Q80 114 90 116 L100 118 L110 116 Q120 114 126 108 Q130 96 128 82 Q126 70 122 62 Q112 58 100 56 Q88 58 78 62 Z"
          style={getMuscleStyle("upper-back")}
          onMouseEnter={() => handleMouseEnter("upper-back")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("upper-back")}
        />
        
        <path 
          data-region="lats"
          data-testid="region-lats"
          d="M70 110 Q66 128 64 148 Q64 158 70 164 Q76 162 80 154 Q84 140 86 122 Q82 116 74 112 Z
             M130 110 Q134 128 136 148 Q136 158 130 164 Q124 162 120 154 Q116 140 114 122 Q118 116 126 112 Z"
          style={getMuscleStyle("lats")}
          onMouseEnter={() => handleMouseEnter("lats")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("lats")}
        />
        
        <path 
          data-region="triceps"
          data-testid="region-triceps"
          d="M54 96 Q50 108 48 122 Q46 132 50 136 Q56 134 62 126 Q66 116 68 102 Q66 94 60 94 Z
             M146 96 Q150 108 152 122 Q154 132 150 136 Q144 134 138 126 Q134 116 132 102 Q134 94 140 94 Z"
          style={getMuscleStyle("triceps")}
          onMouseEnter={() => handleMouseEnter("triceps")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("triceps")}
        />
        
        <path 
          data-region="glutes"
          data-testid="region-glutes"
          d="M78 192 Q74 206 76 218 Q78 228 88 234 Q96 238 100 236 Q104 238 112 234 Q122 228 124 218 Q126 206 122 192 Q114 196 100 198 Q86 196 78 192 Z"
          style={getMuscleStyle("glutes")}
          onMouseEnter={() => handleMouseEnter("glutes")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("glutes")}
        />
        
        <path 
          data-region="hamstrings"
          data-testid="region-hamstrings"
          d="M80 238 Q76 258 74 280 Q74 296 80 306 Q88 312 94 304 L98 270 L100 244 Q92 238 82 238 Z
             M120 238 Q124 258 126 280 Q126 296 120 306 Q112 312 106 304 L102 270 L100 244 Q108 238 118 238 Z"
          style={getMuscleStyle("hamstrings")}
          onMouseEnter={() => handleMouseEnter("hamstrings")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("hamstrings")}
        />
        
        <path 
          data-region="calves"
          data-testid="region-calves-back"
          d="M78 310 Q76 326 74 342 Q74 350 80 354 Q86 356 90 350 Q92 338 94 322 Q90 310 84 308 Z
             M122 310 Q124 326 126 342 Q126 350 120 354 Q114 356 110 350 Q108 338 106 322 Q110 310 116 308 Z"
          style={getMuscleStyle("calves")}
          onMouseEnter={() => handleMouseEnter("calves")}
          onMouseLeave={handleMouseLeave}
          onClick={() => onMuscleClick?.("calves")}
        />
      </g>

      <g className="labels pointer-events-none">
        {isHighlighted("shoulders") && (
          <>
            <line x1="60" y1="74" x2="28" y2="66" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="28" cy="66" r="1.2" fill="hsl(var(--primary))" />
            <text x="26" y="62" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">DELTS</text>
          </>
        )}
        {isHighlighted("upper-back") && (
          <>
            <line x1="126" y1="85" x2="170" y2="78" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="170" cy="78" r="1.2" fill="hsl(var(--primary))" />
            <text x="172" y="74" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">BACK</text>
          </>
        )}
        {isHighlighted("lats") && (
          <>
            <line x1="66" y1="140" x2="26" y2="138" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="26" cy="138" r="1.2" fill="hsl(var(--primary))" />
            <text x="24" y="134" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">LATS</text>
          </>
        )}
        {isHighlighted("triceps") && (
          <>
            <line x1="148" y1="115" x2="172" y2="108" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="172" cy="108" r="1.2" fill="hsl(var(--primary))" />
            <text x="174" y="104" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">TRICEPS</text>
          </>
        )}
        {isHighlighted("glutes") && (
          <>
            <line x1="122" y1="215" x2="164" y2="210" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="164" cy="210" r="1.2" fill="hsl(var(--primary))" />
            <text x="166" y="206" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">GLUTES</text>
          </>
        )}
        {isHighlighted("hamstrings") && (
          <>
            <line x1="76" y1="270" x2="32" y2="266" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="32" cy="266" r="1.2" fill="hsl(var(--primary))" />
            <text x="30" y="262" textAnchor="end" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">HAMS</text>
          </>
        )}
        {isHighlighted("calves") && (
          <>
            <line x1="124" y1="338" x2="158" y2="336" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.6" strokeDasharray="2 1.5" />
            <circle cx="158" cy="336" r="1.2" fill="hsl(var(--primary))" />
            <text x="160" y="332" textAnchor="start" fill="hsl(var(--primary))" fontSize="7" fontWeight="600" fontFamily="system-ui" letterSpacing="0.3">CALVES</text>
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
    <div className="flex justify-center items-start gap-6 py-4">
      <div className="text-center">
        <p className="text-[10px] font-semibold text-foreground/50 mb-2 uppercase tracking-[0.2em]">Front</p>
        <BodyMapFront {...mapProps} />
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold text-foreground/50 mb-2 uppercase tracking-[0.2em]">Back</p>
        <BodyMapBack {...mapProps} />
      </div>
    </div>
  );
}
