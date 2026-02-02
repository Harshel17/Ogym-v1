import { useState } from "react";

interface BodyMapProps {
  highlightedMuscles: string[];
  onMuscleClick?: (muscle: string) => void;
  selectedMuscle?: string | null;
  className?: string;
}

export const muscleToRegions: Record<string, string[]> = {
  "Chest": ["chest"],
  "Back": ["upper-back", "lats"],
  "Shoulders": ["shoulders"],
  "Arms": ["biceps", "triceps", "forearms"],
  "Biceps": ["biceps"],
  "Triceps": ["triceps"],
  "Legs": ["quads", "hamstrings", "calves"],
  "Quadriceps": ["quads"],
  "Hamstrings": ["hamstrings"],
  "Calves": ["calves"],
  "Glutes": ["glutes"],
  "Core": ["abs", "obliques"],
  "Abs": ["abs"],
  "Full Body": ["chest", "upper-back", "quads", "shoulders", "biceps", "triceps", "abs", "glutes", "hamstrings"],
  "Cardio": [],
  "Other": [],
  "Rest": [],
  "Stretching": [],
  "Mobility": []
};

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
  
  const getMuscleClass = (region: string) => {
    if (isSelected(region)) return "fill-primary stroke-primary cursor-pointer";
    if (isHighlighted(region)) return "fill-primary/50 stroke-primary/70 cursor-pointer hover:fill-primary/70";
    return "fill-muted/30 stroke-muted-foreground/30 cursor-pointer hover:fill-muted/50";
  };

  return (
    <svg viewBox="0 0 200 400" className={`w-full max-w-[180px] ${className}`}>
      <g className="body-outline">
        <ellipse cx="100" cy="30" rx="25" ry="28" className="fill-muted/20 stroke-muted-foreground/40" strokeWidth="1.5" />
        
        <path d="M75 58 L60 70 L55 130 L70 135 L80 90 L80 58 Z" className="fill-muted/20 stroke-muted-foreground/40" strokeWidth="1.5" />
        <path d="M125 58 L140 70 L145 130 L130 135 L120 90 L120 58 Z" className="fill-muted/20 stroke-muted-foreground/40" strokeWidth="1.5" />
        
        <path d="M80 200 L75 280 L70 360 L85 365 L95 280 L100 240 L105 280 L115 365 L130 360 L125 280 L120 200 Z" 
              className="fill-muted/20 stroke-muted-foreground/40" strokeWidth="1.5" />
      </g>
      
      <g className="muscles" onClick={(e) => {
        const target = e.target as SVGElement;
        const region = target.getAttribute('data-region');
        if (region && onMuscleClick) onMuscleClick(region);
      }}>
        <path 
          data-region="shoulders"
          d="M65 62 L55 75 L58 95 L75 85 L80 65 Z M135 62 L145 75 L142 95 L125 85 L120 65 Z"
          className={getMuscleClass("shoulders")}
          strokeWidth="1"
        />
        
        <path 
          data-region="chest"
          d="M80 65 L75 85 L80 110 L100 115 L120 110 L125 85 L120 65 L100 60 Z"
          className={getMuscleClass("chest")}
          strokeWidth="1"
        />
        
        <path 
          data-region="biceps"
          d="M55 95 L50 130 L60 135 L70 100 Z M145 95 L150 130 L140 135 L130 100 Z"
          className={getMuscleClass("biceps")}
          strokeWidth="1"
        />
        
        <path 
          data-region="forearms"
          d="M50 130 L45 170 L55 175 L60 135 Z M150 130 L155 170 L145 175 L140 135 Z"
          className={getMuscleClass("forearms")}
          strokeWidth="1"
        />
        
        <path 
          data-region="abs"
          d="M85 115 L80 160 L85 200 L100 205 L115 200 L120 160 L115 115 L100 120 Z"
          className={getMuscleClass("abs")}
          strokeWidth="1"
        />
        
        <path 
          data-region="obliques"
          d="M75 110 L80 115 L80 160 L75 200 L70 195 L72 155 Z M125 110 L120 115 L120 160 L125 200 L130 195 L128 155 Z"
          className={getMuscleClass("obliques")}
          strokeWidth="1"
        />
        
        <path 
          data-region="quads"
          d="M80 205 L75 260 L80 310 L95 315 L100 260 L100 210 Z M120 205 L125 260 L120 310 L105 315 L100 260 L100 210 Z"
          className={getMuscleClass("quads")}
          strokeWidth="1"
        />
        
        <path 
          data-region="calves"
          d="M78 320 L75 360 L90 365 L92 325 Z M122 320 L125 360 L110 365 L108 325 Z"
          className={getMuscleClass("calves")}
          strokeWidth="1"
        />
      </g>
      
      <g className="labels pointer-events-none">
        <text x="100" y="92" textAnchor="middle" className="fill-foreground text-[8px] font-medium">Chest</text>
        <text x="100" y="165" textAnchor="middle" className="fill-foreground text-[8px] font-medium">Abs</text>
        <text x="100" y="265" textAnchor="middle" className="fill-foreground text-[8px] font-medium">Quads</text>
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
  
  const getMuscleClass = (region: string) => {
    if (isSelected(region)) return "fill-primary stroke-primary cursor-pointer";
    if (isHighlighted(region)) return "fill-primary/50 stroke-primary/70 cursor-pointer hover:fill-primary/70";
    return "fill-muted/30 stroke-muted-foreground/30 cursor-pointer hover:fill-muted/50";
  };

  return (
    <svg viewBox="0 0 200 400" className={`w-full max-w-[180px] ${className}`}>
      <g className="body-outline">
        <ellipse cx="100" cy="30" rx="25" ry="28" className="fill-muted/20 stroke-muted-foreground/40" strokeWidth="1.5" />
        
        <path d="M75 58 L60 70 L55 130 L70 135 L80 90 L80 58 Z" className="fill-muted/20 stroke-muted-foreground/40" strokeWidth="1.5" />
        <path d="M125 58 L140 70 L145 130 L130 135 L120 90 L120 58 Z" className="fill-muted/20 stroke-muted-foreground/40" strokeWidth="1.5" />
        
        <path d="M80 200 L75 280 L70 360 L85 365 L95 280 L100 240 L105 280 L115 365 L130 360 L125 280 L120 200 Z" 
              className="fill-muted/20 stroke-muted-foreground/40" strokeWidth="1.5" />
      </g>
      
      <g className="muscles" onClick={(e) => {
        const target = e.target as SVGElement;
        const region = target.getAttribute('data-region');
        if (region && onMuscleClick) onMuscleClick(region);
      }}>
        <path 
          data-region="shoulders"
          d="M65 62 L55 75 L58 95 L75 85 L80 65 Z M135 62 L145 75 L142 95 L125 85 L120 65 Z"
          className={getMuscleClass("shoulders")}
          strokeWidth="1"
        />
        
        <path 
          data-region="upper-back"
          d="M80 65 L75 85 L80 120 L100 125 L120 120 L125 85 L120 65 L100 60 Z"
          className={getMuscleClass("upper-back")}
          strokeWidth="1"
        />
        
        <path 
          data-region="lats"
          d="M75 120 L70 160 L80 170 L85 130 Z M125 120 L130 160 L120 170 L115 130 Z"
          className={getMuscleClass("lats")}
          strokeWidth="1"
        />
        
        <path 
          data-region="triceps"
          d="M55 95 L50 130 L60 135 L70 100 Z M145 95 L150 130 L140 135 L130 100 Z"
          className={getMuscleClass("triceps")}
          strokeWidth="1"
        />
        
        <path 
          data-region="glutes"
          d="M80 195 L75 220 L85 235 L100 238 L115 235 L125 220 L120 195 L100 200 Z"
          className={getMuscleClass("glutes")}
          strokeWidth="1"
        />
        
        <path 
          data-region="hamstrings"
          d="M80 240 L75 300 L90 310 L100 270 Z M120 240 L125 300 L110 310 L100 270 Z"
          className={getMuscleClass("hamstrings")}
          strokeWidth="1"
        />
        
        <path 
          data-region="calves"
          d="M78 315 L75 360 L90 365 L92 320 Z M122 315 L125 360 L110 365 L108 320 Z"
          className={getMuscleClass("calves")}
          strokeWidth="1"
        />
      </g>
      
      <g className="labels pointer-events-none">
        <text x="100" y="95" textAnchor="middle" className="fill-foreground text-[8px] font-medium">Back</text>
        <text x="100" y="218" textAnchor="middle" className="fill-foreground text-[8px] font-medium">Glutes</text>
        <text x="100" y="280" textAnchor="middle" className="fill-foreground text-[8px] font-medium">Hamstrings</text>
      </g>
    </svg>
  );
}

export function BodyMap(props: BodyMapProps & { view?: "front" | "back" | "both" }) {
  const { view = "both", ...mapProps } = props;
  
  if (view === "front") return <BodyMapFront {...mapProps} />;
  if (view === "back") return <BodyMapBack {...mapProps} />;
  
  return (
    <div className="flex justify-center gap-2">
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-1">Front</p>
        <BodyMapFront {...mapProps} />
      </div>
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-1">Back</p>
        <BodyMapBack {...mapProps} />
      </div>
    </div>
  );
}
