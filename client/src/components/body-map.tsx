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

export function BodyMapFront({ 
  highlightedMuscles, 
  onMuscleClick, 
  selectedMuscle,
  className = "" 
}: BodyMapProps) {
  const isHighlighted = (region: string) => highlightedMuscles.includes(region);
  const isSelected = (region: string) => selectedMuscle === region;
  
  const getMuscleStyle = (region: string) => {
    if (isSelected(region)) {
      return {
        fill: "url(#selectedGradient)",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
        filter: "url(#glow)",
        cursor: "pointer",
        transition: "all 0.3s ease"
      };
    }
    if (isHighlighted(region)) {
      return {
        fill: "url(#highlightGradient)",
        stroke: "hsl(var(--primary) / 0.7)",
        strokeWidth: 1.5,
        cursor: "pointer",
        transition: "all 0.3s ease"
      };
    }
    return {
      fill: "hsl(var(--muted) / 0.15)",
      stroke: "hsl(var(--muted-foreground) / 0.2)",
      strokeWidth: 1,
      cursor: "pointer",
      transition: "all 0.3s ease"
    };
  };

  return (
    <svg viewBox="0 0 200 400" className={`w-full max-w-[160px] ${className}`}>
      <defs>
        <linearGradient id="highlightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="selectedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.08" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15"/>
        </filter>
      </defs>
      
      <g className="body-outline" filter="url(#softShadow)">
        <ellipse cx="100" cy="32" rx="22" ry="26" fill="url(#bodyGradient)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1" />
        <path d="M78 58 L65 68 L58 125 L68 130 L78 88 L78 58 Z" fill="url(#bodyGradient)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1" />
        <path d="M122 58 L135 68 L142 125 L132 130 L122 88 L122 58 Z" fill="url(#bodyGradient)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1" />
        <path d="M82 200 L78 275 L72 355 L88 358 L96 278 L100 235 L104 278 L112 358 L128 355 L122 275 L118 200 Z" 
              fill="url(#bodyGradient)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1" />
      </g>
      
      <g className="muscles" onClick={(e) => {
        const target = e.target as SVGElement;
        const region = target.getAttribute('data-region');
        if (region && onMuscleClick) onMuscleClick(region);
      }}>
        <path 
          data-region="shoulders"
          data-testid="region-shoulders-front"
          d="M68 62 L58 72 L60 92 L74 84 L78 64 Z M132 62 L142 72 L140 92 L126 84 L122 64 Z"
          style={getMuscleStyle("shoulders")}
        />
        
        <path 
          data-region="chest"
          data-testid="region-chest"
          d="M78 64 L74 82 L78 108 L100 114 L122 108 L126 82 L122 64 L100 58 Z"
          style={getMuscleStyle("chest")}
        />
        
        <path 
          data-region="biceps"
          data-testid="region-biceps"
          d="M58 92 L52 125 L62 130 L70 96 Z M142 92 L148 125 L138 130 L130 96 Z"
          style={getMuscleStyle("biceps")}
        />
        
        <path 
          data-region="forearms"
          data-testid="region-forearms"
          d="M52 125 L46 168 L56 172 L62 130 Z M148 125 L154 168 L144 172 L138 130 Z"
          style={getMuscleStyle("forearms")}
        />
        
        <path 
          data-region="abs"
          data-testid="region-abs"
          d="M86 114 L82 155 L86 198 L100 202 L114 198 L118 155 L114 114 L100 118 Z"
          style={getMuscleStyle("abs")}
        />
        
        <path 
          data-region="obliques"
          data-testid="region-obliques"
          d="M76 108 L82 114 L82 155 L78 198 L72 192 L74 152 Z M124 108 L118 114 L118 155 L122 198 L128 192 L126 152 Z"
          style={getMuscleStyle("obliques")}
        />
        
        <path 
          data-region="quads"
          data-testid="region-quads"
          d="M82 204 L78 258 L82 308 L96 312 L100 258 L100 208 Z M118 204 L122 258 L118 308 L104 312 L100 258 L100 208 Z"
          style={getMuscleStyle("quads")}
        />
        
        <path 
          data-region="calves"
          data-testid="region-calves-front"
          d="M80 316 L76 354 L90 358 L92 322 Z M120 316 L124 354 L110 358 L108 322 Z"
          style={getMuscleStyle("calves")}
        />
      </g>
      
      <g className="labels pointer-events-none">
        {isHighlighted("chest") && (
          <text x="100" y="90" textAnchor="middle" className="fill-primary-foreground text-[7px] font-semibold drop-shadow-sm">Chest</text>
        )}
        {isHighlighted("abs") && (
          <text x="100" y="162" textAnchor="middle" className="fill-primary-foreground text-[7px] font-semibold drop-shadow-sm">Abs</text>
        )}
        {isHighlighted("quads") && (
          <text x="100" y="262" textAnchor="middle" className="fill-primary-foreground text-[7px] font-semibold drop-shadow-sm">Quads</text>
        )}
      </g>
    </svg>
  );
}

export function BodyMapBack({ 
  highlightedMuscles, 
  onMuscleClick, 
  selectedMuscle,
  className = "" 
}: BodyMapProps) {
  const isHighlighted = (region: string) => highlightedMuscles.includes(region);
  const isSelected = (region: string) => selectedMuscle === region;
  
  const getMuscleStyle = (region: string) => {
    if (isSelected(region)) {
      return {
        fill: "url(#selectedGradientBack)",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2,
        filter: "url(#glowBack)",
        cursor: "pointer",
        transition: "all 0.3s ease"
      };
    }
    if (isHighlighted(region)) {
      return {
        fill: "url(#highlightGradientBack)",
        stroke: "hsl(var(--primary) / 0.7)",
        strokeWidth: 1.5,
        cursor: "pointer",
        transition: "all 0.3s ease"
      };
    }
    return {
      fill: "hsl(var(--muted) / 0.15)",
      stroke: "hsl(var(--muted-foreground) / 0.2)",
      strokeWidth: 1,
      cursor: "pointer",
      transition: "all 0.3s ease"
    };
  };

  return (
    <svg viewBox="0 0 200 400" className={`w-full max-w-[160px] ${className}`}>
      <defs>
        <linearGradient id="highlightGradientBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="selectedGradientBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="bodyGradientBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.08" />
        </linearGradient>
        <filter id="glowBack" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softShadowBack" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15"/>
        </filter>
      </defs>
      
      <g className="body-outline" filter="url(#softShadowBack)">
        <ellipse cx="100" cy="32" rx="22" ry="26" fill="url(#bodyGradientBack)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1" />
        <path d="M78 58 L65 68 L58 125 L68 130 L78 88 L78 58 Z" fill="url(#bodyGradientBack)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1" />
        <path d="M122 58 L135 68 L142 125 L132 130 L122 88 L122 58 Z" fill="url(#bodyGradientBack)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1" />
        <path d="M82 200 L78 275 L72 355 L88 358 L96 278 L100 235 L104 278 L112 358 L128 355 L122 275 L118 200 Z" 
              fill="url(#bodyGradientBack)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="1" />
      </g>
      
      <g className="muscles" onClick={(e) => {
        const target = e.target as SVGElement;
        const region = target.getAttribute('data-region');
        if (region && onMuscleClick) onMuscleClick(region);
      }}>
        <path 
          data-region="shoulders"
          data-testid="region-shoulders-back"
          d="M68 62 L58 72 L60 92 L74 84 L78 64 Z M132 62 L142 72 L140 92 L126 84 L122 64 Z"
          style={getMuscleStyle("shoulders")}
        />
        
        <path 
          data-region="upper-back"
          data-testid="region-upper-back"
          d="M78 64 L74 82 L78 118 L100 124 L122 118 L126 82 L122 64 L100 58 Z"
          style={getMuscleStyle("upper-back")}
        />
        
        <path 
          data-region="lats"
          data-testid="region-lats"
          d="M74 118 L70 158 L80 168 L84 128 Z M126 118 L130 158 L120 168 L116 128 Z"
          style={getMuscleStyle("lats")}
        />
        
        <path 
          data-region="triceps"
          data-testid="region-triceps"
          d="M58 92 L52 125 L62 130 L70 96 Z M142 92 L148 125 L138 130 L130 96 Z"
          style={getMuscleStyle("triceps")}
        />
        
        <path 
          data-region="glutes"
          data-testid="region-glutes"
          d="M82 194 L76 218 L86 234 L100 238 L114 234 L124 218 L118 194 L100 198 Z"
          style={getMuscleStyle("glutes")}
        />
        
        <path 
          data-region="hamstrings"
          data-testid="region-hamstrings"
          d="M82 240 L76 298 L92 308 L100 268 Z M118 240 L124 298 L108 308 L100 268 Z"
          style={getMuscleStyle("hamstrings")}
        />
        
        <path 
          data-region="calves"
          data-testid="region-calves-back"
          d="M80 314 L76 354 L90 358 L92 318 Z M120 314 L124 354 L110 358 L108 318 Z"
          style={getMuscleStyle("calves")}
        />
      </g>
      
      <g className="labels pointer-events-none">
        {isHighlighted("upper-back") && (
          <text x="100" y="95" textAnchor="middle" className="fill-primary-foreground text-[7px] font-semibold drop-shadow-sm">Back</text>
        )}
        {isHighlighted("glutes") && (
          <text x="100" y="218" textAnchor="middle" className="fill-primary-foreground text-[7px] font-semibold drop-shadow-sm">Glutes</text>
        )}
        {isHighlighted("hamstrings") && (
          <text x="100" y="278" textAnchor="middle" className="fill-primary-foreground text-[7px] font-semibold drop-shadow-sm">Hamstrings</text>
        )}
      </g>
    </svg>
  );
}

export function BodyMap(props: BodyMapProps & { view?: "front" | "back" | "both" }) {
  const { view = "both", ...mapProps } = props;
  
  if (view === "front") return <BodyMapFront {...mapProps} />;
  if (view === "back") return <BodyMapBack {...mapProps} />;
  
  return (
    <div className="flex justify-center items-start gap-6">
      <div className="text-center">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Front</p>
        <BodyMapFront {...mapProps} />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Back</p>
        <BodyMapBack {...mapProps} />
      </div>
    </div>
  );
}
