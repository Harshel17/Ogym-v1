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
  { id: "shoulders", label: "Delts", tooltipPos: [50, 17],
    shapes: [
      { type: "ellipse", cx: 30, cy: 21.5, rx: 7.5, ry: 3.5 },
      { type: "ellipse", cx: 70, cy: 21.5, rx: 7.5, ry: 3.5 },
    ]},
  { id: "chest", label: "Chest", tooltipPos: [50, 26],
    shapes: [
      { type: "ellipse", cx: 41, cy: 28, rx: 10, ry: 6 },
      { type: "ellipse", cx: 59, cy: 28, rx: 10, ry: 6 },
    ]},
  { id: "biceps", label: "Biceps", tooltipPos: [22, 30],
    shapes: [
      { type: "ellipse", cx: 24, cy: 32, rx: 3.5, ry: 7 },
      { type: "ellipse", cx: 76, cy: 32, rx: 3.5, ry: 7 },
    ]},
  { id: "forearms", label: "Forearms", tooltipPos: [20, 44],
    shapes: [
      { type: "ellipse", cx: 21, cy: 47, rx: 3, ry: 7 },
      { type: "ellipse", cx: 79, cy: 47, rx: 3, ry: 7 },
    ]},
  { id: "abs", label: "Abs", tooltipPos: [50, 38],
    shapes: [
      { type: "rect", x: 41, y: 35, w: 18, h: 14, rx: 3 },
    ]},
  { id: "obliques", label: "Obliques", tooltipPos: [36, 38],
    shapes: [
      { type: "ellipse", cx: 37, cy: 41, rx: 3.5, ry: 6 },
      { type: "ellipse", cx: 63, cy: 41, rx: 3.5, ry: 6 },
    ]},
  { id: "quads", label: "Quads", tooltipPos: [50, 58],
    shapes: [
      { type: "ellipse", cx: 42, cy: 63, rx: 6, ry: 11 },
      { type: "ellipse", cx: 58, cy: 63, rx: 6, ry: 11 },
    ]},
  { id: "calves", label: "Calves", tooltipPos: [50, 78],
    shapes: [
      { type: "ellipse", cx: 42, cy: 82, rx: 4, ry: 8 },
      { type: "ellipse", cx: 58, cy: 82, rx: 4, ry: 8 },
    ]},
];

const backRegions: OverlayRegion[] = [
  { id: "shoulders", label: "Delts", tooltipPos: [50, 17],
    shapes: [
      { type: "ellipse", cx: 30, cy: 21.5, rx: 7.5, ry: 3.5 },
      { type: "ellipse", cx: 70, cy: 21.5, rx: 7.5, ry: 3.5 },
    ]},
  { id: "upper-back", label: "Upper Back", tooltipPos: [50, 26],
    shapes: [
      { type: "rect", x: 34, y: 23, w: 32, h: 13, rx: 4 },
    ]},
  { id: "lats", label: "Lats", tooltipPos: [36, 38],
    shapes: [
      { type: "ellipse", cx: 38, cy: 39, rx: 6, ry: 7 },
      { type: "ellipse", cx: 62, cy: 39, rx: 6, ry: 7 },
    ]},
  { id: "triceps", label: "Triceps", tooltipPos: [22, 30],
    shapes: [
      { type: "ellipse", cx: 24, cy: 32, rx: 3.5, ry: 7 },
      { type: "ellipse", cx: 76, cy: 32, rx: 3.5, ry: 7 },
    ]},
  { id: "glutes", label: "Glutes", tooltipPos: [50, 48],
    shapes: [
      { type: "ellipse", cx: 43, cy: 52, rx: 7, ry: 5.5 },
      { type: "ellipse", cx: 57, cy: 52, rx: 7, ry: 5.5 },
    ]},
  { id: "hamstrings", label: "Hamstrings", tooltipPos: [50, 60],
    shapes: [
      { type: "ellipse", cx: 42, cy: 65, rx: 5.5, ry: 10 },
      { type: "ellipse", cx: 58, cy: 65, rx: 5.5, ry: 10 },
    ]},
  { id: "calves", label: "Calves", tooltipPos: [50, 78],
    shapes: [
      { type: "ellipse", cx: 42, cy: 82, rx: 4.5, ry: 8 },
      { type: "ellipse", cx: 58, cy: 82, rx: 4.5, ry: 8 },
    ]},
];

function Tooltip({ x, y, label }: { x: number; y: number; label: string }) {
  const w = label.length * 1.8 + 5;
  return (
    <g className="pointer-events-none">
      <rect x={x - w / 2} y={y - 5} width={w} height={4.5} rx={1.5}
        fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.2}
        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" }} />
      <polygon points={`${x - 1},${y - 0.5} ${x + 1},${y - 0.5} ${x},${y + 0.5}`} fill="hsl(var(--popover))" />
      <text x={x} y={y - 2.2} textAnchor="middle" fill="hsl(var(--popover-foreground))"
        fontSize="2.5" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.05">
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
      <svg viewBox="0 0 100 133" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
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
