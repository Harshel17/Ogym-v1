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
  const textLen = label.length * 4.2 + 12;
  return (
    <g className="pointer-events-none" style={{ opacity: 1, transition: "opacity 0.2s" }}>
      <rect x={x - textLen / 2} y={y - 18} width={textLen} height={16} rx={4}
        fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.6}
        style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.15))" }} />
      <polygon points={`${x - 3},${y - 2} ${x + 3},${y - 2} ${x},${y + 2}`} fill="hsl(var(--popover))" />
      <text x={x} y={y - 8} textAnchor="middle" fill="hsl(var(--popover-foreground))"
        fontSize="7" fontWeight="600" fontFamily="system-ui, sans-serif" letterSpacing="0.2">
        {label}
      </text>
    </g>
  );
}

function LabelLine({ x1, y1, x2, y2, label, anchor }: { x1: number; y1: number; x2: number; y2: number; label: string; anchor: "start" | "end" }) {
  return (
    <>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.5" strokeDasharray="1.5 1" />
      <circle cx={x2} cy={y2} r="1" fill="hsl(var(--primary))" />
      <text x={anchor === "start" ? x2 + 3 : x2 - 3} y={y2 - 2} textAnchor={anchor}
        fill="hsl(var(--primary))" fontSize="5.5" fontWeight="700" fontFamily="system-ui" letterSpacing="0.4" opacity="0.8">
        {label}
      </text>
    </>
  );
}

function useMuscleStyle(
  isHighlighted: (r: string) => boolean,
  isSelected: (r: string) => boolean,
  isHovered: (r: string) => boolean,
  suffix: string
) {
  return useCallback((region: string): React.CSSProperties => {
    const base: React.CSSProperties = { cursor: "pointer", transition: "all 0.3s ease" };
    if (isSelected(region)) {
      return { ...base, fill: `url(#selGrad${suffix})`, stroke: "hsl(var(--primary))", strokeWidth: 1.2, filter: `url(#glow${suffix})` };
    }
    if (isHighlighted(region)) {
      return { ...base, fill: `url(#hlGrad${suffix})`, stroke: "hsl(var(--primary) / 0.5)", strokeWidth: 0.8,
        filter: isHovered(region) ? `url(#glow${suffix})` : `url(#sglow${suffix})` };
    }
    return { ...base, fill: `url(#skinGrad${suffix})`, stroke: "hsl(var(--muted-foreground) / 0.15)", strokeWidth: 0.4 };
  }, [isHighlighted, isSelected, isHovered, suffix]);
}

function SharedDefs({ s }: { s: string }) {
  return (
    <defs>
      <linearGradient id={`hlGrad${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id={`selGrad${s}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
      </linearGradient>
      <radialGradient id={`skinGrad${s}`} cx="50%" cy="40%" r="55%">
        <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.22" />
        <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.08" />
      </radialGradient>
      <radialGradient id={`bodyGrad${s}`} cx="50%" cy="35%" r="60%">
        <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.18" />
        <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.06" />
      </radialGradient>
      <filter id={`glow${s}`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.35"/>
        <feComposite in2="b" operator="in"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id={`sglow${s}`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.5" result="b"/>
        <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.12"/>
        <feComposite in2="b" operator="in"/>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}

export function BodyMapFront({ highlightedMuscles, onMuscleClick, selectedMuscle, className = "" }: BodyMapProps) {
  const [hov, setHov] = useState<string | null>(null);
  const isH = (r: string) => highlightedMuscles.includes(r);
  const isS = (r: string) => selectedMuscle === r;
  const isV = (r: string) => hov === r;
  const gs = useMuscleStyle(isH, isS, isV, "F");
  const onE = useCallback((r: string) => setHov(r), []);
  const onL = useCallback(() => setHov(null), []);

  const tp: Record<string, { x: number; y: number }> = {
    shoulders: { x: 75, y: 68 }, chest: { x: 75, y: 88 }, biceps: { x: 40, y: 115 },
    forearms: { x: 36, y: 155 }, abs: { x: 75, y: 155 }, obliques: { x: 60, y: 155 },
    quads: { x: 75, y: 265 }, calves: { x: 75, y: 360 },
  };

  return (
    <svg viewBox="0 0 150 460" className={`w-full max-w-[140px] ${className}`} data-testid="body-map-front">
      <SharedDefs s="F" />

      <g className="body-silhouette">
        <ellipse cx="75" cy="22" rx="11" ry="14" fill="url(#bodyGradF)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="0.6" data-testid="head-front" />
        <rect x="71" y="36" width="8" height="10" rx="3" fill="url(#bodyGradF)" stroke="none" />
        <path d="M56 48 Q48 50 42 58 Q38 68 36 82 Q34 98 36 116 Q38 128 40 136 Q42 142 44 150 Q46 158 48 168
                 M94 48 Q102 50 108 58 Q112 68 114 82 Q116 98 114 116 Q112 128 110 136 Q108 142 106 150 Q104 158 102 168"
              fill="none" stroke="hsl(var(--muted-foreground) / 0.18)" strokeWidth="0.5" />
        <path d="M60 48 L90 48 Q96 52 98 62 Q100 80 100 100 Q100 120 98 140 Q96 155 94 168 Q92 180 90 195
                 Q88 210 86 220 Q84 230 84 245 Q84 270 86 300 Q88 330 90 355 Q92 370 92 390 Q92 400 88 410 L82 416
                 Q78 390 76 370 L75 355 L74 370 Q72 390 68 416 L62 410
                 Q58 400 58 390 Q58 370 60 355 Q62 330 64 300 Q66 270 66 245 Q66 230 64 220 Q62 210 60 195
                 Q58 180 56 168 Q54 155 52 140 Q50 120 50 100 Q50 80 52 62 Q54 52 60 48 Z"
              fill="url(#bodyGradF)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="0.6" />
      </g>

      <g className="muscles">
        <path data-region="shoulders" data-testid="region-shoulders-front"
          d="M56 48 Q50 52 46 60 Q42 70 44 80 Q48 78 52 72 Q56 64 60 54 Q58 48 56 48 Z
             M94 48 Q100 52 104 60 Q108 70 106 80 Q102 78 98 72 Q94 64 90 54 Q92 48 94 48 Z"
          style={gs("shoulders")} onMouseEnter={() => onE("shoulders")} onMouseLeave={onL} onClick={() => onMuscleClick?.("shoulders")} />

        <path data-region="chest" data-testid="region-chest"
          d="M62 52 Q58 60 56 72 Q54 84 58 94 Q62 100 70 102 L75 104 L80 102 Q88 100 92 94 Q96 84 94 72 Q92 60 88 52 Q82 48 75 46 Q68 48 62 52 Z"
          style={gs("chest")} onMouseEnter={() => onE("chest")} onMouseLeave={onL} onClick={() => onMuscleClick?.("chest")} />

        <path data-region="biceps" data-testid="region-biceps"
          d="M42 80 Q40 90 38 102 Q36 112 38 118 Q42 116 46 110 Q50 100 52 88 Q50 80 46 80 Z
             M108 80 Q110 90 112 102 Q114 112 112 118 Q108 116 104 110 Q100 100 98 88 Q100 80 104 80 Z"
          style={gs("biceps")} onMouseEnter={() => onE("biceps")} onMouseLeave={onL} onClick={() => onMuscleClick?.("biceps")} />

        <path data-region="forearms" data-testid="region-forearms"
          d="M38 120 Q36 132 34 146 Q34 156 38 160 Q42 158 44 150 Q46 138 48 124 Q46 118 40 118 Z
             M112 120 Q114 132 116 146 Q116 156 112 160 Q108 158 106 150 Q104 138 102 124 Q104 118 110 118 Z"
          style={gs("forearms")} onMouseEnter={() => onE("forearms")} onMouseLeave={onL} onClick={() => onMuscleClick?.("forearms")} />

        <path data-region="abs" data-testid="region-abs"
          d="M68 102 Q66 115 64 130 Q62 148 64 165 Q66 172 72 176 L75 178 L78 176 Q84 172 86 165 Q88 148 86 130 Q84 115 82 102 Q78 100 75 102 Q72 100 68 102 Z"
          style={gs("abs")} onMouseEnter={() => onE("abs")} onMouseLeave={onL} onClick={() => onMuscleClick?.("abs")} />

        <path data-region="obliques" data-testid="region-obliques"
          d="M56 96 Q54 112 52 130 Q50 150 52 168 Q56 174 62 176 Q64 170 64 165 Q62 148 64 130 Q66 115 68 102 Q64 96 58 96 Z
             M94 96 Q96 112 98 130 Q100 150 98 168 Q94 174 88 176 Q86 170 86 165 Q88 148 86 130 Q84 115 82 102 Q86 96 92 96 Z"
          style={gs("obliques")} onMouseEnter={() => onE("obliques")} onMouseLeave={onL} onClick={() => onMuscleClick?.("obliques")} />

        <path data-region="quads" data-testid="region-quads"
          d="M64 195 Q62 220 60 248 Q60 270 64 290 Q68 300 72 296 Q74 280 75 260 L75 225 L75 200 Q70 194 64 195 Z
             M86 195 Q88 220 90 248 Q90 270 86 290 Q82 300 78 296 Q76 280 75 260 L75 225 L75 200 Q80 194 86 195 Z"
          style={gs("quads")} onMouseEnter={() => onE("quads")} onMouseLeave={onL} onClick={() => onMuscleClick?.("quads")} />

        <path data-region="calves" data-testid="region-calves"
          d="M62 320 Q60 338 58 355 Q58 366 62 372 Q66 376 70 370 Q72 356 74 340 Q72 322 66 318 Z
             M88 320 Q90 338 92 355 Q92 366 88 372 Q84 376 80 370 Q78 356 76 340 Q78 322 84 318 Z"
          style={gs("calves")} onMouseEnter={() => onE("calves")} onMouseLeave={onL} onClick={() => onMuscleClick?.("calves")} />
      </g>

      <g className="labels pointer-events-none">
        {isH("shoulders") && <LabelLine x1={48} y1={64} x2={20} y2={58} label="DELTS" anchor="end" />}
        {isH("chest") && <LabelLine x1={92} y1={76} x2={128} y2={70} label="CHEST" anchor="start" />}
        {isH("biceps") && <LabelLine x1={110} y1={100} x2={132} y2={94} label="BICEPS" anchor="start" />}
        {isH("forearms") && <LabelLine x1={36} y1={142} x2={16} y2={148} label="FOREARMS" anchor="end" />}
        {isH("abs") && <LabelLine x1={84} y1={140} x2={128} y2={136} label="ABS" anchor="start" />}
        {isH("obliques") && <LabelLine x1={54} y1={135} x2={20} y2={130} label="OBLIQUES" anchor="end" />}
        {isH("quads") && <LabelLine x1={88} y1={248} x2={124} y2={244} label="QUADS" anchor="start" />}
        {isH("calves") && <LabelLine x1={60} y1={350} x2={30} y2={346} label="CALVES" anchor="end" />}
      </g>

      {hov && tp[hov] && <Tooltip x={tp[hov].x} y={tp[hov].y} label={regionLabels[hov] || hov} visible={true} />}
    </svg>
  );
}

export function BodyMapBack({ highlightedMuscles, onMuscleClick, selectedMuscle, className = "" }: BodyMapProps) {
  const [hov, setHov] = useState<string | null>(null);
  const isH = (r: string) => highlightedMuscles.includes(r);
  const isS = (r: string) => selectedMuscle === r;
  const isV = (r: string) => hov === r;
  const gs = useMuscleStyle(isH, isS, isV, "B");
  const onE = useCallback((r: string) => setHov(r), []);
  const onL = useCallback(() => setHov(null), []);

  const tp: Record<string, { x: number; y: number }> = {
    shoulders: { x: 75, y: 68 }, "upper-back": { x: 75, y: 88 }, lats: { x: 55, y: 128 },
    triceps: { x: 40, y: 115 }, glutes: { x: 75, y: 195 }, hamstrings: { x: 75, y: 260 },
    calves: { x: 75, y: 360 },
  };

  return (
    <svg viewBox="0 0 150 460" className={`w-full max-w-[140px] ${className}`} data-testid="body-map-back">
      <SharedDefs s="B" />

      <g className="body-silhouette">
        <ellipse cx="75" cy="22" rx="11" ry="14" fill="url(#bodyGradB)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="0.6" data-testid="head-back" />
        <rect x="71" y="36" width="8" height="10" rx="3" fill="url(#bodyGradB)" stroke="none" />
        <path d="M56 48 Q48 50 42 58 Q38 68 36 82 Q34 98 36 116 Q38 128 40 136 Q42 142 44 150 Q46 158 48 168
                 M94 48 Q102 50 108 58 Q112 68 114 82 Q116 98 114 116 Q112 128 110 136 Q108 142 106 150 Q104 158 102 168"
              fill="none" stroke="hsl(var(--muted-foreground) / 0.18)" strokeWidth="0.5" />
        <path d="M60 48 L90 48 Q96 52 98 62 Q100 80 100 100 Q100 120 98 140 Q96 155 94 168 Q92 180 90 195
                 Q88 210 86 220 Q84 230 84 245 Q84 270 86 300 Q88 330 90 355 Q92 370 92 390 Q92 400 88 410 L82 416
                 Q78 390 76 370 L75 355 L74 370 Q72 390 68 416 L62 410
                 Q58 400 58 390 Q58 370 60 355 Q62 330 64 300 Q66 270 66 245 Q66 230 64 220 Q62 210 60 195
                 Q58 180 56 168 Q54 155 52 140 Q50 120 50 100 Q50 80 52 62 Q54 52 60 48 Z"
              fill="url(#bodyGradB)" stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth="0.6" />
      </g>

      <g className="spine pointer-events-none" opacity="0.18">
        <path d="M75 40 L75 195" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" fill="none" strokeDasharray="2.5 1.5" />
        {[48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192].map(y => (
          <circle key={y} cx={75} cy={y} r={0.9} fill="hsl(var(--muted-foreground))" />
        ))}
      </g>

      <g className="muscles">
        <path data-region="shoulders" data-testid="region-shoulders-back"
          d="M56 48 Q50 52 46 60 Q42 70 44 80 Q48 78 52 72 Q56 64 60 54 Q58 48 56 48 Z
             M94 48 Q100 52 104 60 Q108 70 106 80 Q102 78 98 72 Q94 64 90 54 Q92 48 94 48 Z"
          style={gs("shoulders")} onMouseEnter={() => onE("shoulders")} onMouseLeave={onL} onClick={() => onMuscleClick?.("shoulders")} />

        <path data-region="upper-back" data-testid="region-upper-back"
          d="M62 52 Q58 60 56 72 Q54 84 58 94 Q62 100 70 102 L75 104 L80 102 Q88 100 92 94 Q96 84 94 72 Q92 60 88 52 Q82 48 75 46 Q68 48 62 52 Z"
          style={gs("upper-back")} onMouseEnter={() => onE("upper-back")} onMouseLeave={onL} onClick={() => onMuscleClick?.("upper-back")} />

        <path data-region="lats" data-testid="region-lats"
          d="M54 96 Q52 112 50 130 Q50 140 54 148 Q58 146 62 138 Q66 126 68 108 Q64 100 56 96 Z
             M96 96 Q98 112 100 130 Q100 140 96 148 Q92 146 88 138 Q84 126 82 108 Q86 100 94 96 Z"
          style={gs("lats")} onMouseEnter={() => onE("lats")} onMouseLeave={onL} onClick={() => onMuscleClick?.("lats")} />

        <path data-region="triceps" data-testid="region-triceps"
          d="M42 80 Q40 90 38 102 Q36 112 38 118 Q42 116 46 110 Q50 100 52 88 Q50 80 46 80 Z
             M108 80 Q110 90 112 102 Q114 112 112 118 Q108 116 104 110 Q100 100 98 88 Q100 80 104 80 Z"
          style={gs("triceps")} onMouseEnter={() => onE("triceps")} onMouseLeave={onL} onClick={() => onMuscleClick?.("triceps")} />

        <path data-region="glutes" data-testid="region-glutes"
          d="M60 180 Q56 192 58 204 Q60 214 68 218 Q72 220 75 218 Q78 220 82 218 Q90 214 92 204 Q94 192 90 180 Q84 184 75 186 Q66 184 60 180 Z"
          style={gs("glutes")} onMouseEnter={() => onE("glutes")} onMouseLeave={onL} onClick={() => onMuscleClick?.("glutes")} />

        <path data-region="hamstrings" data-testid="region-hamstrings"
          d="M64 222 Q62 242 60 265 Q60 280 64 296 Q68 304 72 298 L74 270 L75 240 Q70 224 64 222 Z
             M86 222 Q88 242 90 265 Q90 280 86 296 Q82 304 78 298 L76 270 L75 240 Q80 224 86 222 Z"
          style={gs("hamstrings")} onMouseEnter={() => onE("hamstrings")} onMouseLeave={onL} onClick={() => onMuscleClick?.("hamstrings")} />

        <path data-region="calves" data-testid="region-calves-back"
          d="M62 320 Q60 338 58 355 Q58 366 62 372 Q66 376 70 370 Q72 356 74 340 Q72 322 66 318 Z
             M88 320 Q90 338 92 355 Q92 366 88 372 Q84 376 80 370 Q78 356 76 340 Q78 322 84 318 Z"
          style={gs("calves")} onMouseEnter={() => onE("calves")} onMouseLeave={onL} onClick={() => onMuscleClick?.("calves")} />
      </g>

      <g className="labels pointer-events-none">
        {isH("shoulders") && <LabelLine x1={48} y1={64} x2={20} y2={58} label="DELTS" anchor="end" />}
        {isH("upper-back") && <LabelLine x1={92} y1={76} x2={128} y2={70} label="BACK" anchor="start" />}
        {isH("lats") && <LabelLine x1={52} y1={125} x2={20} y2={120} label="LATS" anchor="end" />}
        {isH("triceps") && <LabelLine x1={110} y1={100} x2={132} y2={94} label="TRICEPS" anchor="start" />}
        {isH("glutes") && <LabelLine x1={90} y1={200} x2={124} y2={196} label="GLUTES" anchor="start" />}
        {isH("hamstrings") && <LabelLine x1={62} y1={260} x2={28} y2={256} label="HAMS" anchor="end" />}
        {isH("calves") && <LabelLine x1={90} y1={350} x2={122} y2={346} label="CALVES" anchor="start" />}
      </g>

      {hov && tp[hov] && <Tooltip x={tp[hov].x} y={tp[hov].y} label={regionLabels[hov] || hov} visible={true} />}
    </svg>
  );
}

export function BodyMap(props: BodyMapProps & { view?: "front" | "back" | "both" }) {
  const { view = "both", ...mapProps } = props;

  if (view === "front") return <BodyMapFront {...mapProps} />;
  if (view === "back") return <BodyMapBack {...mapProps} />;

  return (
    <div className="flex justify-center items-start gap-4 py-3">
      <div className="text-center">
        <p className="text-[9px] font-semibold text-foreground/40 mb-1.5 uppercase tracking-[0.2em]">Front</p>
        <BodyMapFront {...mapProps} />
      </div>
      <div className="text-center">
        <p className="text-[9px] font-semibold text-foreground/40 mb-1.5 uppercase tracking-[0.2em]">Back</p>
        <BodyMapBack {...mapProps} />
      </div>
    </div>
  );
}
