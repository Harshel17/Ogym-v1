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

interface OverlayRegion {
  id: string;
  label: string;
  shapes: Array<{ type: "ellipse"; cx: number; cy: number; rx: number; ry: number } |
                 { type: "rect"; x: number; y: number; w: number; h: number; rx?: number }>;
  tooltipPos: [number, number];
}

const frontRegions: OverlayRegion[] = [
  { id: "shoulders", label: "Delts", tooltipPos: [50, 16],
    shapes: [
      { type: "ellipse", cx: 31, cy: 20, rx: 5, ry: 2.5 },
      { type: "ellipse", cx: 69, cy: 20, rx: 5, ry: 2.5 },
    ]},
  { id: "chest", label: "Chest", tooltipPos: [50, 22],
    shapes: [
      { type: "ellipse", cx: 43, cy: 27, rx: 6, ry: 4 },
      { type: "ellipse", cx: 57, cy: 27, rx: 6, ry: 4 },
    ]},
  { id: "biceps", label: "Biceps", tooltipPos: [24, 27],
    shapes: [
      { type: "ellipse", cx: 27, cy: 31, rx: 3, ry: 5 },
      { type: "ellipse", cx: 73, cy: 31, rx: 3, ry: 5 },
    ]},
  { id: "forearms", label: "Forearms", tooltipPos: [21, 41],
    shapes: [
      { type: "ellipse", cx: 23, cy: 44, rx: 2.5, ry: 5 },
      { type: "ellipse", cx: 77, cy: 44, rx: 2.5, ry: 5 },
    ]},
  { id: "abs", label: "Abs", tooltipPos: [50, 33],
    shapes: [
      { type: "rect", x: 44, y: 34, w: 12, h: 11, rx: 2 },
    ]},
  { id: "obliques", label: "Obliques", tooltipPos: [38, 37],
    shapes: [
      { type: "ellipse", cx: 40, cy: 39, rx: 3, ry: 4.5 },
      { type: "ellipse", cx: 60, cy: 39, rx: 3, ry: 4.5 },
    ]},
  { id: "quads", label: "Quads", tooltipPos: [50, 53],
    shapes: [
      { type: "ellipse", cx: 42, cy: 59, rx: 5, ry: 8 },
      { type: "ellipse", cx: 58, cy: 59, rx: 5, ry: 8 },
    ]},
  { id: "calves", label: "Calves", tooltipPos: [50, 72],
    shapes: [
      { type: "ellipse", cx: 42, cy: 78, rx: 3.5, ry: 6 },
      { type: "ellipse", cx: 58, cy: 78, rx: 3.5, ry: 6 },
    ]},
];

const backRegions: OverlayRegion[] = [
  { id: "shoulders", label: "Delts", tooltipPos: [50, 16],
    shapes: [
      { type: "ellipse", cx: 31, cy: 20, rx: 5, ry: 2.5 },
      { type: "ellipse", cx: 69, cy: 20, rx: 5, ry: 2.5 },
    ]},
  { id: "upper-back", label: "Upper Back", tooltipPos: [50, 22],
    shapes: [
      { type: "rect", x: 39, y: 23, w: 22, h: 10, rx: 3 },
    ]},
  { id: "lats", label: "Lats", tooltipPos: [38, 35],
    shapes: [
      { type: "ellipse", cx: 40, cy: 38, rx: 5, ry: 5 },
      { type: "ellipse", cx: 60, cy: 38, rx: 5, ry: 5 },
    ]},
  { id: "triceps", label: "Triceps", tooltipPos: [24, 27],
    shapes: [
      { type: "ellipse", cx: 27, cy: 31, rx: 3, ry: 5 },
      { type: "ellipse", cx: 73, cy: 31, rx: 3, ry: 5 },
    ]},
  { id: "glutes", label: "Glutes", tooltipPos: [50, 47],
    shapes: [
      { type: "ellipse", cx: 44, cy: 51, rx: 5.5, ry: 4 },
      { type: "ellipse", cx: 56, cy: 51, rx: 5.5, ry: 4 },
    ]},
  { id: "hamstrings", label: "Hamstrings", tooltipPos: [50, 56],
    shapes: [
      { type: "ellipse", cx: 43, cy: 62, rx: 4.5, ry: 8 },
      { type: "ellipse", cx: 57, cy: 62, rx: 4.5, ry: 8 },
    ]},
  { id: "calves", label: "Calves", tooltipPos: [50, 72],
    shapes: [
      { type: "ellipse", cx: 42, cy: 78, rx: 3.5, ry: 6 },
      { type: "ellipse", cx: 58, cy: 78, rx: 3.5, ry: 6 },
    ]},
];

function Tooltip({ x, y, label }: { x: number; y: number; label: string }) {
  const w = label.length * 1.4 + 4;
  return (
    <g className="pointer-events-none">
      <rect x={x - w / 2} y={y - 4} width={w} height={3.5} rx={1}
        fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.15}
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }} />
      <polygon points={`${x - 0.8},${y - 0.5} ${x + 0.8},${y - 0.5} ${x},${y + 0.3}`} fill="hsl(var(--popover))" />
      <text x={x} y={y - 1.8} textAnchor="middle" fill="hsl(var(--popover-foreground))"
        fontSize="2" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.03">
        {label}
      </text>
    </g>
  );
}

function BodyMapView({ imageSrc, regions, highlightedMuscles, onMuscleClick, selectedMuscle, className = "", testId }: BodyMapProps & { imageSrc: string; regions: OverlayRegion[]; testId: string }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const getOpacity = useCallback((region: string): number => {
    const isHov = hovered === region;
    if (selectedMuscle === region) return 0.55;
    if (highlightedMuscles.includes(region)) return isHov ? 0.45 : 0.35;
    return isHov ? 0.12 : 0;
  }, [highlightedMuscles, selectedMuscle, hovered]);

  const getColor = useCallback((region: string): string => {
    if (selectedMuscle === region) return "hsl(var(--primary))";
    if (highlightedMuscles.includes(region)) return "hsl(var(--primary))";
    return "hsl(var(--muted-foreground))";
  }, [highlightedMuscles, selectedMuscle]);

  const onE = useCallback((r: string) => () => setHovered(r), []);
  const onL = useCallback(() => setHovered(null), []);
  const onC = useCallback((r: string) => () => onMuscleClick?.(r), [onMuscleClick]);

  return (
    <div className={`relative inline-block ${className}`} style={{ maxWidth: 160 }} data-testid={testId}>
      <img src={imageSrc} alt="" className="w-full h-auto block rounded-lg" draggable={false}
        style={{ imageRendering: "auto" }} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <filter id={`glow-${testId}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.5" result="b"/>
            <feFlood floodColor="hsl(var(--primary))" floodOpacity="0.5"/>
            <feComposite in2="b" operator="in"/>
            <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {regions.map(region => {
          const opacity = getOpacity(region.id);
          const color = getColor(region.id);
          const isSelected = selectedMuscle === region.id;
          return (
            <g key={region.id}
               data-testid={`region-${region.id}`}
               style={{ cursor: "pointer", transition: "opacity 0.25s ease" }}
               opacity={opacity}
               filter={isSelected ? `url(#glow-${testId})` : "none"}
               onMouseEnter={onE(region.id)}
               onMouseLeave={onL}
               onClick={onC(region.id)}>
              {region.shapes.map((shape, i) => {
                if (shape.type === "ellipse") {
                  return <ellipse key={i} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={color} />;
                }
                return <rect key={i} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx || 0} fill={color} />;
              })}
            </g>
          );
        })}
        {hovered && (() => {
          const region = regions.find(r => r.id === hovered);
          if (!region) return null;
          return <Tooltip x={region.tooltipPos[0]} y={region.tooltipPos[1]} label={region.label} />;
        })()}
      </svg>
    </div>
  );
}

export function BodyMapFront(props: BodyMapProps) {
  return <BodyMapView {...props} imageSrc="/images/body-front.png" regions={frontRegions} testId="body-map-front" />;
}

export function BodyMapBack(props: BodyMapProps) {
  return <BodyMapView {...props} imageSrc="/images/body-back.png" regions={backRegions} testId="body-map-back" />;
}

export function BodyMap(props: BodyMapProps & { view?: "front" | "back" | "both" }) {
  const { view = "both", ...mapProps } = props;

  if (view === "front") return <BodyMapFront {...mapProps} />;
  if (view === "back") return <BodyMapBack {...mapProps} />;

  return (
    <div className="flex justify-center items-start gap-4 py-2">
      <div className="text-center">
        <p className="text-[9px] font-semibold text-muted-foreground/50 mb-1.5 uppercase tracking-[0.15em]">Front</p>
        <BodyMapFront {...mapProps} />
      </div>
      <div className="text-center">
        <p className="text-[9px] font-semibold text-muted-foreground/50 mb-1.5 uppercase tracking-[0.15em]">Back</p>
        <BodyMapBack {...mapProps} />
      </div>
    </div>
  );
}
