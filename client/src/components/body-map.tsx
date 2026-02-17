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
  "chest": "Chest", "upper-back": "Upper Back", "lats": "Lats",
  "shoulders": "Delts", "biceps": "Biceps", "triceps": "Triceps",
  "forearms": "Forearms", "quads": "Quads", "hamstrings": "Hamstrings",
  "calves": "Calves", "glutes": "Glutes", "abs": "Abs", "obliques": "Obliques"
};

function useRegionInteraction(highlightedMuscles: string[], selectedMuscle?: string | null) {
  const [hovered, setHovered] = useState<string | null>(null);

  const getFill = useCallback((region: string): string => {
    if (selectedMuscle === region) return "hsl(var(--primary))";
    if (highlightedMuscles.includes(region)) return "hsl(var(--primary))";
    return "hsl(var(--muted-foreground))";
  }, [highlightedMuscles, selectedMuscle]);

  const getOpacity = useCallback((region: string): number => {
    const isHov = hovered === region;
    if (selectedMuscle === region) return 1;
    if (highlightedMuscles.includes(region)) return isHov ? 0.8 : 0.6;
    return isHov ? 0.18 : 0.1;
  }, [highlightedMuscles, selectedMuscle, hovered]);

  const getFilter = useCallback((region: string): string => {
    if (selectedMuscle === region) return "url(#glow)";
    if (highlightedMuscles.includes(region) && hovered === region) return "url(#glow)";
    return "none";
  }, [highlightedMuscles, selectedMuscle, hovered]);

  return { hovered, setHovered, getFill, getOpacity, getFilter };
}

function Tooltip({ x, y, label }: { x: number; y: number; label: string }) {
  const w = label.length * 7.5 + 18;
  return (
    <g className="pointer-events-none">
      <rect x={x - w / 2} y={y - 26} width={w} height={22} rx={6}
        fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.5}
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" }} />
      <polygon points={`${x - 4},${y - 4} ${x + 4},${y - 4} ${x},${y + 1}`} fill="hsl(var(--popover))" />
      <text x={x} y={y - 12.5} textAnchor="middle" fill="hsl(var(--popover-foreground))"
        fontSize="9.5" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.2">
        {label}
      </text>
    </g>
  );
}

interface RegionProps {
  region: string;
  fill: string;
  opacity: number;
  filter: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
}

function Region({ region, fill, opacity, filter, onMouseEnter, onMouseLeave, onClick, children, testId }: RegionProps) {
  return (
    <g data-region={region} data-testid={testId || `region-${region}`}
       style={{ cursor: "pointer", transition: "opacity 0.2s ease, filter 0.2s ease" }}
       fill={fill} opacity={opacity} filter={filter}
       onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
      {children}
    </g>
  );
}

function GlowFilter() {
  return (
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.4"/>
      <feComposite in2="b" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  );
}

function Joints() {
  return (
    <g className="joints pointer-events-none" fill="hsl(var(--muted-foreground))" opacity="0.08">
      <circle cx={55} cy={55} r={4} />
      <circle cx={145} cy={55} r={4} />
      <circle cx={47} cy={110} r={3.5} />
      <circle cx={153} cy={110} r={3.5} />
      <circle cx={83} cy={150} r={4} />
      <circle cx={117} cy={150} r={4} />
      <circle cx={83} cy={248} r={4.5} />
      <circle cx={117} cy={248} r={4.5} />
    </g>
  );
}

export function BodyMapFront({ highlightedMuscles, onMuscleClick, selectedMuscle, className = "" }: BodyMapProps) {
  const { hovered, setHovered, getFill, getOpacity, getFilter } = useRegionInteraction(highlightedMuscles, selectedMuscle);
  const onE = useCallback((r: string) => () => setHovered(r), [setHovered]);
  const onL = useCallback(() => setHovered(null), [setHovered]);
  const onC = useCallback((r: string) => () => onMuscleClick?.(r), [onMuscleClick]);

  const tp: Record<string, [number, number]> = {
    shoulders: [100, 42], chest: [100, 68], biceps: [40, 76],
    forearms: [36, 128], abs: [100, 112], obliques: [68, 112],
    quads: [100, 196], calves: [100, 276],
  };

  return (
    <svg viewBox="0 0 200 340" className={`w-full max-w-[170px] ${className}`} data-testid="body-map-front">
      <defs><GlowFilter /></defs>

      <g className="head-neck pointer-events-none" fill="hsl(var(--muted-foreground))" opacity="0.1">
        <ellipse cx={100} cy={18} rx={12} ry={15} />
        <rect x={95} y={33} width={10} height={10} rx={3} />
      </g>

      <Joints />

      <g className="non-interactive pointer-events-none" fill="hsl(var(--muted-foreground))" opacity="0.06">
        <rect x={78} y={136} width={44} height={12} rx={5} />
      </g>

      <Region region="shoulders" testId="region-shoulders-front" fill={getFill("shoulders")} opacity={getOpacity("shoulders")} filter={getFilter("shoulders")}
        onMouseEnter={onE("shoulders")} onMouseLeave={onL} onClick={onC("shoulders")}>
        <ellipse cx={62} cy={52} rx={14} ry={9} />
        <ellipse cx={138} cy={52} rx={14} ry={9} />
      </Region>

      <Region region="chest" testId="region-chest" fill={getFill("chest")} opacity={getOpacity("chest")} filter={getFilter("chest")}
        onMouseEnter={onE("chest")} onMouseLeave={onL} onClick={onC("chest")}>
        <rect x={74} y={46} width={52} height={38} rx={7} />
        <line x1={100} y1={50} x2={100} y2={80} stroke="hsl(var(--background))" strokeWidth="1" opacity="0.3" />
      </Region>

      <Region region="biceps" testId="region-biceps" fill={getFill("biceps")} opacity={getOpacity("biceps")} filter={getFilter("biceps")}
        onMouseEnter={onE("biceps")} onMouseLeave={onL} onClick={onC("biceps")}>
        <rect x={42} y={58} width={12} height={48} rx={6} />
        <rect x={146} y={58} width={12} height={48} rx={6} />
      </Region>

      <Region region="forearms" testId="region-forearms" fill={getFill("forearms")} opacity={getOpacity("forearms")} filter={getFilter("forearms")}
        onMouseEnter={onE("forearms")} onMouseLeave={onL} onClick={onC("forearms")}>
        <rect x={38} y={110} width={11} height={44} rx={5.5} />
        <rect x={151} y={110} width={11} height={44} rx={5.5} />
      </Region>

      <Region region="abs" testId="region-abs" fill={getFill("abs")} opacity={getOpacity("abs")} filter={getFilter("abs")}
        onMouseEnter={onE("abs")} onMouseLeave={onL} onClick={onC("abs")}>
        <rect x={84} y={86} width={32} height={48} rx={5} />
        <line x1={100} y1={90} x2={100} y2={130} stroke="hsl(var(--background))" strokeWidth="0.8" opacity="0.25" />
        <line x1={86} y1={98} x2={114} y2={98} stroke="hsl(var(--background))" strokeWidth="0.6" opacity="0.15" />
        <line x1={86} y1={110} x2={114} y2={110} stroke="hsl(var(--background))" strokeWidth="0.6" opacity="0.15" />
        <line x1={86} y1={122} x2={114} y2={122} stroke="hsl(var(--background))" strokeWidth="0.6" opacity="0.15" />
      </Region>

      <Region region="obliques" testId="region-obliques" fill={getFill("obliques")} opacity={getOpacity("obliques")} filter={getFilter("obliques")}
        onMouseEnter={onE("obliques")} onMouseLeave={onL} onClick={onC("obliques")}>
        <rect x={74} y={86} width={10} height={48} rx={4} />
        <rect x={116} y={86} width={10} height={48} rx={4} />
      </Region>

      <Region region="quads" testId="region-quads" fill={getFill("quads")} opacity={getOpacity("quads")} filter={getFilter("quads")}
        onMouseEnter={onE("quads")} onMouseLeave={onL} onClick={onC("quads")}>
        <rect x={74} y={152} width={18} height={90} rx={8} />
        <rect x={108} y={152} width={18} height={90} rx={8} />
      </Region>

      <Region region="calves" testId="region-calves" fill={getFill("calves")} opacity={getOpacity("calves")} filter={getFilter("calves")}
        onMouseEnter={onE("calves")} onMouseLeave={onL} onClick={onC("calves")}>
        <rect x={76} y={256} width={14} height={56} rx={7} />
        <rect x={110} y={256} width={14} height={56} rx={7} />
      </Region>

      <g className="feet pointer-events-none" fill="hsl(var(--muted-foreground))" opacity="0.08">
        <ellipse cx={83} cy={318} rx={9} ry={4} />
        <ellipse cx={117} cy={318} rx={9} ry={4} />
      </g>

      {hovered && tp[hovered] && <Tooltip x={tp[hovered][0]} y={tp[hovered][1]} label={regionLabels[hovered] || hovered} />}
    </svg>
  );
}

export function BodyMapBack({ highlightedMuscles, onMuscleClick, selectedMuscle, className = "" }: BodyMapProps) {
  const { hovered, setHovered, getFill, getOpacity, getFilter } = useRegionInteraction(highlightedMuscles, selectedMuscle);
  const onE = useCallback((r: string) => () => setHovered(r), [setHovered]);
  const onL = useCallback(() => setHovered(null), [setHovered]);
  const onC = useCallback((r: string) => () => onMuscleClick?.(r), [onMuscleClick]);

  const tp: Record<string, [number, number]> = {
    shoulders: [100, 42], "upper-back": [100, 68], lats: [68, 108],
    triceps: [40, 76], glutes: [100, 148], hamstrings: [100, 196],
    calves: [100, 276],
  };

  return (
    <svg viewBox="0 0 200 340" className={`w-full max-w-[170px] ${className}`} data-testid="body-map-back">
      <defs><GlowFilter /></defs>

      <g className="head-neck pointer-events-none" fill="hsl(var(--muted-foreground))" opacity="0.1">
        <ellipse cx={100} cy={18} rx={12} ry={15} />
        <rect x={95} y={33} width={10} height={10} rx={3} />
      </g>

      <Joints />

      <g className="spine pointer-events-none" opacity="0.1">
        <line x1={100} y1={43} x2={100} y2={145} stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" strokeDasharray="3 2.5" />
        {[50, 62, 74, 86, 98, 110, 122, 134].map(y => (
          <circle key={y} cx={100} cy={y} r={1.2} fill="hsl(var(--muted-foreground))" />
        ))}
      </g>

      <Region region="shoulders" testId="region-shoulders-back" fill={getFill("shoulders")} opacity={getOpacity("shoulders")} filter={getFilter("shoulders")}
        onMouseEnter={onE("shoulders")} onMouseLeave={onL} onClick={onC("shoulders")}>
        <ellipse cx={62} cy={52} rx={14} ry={9} />
        <ellipse cx={138} cy={52} rx={14} ry={9} />
      </Region>

      <Region region="upper-back" testId="region-upper-back" fill={getFill("upper-back")} opacity={getOpacity("upper-back")} filter={getFilter("upper-back")}
        onMouseEnter={onE("upper-back")} onMouseLeave={onL} onClick={onC("upper-back")}>
        <rect x={74} y={46} width={52} height={38} rx={7} />
      </Region>

      <Region region="lats" testId="region-lats" fill={getFill("lats")} opacity={getOpacity("lats")} filter={getFilter("lats")}
        onMouseEnter={onE("lats")} onMouseLeave={onL} onClick={onC("lats")}>
        <rect x={74} y={86} width={12} height={48} rx={5} />
        <rect x={114} y={86} width={12} height={48} rx={5} />
      </Region>

      <Region region="triceps" testId="region-triceps" fill={getFill("triceps")} opacity={getOpacity("triceps")} filter={getFilter("triceps")}
        onMouseEnter={onE("triceps")} onMouseLeave={onL} onClick={onC("triceps")}>
        <rect x={42} y={58} width={12} height={48} rx={6} />
        <rect x={146} y={58} width={12} height={48} rx={6} />
      </Region>

      <Region region="glutes" testId="region-glutes" fill={getFill("glutes")} opacity={getOpacity("glutes")} filter={getFilter("glutes")}
        onMouseEnter={onE("glutes")} onMouseLeave={onL} onClick={onC("glutes")}>
        <ellipse cx={88} cy={145} rx={12} ry={10} />
        <ellipse cx={112} cy={145} rx={12} ry={10} />
      </Region>

      <Region region="hamstrings" testId="region-hamstrings" fill={getFill("hamstrings")} opacity={getOpacity("hamstrings")} filter={getFilter("hamstrings")}
        onMouseEnter={onE("hamstrings")} onMouseLeave={onL} onClick={onC("hamstrings")}>
        <rect x={74} y={158} width={18} height={84} rx={8} />
        <rect x={108} y={158} width={18} height={84} rx={8} />
      </Region>

      <Region region="calves" testId="region-calves-back" fill={getFill("calves")} opacity={getOpacity("calves")} filter={getFilter("calves")}
        onMouseEnter={onE("calves")} onMouseLeave={onL} onClick={onC("calves")}>
        <rect x={76} y={256} width={14} height={56} rx={7} />
        <rect x={110} y={256} width={14} height={56} rx={7} />
      </Region>

      <g className="feet pointer-events-none" fill="hsl(var(--muted-foreground))" opacity="0.08">
        <ellipse cx={83} cy={318} rx={9} ry={4} />
        <ellipse cx={117} cy={318} rx={9} ry={4} />
      </g>

      {hovered && tp[hovered] && <Tooltip x={tp[hovered][0]} y={tp[hovered][1]} label={regionLabels[hovered] || hovered} />}
    </svg>
  );
}

export function BodyMap(props: BodyMapProps & { view?: "front" | "back" | "both" }) {
  const { view = "both", ...mapProps } = props;

  if (view === "front") return <BodyMapFront {...mapProps} />;
  if (view === "back") return <BodyMapBack {...mapProps} />;

  return (
    <div className="flex justify-center items-start gap-6 py-2">
      <div className="text-center">
        <p className="text-[9px] font-semibold text-muted-foreground/50 mb-2 uppercase tracking-[0.15em]">Front</p>
        <BodyMapFront {...mapProps} />
      </div>
      <div className="text-center">
        <p className="text-[9px] font-semibold text-muted-foreground/50 mb-2 uppercase tracking-[0.15em]">Back</p>
        <BodyMapBack {...mapProps} />
      </div>
    </div>
  );
}
