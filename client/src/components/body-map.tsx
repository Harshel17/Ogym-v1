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
  
  const getMuscleStyle = (region: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      transformOrigin: "center"
    };
    
    if (isSelected(region)) {
      return {
        ...base,
        fill: "url(#selectedGradientFront)",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2.5,
        filter: "url(#glowFront)"
      };
    }
    if (isHighlighted(region)) {
      return {
        ...base,
        fill: "url(#highlightGradientFront)",
        stroke: "hsl(var(--primary) / 0.5)",
        strokeWidth: 1.5,
        filter: "url(#softGlowFront)"
      };
    }
    return {
      ...base,
      fill: "hsl(var(--muted) / 0.08)",
      stroke: "hsl(var(--muted-foreground) / 0.15)",
      strokeWidth: 0.8
    };
  };

  return (
    <svg viewBox="0 0 200 400" className={`w-full max-w-[200px] ${className}`}>
      <defs>
        <linearGradient id="highlightGradientFront" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="selectedGradientFront" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="bodyFillFront" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.12" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.04" />
        </radialGradient>
        <filter id="glowFront" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.4"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softGlowFront" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.2"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="bodyShadowFront" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08"/>
        </filter>
      </defs>
      
      <g className="body-outline" filter="url(#bodyShadowFront)">
        <ellipse cx="100" cy="32" rx="24" ry="28" fill="url(#bodyFillFront)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1" />
        <path d="M76 60 L62 72 L54 130 L66 135 L78 85 L78 60 Z" fill="url(#bodyFillFront)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1" />
        <path d="M124 60 L138 72 L146 130 L134 135 L122 85 L122 60 Z" fill="url(#bodyFillFront)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1" />
        <path d="M80 202 L76 278 L70 358 L88 362 L98 280 L100 238 L102 280 L112 362 L130 358 L124 278 L120 202 Z" 
              fill="url(#bodyFillFront)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1" />
      </g>
      
      <g className="muscles" onClick={(e) => {
        const target = e.target as SVGElement;
        const region = target.getAttribute('data-region');
        if (region && onMuscleClick) onMuscleClick(region);
      }}>
        <path 
          data-region="shoulders"
          data-testid="region-shoulders-front"
          d="M66 64 L56 75 L58 96 L74 86 L78 66 Z M134 64 L144 75 L142 96 L126 86 L122 66 Z"
          style={getMuscleStyle("shoulders")}
        />
        
        <path 
          data-region="chest"
          data-testid="region-chest"
          d="M78 66 L72 86 L78 112 L100 118 L122 112 L128 86 L122 66 L100 58 Z"
          style={getMuscleStyle("chest")}
        />
        
        <path 
          data-region="biceps"
          data-testid="region-biceps"
          d="M56 96 L50 130 L62 136 L72 100 Z M144 96 L150 130 L138 136 L128 100 Z"
          style={getMuscleStyle("biceps")}
        />
        
        <path 
          data-region="forearms"
          data-testid="region-forearms"
          d="M50 130 L44 172 L56 178 L62 136 Z M150 130 L156 172 L144 178 L138 136 Z"
          style={getMuscleStyle("forearms")}
        />
        
        <path 
          data-region="abs"
          data-testid="region-abs"
          d="M84 118 L80 158 L84 200 L100 206 L116 200 L120 158 L116 118 L100 122 Z"
          style={getMuscleStyle("abs")}
        />
        
        <path 
          data-region="obliques"
          data-testid="region-obliques"
          d="M74 112 L80 118 L80 158 L76 200 L70 194 L72 154 Z M126 112 L120 118 L120 158 L124 200 L130 194 L128 154 Z"
          style={getMuscleStyle("obliques")}
        />
        
        <path 
          data-region="quads"
          data-testid="region-quads"
          d="M80 208 L76 262 L82 315 L98 320 L100 262 L100 212 Z M120 208 L124 262 L118 315 L102 320 L100 262 L100 212 Z"
          style={getMuscleStyle("quads")}
        />
        
        <path 
          data-region="calves"
          data-testid="region-calves-front"
          d="M78 322 L74 358 L90 362 L94 328 Z M122 322 L126 358 L110 362 L106 328 Z"
          style={getMuscleStyle("calves")}
        />
      </g>
      
      <g className="labels pointer-events-none">
        {isHighlighted("chest") && (
          <text x="100" y="92" textAnchor="middle" className="fill-primary-foreground text-[8px] font-bold" style={{textShadow: '0 1px 2px rgba(0,0,0,0.3)'}}>CHEST</text>
        )}
        {isHighlighted("abs") && (
          <text x="100" y="165" textAnchor="middle" className="fill-primary-foreground text-[8px] font-bold" style={{textShadow: '0 1px 2px rgba(0,0,0,0.3)'}}>ABS</text>
        )}
        {isHighlighted("quads") && (
          <text x="100" y="268" textAnchor="middle" className="fill-primary-foreground text-[8px] font-bold" style={{textShadow: '0 1px 2px rgba(0,0,0,0.3)'}}>QUADS</text>
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
  
  const getMuscleStyle = (region: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      cursor: "pointer",
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      transformOrigin: "center"
    };
    
    if (isSelected(region)) {
      return {
        ...base,
        fill: "url(#selectedGradientBack)",
        stroke: "hsl(var(--primary))",
        strokeWidth: 2.5,
        filter: "url(#glowBack)"
      };
    }
    if (isHighlighted(region)) {
      return {
        ...base,
        fill: "url(#highlightGradientBack)",
        stroke: "hsl(var(--primary) / 0.5)",
        strokeWidth: 1.5,
        filter: "url(#softGlowBack)"
      };
    }
    return {
      ...base,
      fill: "hsl(var(--muted) / 0.08)",
      stroke: "hsl(var(--muted-foreground) / 0.15)",
      strokeWidth: 0.8
    };
  };

  return (
    <svg viewBox="0 0 200 400" className={`w-full max-w-[200px] ${className}`}>
      <defs>
        <linearGradient id="highlightGradientBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="selectedGradientBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.95" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
        </linearGradient>
        <radialGradient id="bodyFillBack" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.12" />
          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.04" />
        </radialGradient>
        <filter id="glowBack" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.4"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="softGlowBack" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.2"/>
          <feComposite in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="bodyShadowBack" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08"/>
        </filter>
      </defs>
      
      <g className="body-outline" filter="url(#bodyShadowBack)">
        <ellipse cx="100" cy="32" rx="24" ry="28" fill="url(#bodyFillBack)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1" />
        <path d="M76 60 L62 72 L54 130 L66 135 L78 85 L78 60 Z" fill="url(#bodyFillBack)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1" />
        <path d="M124 60 L138 72 L146 130 L134 135 L122 85 L122 60 Z" fill="url(#bodyFillBack)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1" />
        <path d="M80 202 L76 278 L70 358 L88 362 L98 280 L100 238 L102 280 L112 362 L130 358 L124 278 L120 202 Z" 
              fill="url(#bodyFillBack)" stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="1" />
      </g>
      
      <g className="muscles" onClick={(e) => {
        const target = e.target as SVGElement;
        const region = target.getAttribute('data-region');
        if (region && onMuscleClick) onMuscleClick(region);
      }}>
        <path 
          data-region="shoulders"
          data-testid="region-shoulders-back"
          d="M66 64 L56 75 L58 96 L74 86 L78 66 Z M134 64 L144 75 L142 96 L126 86 L122 66 Z"
          style={getMuscleStyle("shoulders")}
        />
        
        <path 
          data-region="upper-back"
          data-testid="region-upper-back"
          d="M78 66 L72 86 L78 122 L100 128 L122 122 L128 86 L122 66 L100 58 Z"
          style={getMuscleStyle("upper-back")}
        />
        
        <path 
          data-region="lats"
          data-testid="region-lats"
          d="M72 122 L68 164 L80 174 L86 132 Z M128 122 L132 164 L120 174 L114 132 Z"
          style={getMuscleStyle("lats")}
        />
        
        <path 
          data-region="triceps"
          data-testid="region-triceps"
          d="M56 96 L50 130 L62 136 L72 100 Z M144 96 L150 130 L138 136 L128 100 Z"
          style={getMuscleStyle("triceps")}
        />
        
        <path 
          data-region="glutes"
          data-testid="region-glutes"
          d="M80 196 L74 222 L86 240 L100 244 L114 240 L126 222 L120 196 L100 202 Z"
          style={getMuscleStyle("glutes")}
        />
        
        <path 
          data-region="hamstrings"
          data-testid="region-hamstrings"
          d="M80 246 L74 305 L92 318 L100 274 Z M120 246 L126 305 L108 318 L100 274 Z"
          style={getMuscleStyle("hamstrings")}
        />
        
        <path 
          data-region="calves"
          data-testid="region-calves-back"
          d="M78 322 L74 358 L90 362 L94 328 Z M122 322 L126 358 L110 362 L106 328 Z"
          style={getMuscleStyle("calves")}
        />
      </g>
      
      <g className="labels pointer-events-none">
        {isHighlighted("upper-back") && (
          <text x="100" y="98" textAnchor="middle" className="fill-primary-foreground text-[8px] font-bold" style={{textShadow: '0 1px 2px rgba(0,0,0,0.3)'}}>BACK</text>
        )}
        {isHighlighted("glutes") && (
          <text x="100" y="222" textAnchor="middle" className="fill-primary-foreground text-[8px] font-bold" style={{textShadow: '0 1px 2px rgba(0,0,0,0.3)'}}>GLUTES</text>
        )}
        {isHighlighted("hamstrings") && (
          <text x="100" y="285" textAnchor="middle" className="fill-primary-foreground text-[8px] font-bold" style={{textShadow: '0 1px 2px rgba(0,0,0,0.3)'}}>HAMSTRINGS</text>
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
    <div className="flex justify-center items-start gap-8 py-4">
      <div className="text-center">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-widest">Front</p>
        <BodyMapFront {...mapProps} />
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-widest">Back</p>
        <BodyMapBack {...mapProps} />
      </div>
    </div>
  );
}
