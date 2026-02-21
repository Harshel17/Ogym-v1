import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Trophy, Dumbbell, Target, Zap, ChevronRight, Loader2,
  ArrowLeft, ArrowRight, Activity, Medal, Brain, Waves, Swords, Crosshair,
  Check, X, AlertTriangle, ChevronDown, ChevronUp, BarChart3,
  TrendingUp, TrendingDown, Minus, Timer, Flame, PieChart,
  Power, History, Clock, Play, Star,
  type LucideIcon
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { SportProfile, SportProgram, MatchLog } from "@shared/schema";


const SPORT_COLORS: Record<string, { primary: string; gradient: string; bg: string; ring: string; lightBg: string; accent: string; iconBg: string; text: string; hex: string; glow: string }> = {
  "Football (Soccer)": {
    primary: "text-emerald-500", gradient: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-500", ring: "ring-emerald-500/30", lightBg: "bg-emerald-500/10",
    accent: "border-emerald-500/30", iconBg: "bg-emerald-500/20", text: "text-emerald-400",
    hex: "#10b981", glow: "rgba(16,185,129,0.15)",
  },
  "Basketball": {
    primary: "text-orange-500", gradient: "from-orange-500 to-amber-600",
    bg: "bg-orange-500", ring: "ring-orange-500/30", lightBg: "bg-orange-500/10",
    accent: "border-orange-500/30", iconBg: "bg-orange-500/20", text: "text-orange-400",
    hex: "#f97316", glow: "rgba(249,115,22,0.15)",
  },
  "Tennis": {
    primary: "text-lime-500", gradient: "from-lime-500 to-green-600",
    bg: "bg-lime-500", ring: "ring-lime-500/30", lightBg: "bg-lime-500/10",
    accent: "border-lime-500/30", iconBg: "bg-lime-500/20", text: "text-lime-400",
    hex: "#84cc16", glow: "rgba(132,204,22,0.15)",
  },
  "Swimming": {
    primary: "text-cyan-500", gradient: "from-cyan-500 to-blue-600",
    bg: "bg-cyan-500", ring: "ring-cyan-500/30", lightBg: "bg-cyan-500/10",
    accent: "border-cyan-500/30", iconBg: "bg-cyan-500/20", text: "text-cyan-400",
    hex: "#06b6d4", glow: "rgba(6,182,212,0.15)",
  },
  "Boxing": {
    primary: "text-red-500", gradient: "from-red-500 to-rose-600",
    bg: "bg-red-500", ring: "ring-red-500/30", lightBg: "bg-red-500/10",
    accent: "border-red-500/30", iconBg: "bg-red-500/20", text: "text-red-400",
    hex: "#ef4444", glow: "rgba(239,68,68,0.15)",
  },
  "MMA": {
    primary: "text-violet-500", gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-500", ring: "ring-violet-500/30", lightBg: "bg-violet-500/10",
    accent: "border-violet-500/30", iconBg: "bg-violet-500/20", text: "text-violet-400",
    hex: "#8b5cf6", glow: "rgba(139,92,246,0.15)",
  },
  "Cricket": {
    primary: "text-blue-500", gradient: "from-blue-500 to-indigo-600",
    bg: "bg-blue-500", ring: "ring-blue-500/30", lightBg: "bg-blue-500/10",
    accent: "border-blue-500/30", iconBg: "bg-blue-500/20", text: "text-blue-400",
    hex: "#3b82f6", glow: "rgba(59,130,246,0.15)",
  },
  "Volleyball": {
    primary: "text-yellow-500", gradient: "from-yellow-500 to-orange-600",
    bg: "bg-yellow-500", ring: "ring-yellow-500/30", lightBg: "bg-yellow-500/10",
    accent: "border-yellow-500/30", iconBg: "bg-yellow-500/20", text: "text-yellow-400",
    hex: "#eab308", glow: "rgba(234,179,8,0.15)",
  },
};

const DEFAULT_COLORS = SPORT_COLORS["Basketball"];

const SPORT_ICONS: Record<string, LucideIcon> = {
  "Football (Soccer)": Trophy,
  "Basketball": Target,
  "Tennis": Crosshair,
  "Swimming": Waves,
  "Boxing": Swords,
  "MMA": Swords,
  "Cricket": Dumbbell,
  "Volleyball": Medal,
};

const ROLE_DESCRIPTIONS: Record<string, Record<string, string>> = {
  "Football (Soccer)": {
    "Striker": "Goal scoring, finishing, positioning",
    "Midfielder": "Playmaking, passing, game control",
    "Defender": "Tackling, marking, aerial duels",
    "Goalkeeper": "Shot stopping, distribution, reflexes",
    "Winger": "Pace, crossing, 1v1 dribbling",
    "Full-back": "Overlapping runs, defending, stamina",
  },
  "Basketball": {
    "Point Guard": "Ball handling, court vision, leadership",
    "Shooting Guard": "Scoring, three-pointers, off-ball movement",
    "Small Forward": "Versatility, scoring, defense",
    "Power Forward": "Rebounding, post play, mid-range",
    "Center": "Rim protection, rebounds, paint scoring",
  },
  "Tennis": {
    "Baseline Player": "Groundstrokes, consistency, endurance",
    "Serve-and-Volley": "Net play, aggressive serves, reflexes",
    "All-Court Player": "Versatility, shot selection, adaptability",
    "Counterpuncher": "Defense, consistency, patience",
  },
  "Swimming": {
    "Sprinter": "Explosive speed, power, starts",
    "Distance Swimmer": "Endurance, pacing, efficiency",
    "Medley Swimmer": "All strokes, transitions, versatility",
    "Open Water": "Navigation, drafting, endurance",
  },
  "Boxing": {
    "Outfighter": "Range, jab, footwork, counter-punching",
    "Slugger": "Power, knockout punches, aggression",
    "Swarmer": "Pressure, combinations, conditioning",
    "Boxer-Puncher": "Versatility, power + technique",
  },
  "MMA": {
    "Striker": "Standup fighting, kicks, distance management",
    "Grappler": "Submissions, ground control, takedowns",
    "Wrestler": "Takedowns, cage control, top position",
    "Well-Rounded": "Balanced skills across all ranges",
  },
  "Cricket": {
    "Batsman": "Shot selection, timing, run scoring",
    "Bowler": "Pace, swing, accuracy, variations",
    "All-Rounder": "Bat + bowl, versatility, match impact",
    "Wicket-Keeper": "Catching, stumping, agility",
  },
  "Volleyball": {
    "Setter": "Decision making, ball placement, leadership",
    "Outside Hitter": "Attacking, passing, all-around skills",
    "Middle Blocker": "Blocking, quick attacks, timing",
    "Libero": "Defense, passing, serve receive",
    "Opposite": "Power hitting, blocking, scoring",
  },
};

const SPORTS_DATA: Record<string, { roles: string[]; skills: Record<string, string[]> }> = {
  "Football (Soccer)": {
    roles: ["Striker", "Midfielder", "Defender", "Goalkeeper", "Winger", "Full-back"],
    skills: {
      "Ball Control": ["First Touch", "Dribbling", "Ball Juggling", "Close Control"],
      "Shooting": ["Power Shots", "Finesse Shots", "Volleys", "Free Kicks"],
      "Passing": ["Short Passing", "Long Passing", "Through Balls", "Crossing"],
      "Defense": ["Tackling", "Positioning", "Marking", "Interceptions"],
      "Physical": ["Speed & Agility", "Stamina", "Strength", "Jumping"],
    },
  },
  "Basketball": {
    roles: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"],
    skills: {
      "Shooting": ["Three-Point", "Mid-Range", "Free Throws", "Layups"],
      "Ball Handling": ["Crossovers", "Behind the Back", "Hesitation", "Speed Dribble"],
      "Defense": ["On-Ball Defense", "Help Defense", "Shot Blocking", "Steals"],
      "Playmaking": ["Court Vision", "Pick and Roll", "Fast Break", "Entry Passes"],
      "Physical": ["Vertical Jump", "Lateral Quickness", "Core Strength", "Conditioning"],
    },
  },
  "Tennis": {
    roles: ["Baseline Player", "Serve-and-Volley", "All-Court Player", "Counterpuncher"],
    skills: {
      "Groundstrokes": ["Forehand", "Backhand", "Topspin", "Slice"],
      "Serve": ["First Serve Power", "Second Serve Spin", "Placement", "Serve & Volley"],
      "Net Play": ["Volleys", "Overheads", "Drop Shots", "Approach Shots"],
      "Movement": ["Footwork", "Court Coverage", "Split Step", "Recovery"],
      "Mental": ["Match Strategy", "Pressure Points", "Consistency", "Shot Selection"],
    },
  },
  "Swimming": {
    roles: ["Sprinter", "Distance Swimmer", "Medley Swimmer", "Open Water"],
    skills: {
      "Freestyle": ["Stroke Technique", "Breathing Pattern", "Kick Efficiency", "Turns"],
      "Backstroke": ["Body Position", "Arm Pull", "Kick Technique", "Start & Turns"],
      "Breaststroke": ["Pull & Kick Timing", "Streamline", "Turns", "Pullouts"],
      "Butterfly": ["Undulation", "Arm Recovery", "Kick Rhythm", "Breathing"],
      "Endurance": ["Aerobic Base", "Threshold Training", "Race Pacing", "Recovery"],
    },
  },
  "Boxing": {
    roles: ["Outfighter", "Slugger", "Swarmer", "Boxer-Puncher"],
    skills: {
      "Punching": ["Jab", "Cross", "Hook", "Uppercut"],
      "Defense": ["Head Movement", "Footwork", "Blocking", "Parrying"],
      "Combinations": ["1-2 Combo", "Body Work", "Counter Punching", "Feints"],
      "Conditioning": ["Cardio Endurance", "Power Training", "Core Strength", "Speed Drills"],
      "Ring IQ": ["Distance Management", "Angles", "Pressure Fighting", "Round Strategy"],
    },
  },
  "MMA": {
    roles: ["Striker", "Grappler", "Wrestler", "Well-Rounded"],
    skills: {
      "Striking": ["Boxing", "Kickboxing", "Elbows & Knees", "Clinch Work"],
      "Wrestling": ["Takedowns", "Takedown Defense", "Cage Control", "Ground & Pound"],
      "Jiu-Jitsu": ["Submissions", "Guard Play", "Sweeps", "Escapes"],
      "Conditioning": ["Cardio", "Explosive Power", "Grip Strength", "Recovery"],
      "Strategy": ["Fight IQ", "Distance Management", "Transitions", "Game Planning"],
    },
  },
  "Cricket": {
    roles: ["Batsman", "Bowler", "All-Rounder", "Wicket-Keeper"],
    skills: {
      "Batting": ["Drive", "Pull Shot", "Cut Shot", "Sweep"],
      "Bowling": ["Pace", "Swing", "Spin", "Yorkers"],
      "Fielding": ["Catching", "Throwing", "Ground Fielding", "Diving"],
      "Fitness": ["Speed & Agility", "Stamina", "Flexibility", "Core Strength"],
      "Mental": ["Concentration", "Match Awareness", "Pressure Handling", "Shot Selection"],
    },
  },
  "Volleyball": {
    roles: ["Setter", "Outside Hitter", "Middle Blocker", "Libero", "Opposite"],
    skills: {
      "Attacking": ["Spike Technique", "Back Row Attack", "Tip/Roll Shot", "Approach"],
      "Setting": ["Hand Setting", "Jump Setting", "Back Setting", "Quick Sets"],
      "Blocking": ["Timing", "Read Blocking", "Commit Block", "Transition"],
      "Passing": ["Platform Pass", "Serve Receive", "Dig", "Pancake"],
      "Serving": ["Float Serve", "Jump Serve", "Topspin Serve", "Placement"],
    },
  },
};

const FITNESS_TEST_QUESTIONS = [
  { id: "training_frequency", question: "How many days per week do you currently train?", options: ["1-2 days", "3-4 days", "5-6 days", "Every day"], scores: [10, 20, 25, 20] },
  { id: "sport_experience", question: "How long have you played this sport?", options: ["Less than 1 year", "1-3 years", "3-5 years", "5+ years"], scores: [5, 10, 15, 20] },
  { id: "injury_history", question: "Any current injuries or limitations?", options: ["None", "Minor (doesn't affect training)", "Moderate (some limitations)", "Recovering from major injury"], scores: [15, 10, 5, 0] },
  { id: "endurance", question: "How long can you sustain intense activity?", options: ["Under 15 minutes", "15-30 minutes", "30-60 minutes", "Over 60 minutes"], scores: [5, 10, 15, 20] },
  { id: "goal_commitment", question: "How committed are you to improving?", options: ["Casual interest", "Moderate - want to improve", "Serious - dedicated training", "Competitive - aiming for excellence"], scores: [5, 10, 15, 20] },
];

function SportIcon({ sport, className = "w-6 h-6" }: { sport: string; className?: string }) {
  const Icon = SPORT_ICONS[sport] || Trophy;
  return <Icon className={className} />;
}

function getColors(sport: string) {
  return SPORT_COLORS[sport] || DEFAULT_COLORS;
}

function useCountUp(target: number, duration = 800, enabled = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled || target <= 0) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    const animate = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);
  return value;
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'} ${className}`}>
      {children}
    </div>
  );
}

function PageShell({ children, sport, noPad }: { children: React.ReactNode; sport?: string; noPad?: boolean }) {
  const c = getColors(sport || "");
  return (
    <div className={`min-h-screen bg-[#0c0c14] ${noPad ? '' : 'p-4 pb-24'}`} data-testid="sports-mode-page">
      <div className={`absolute inset-0 bg-gradient-to-b ${c.gradient} opacity-[0.04] pointer-events-none`} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(ellipse, ${c.hex || '#f97316'}08 0%, transparent 70%)` }} />
      <div className={`relative max-w-lg mx-auto ${noPad ? 'p-4 pb-24' : 'pt-2'}`}>
        {children}
      </div>
    </div>
  );
}

function BackButton({ onClick, label = "Back", testId = "sports-back" }: { onClick: () => void; label?: string; testId?: string }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition-colors mb-4 active:scale-95" data-testid={testId}>
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function ScoreGauge({ score, size = 120, sport }: { score: number; size?: number; sport: string }) {
  const c = getColors(sport);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animScore = useCountUp(score, 1500, true);
  const offset = circumference - (animScore / 100) * circumference;
  const center = size / 2;
  const getLabel = (s: number) => {
    if (s >= 80) return "Elite";
    if (s >= 60) return "Advanced";
    if (s >= 40) return "Intermediate";
    return "Beginner";
  };

  return (
    <div className="relative inline-flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: `0 0 40px ${c.glow}, 0 0 80px ${c.glow}` }} />
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-white/[0.06]" />
          <circle cx={center} cy={center} r={radius} fill="none" stroke={c.hex} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${c.hex}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white tracking-tight">{animScore}</span>
          <span className="text-[11px] text-zinc-400 font-medium">{getLabel(score)}</span>
        </div>
      </div>
    </div>
  );
}

interface AnalyticsData {
  impactScore: number;
  totalExercises: number;
  sportExercises: number;
  muscleDistribution: Record<string, { total: number; sport: number }>;
  volumeChange: { removedSets: number; removedReps: number; addedSets: number; addedReps: number; netSets: number; netReps: number };
  completionRate: number | null;
  completedSportExercises: number;
  totalSportExerciseOccurrences: number;
  daysActive: number;
}

function ImpactRing({ value, size = 72, strokeWidth = 6, sport }: { value: number; size?: number; strokeWidth?: number; sport?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const c = getColors(sport || "");
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-white/10" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={c.hex} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease", filter: `drop-shadow(0 0 4px ${c.hex}40)` }} />
      </svg>
      <span className="absolute text-sm font-bold text-white">{value}%</span>
    </div>
  );
}

function MuscleBar({ name, total, sport: sportCount, sportName }: { name: string; total: number; sport: number; sportName?: string }) {
  const pct = total > 0 ? Math.round((sportCount / total) * 100) : 0;
  const c = getColors(sportName || "");
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-zinc-500 w-16 truncate text-right">{name}</span>
      <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c.hex}, ${c.hex}80)` }} />
      </div>
      <span className="text-[10px] font-medium text-zinc-500 w-8">{sportCount}/{total}</span>
    </div>
  );
}

function SportModCard({ program, isExpanded, onToggle, onDelete, deleteDisabled }: {
  program: SportProgram; isExpanded: boolean; onToggle: () => void; onDelete: () => void; deleteDisabled: boolean;
}) {
  const planData = program.programPlan as any;
  const changes = planData?.changes || [];
  const analysis = program.aiAnalysis as any;
  const totalAdded = changes.reduce((sum: number, c: any) => sum + (c.additions?.length || 0), 0);
  const totalRemoved = changes.reduce((sum: number, c: any) => sum + (c.removals?.length || 0), 0);
  const daysAffected = changes.length;
  const c = getColors(program.sport);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/sport/programs', program.id, 'analytics'],
    enabled: isExpanded,
  });

  const [showDayDetails, setShowDayDetails] = useState(false);

  return (
    <div className={`rounded-2xl overflow-hidden backdrop-blur-sm transition-all duration-300 border ${isExpanded ? `border-white/[0.12] ring-1 ${c.ring}` : 'border-white/[0.08]'}`}
      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))' }}
      data-testid={`mod-card-${program.id}`}>
      <div className="w-full text-left p-4 flex items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onToggle} data-testid={`mod-toggle-${program.id}`}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
            <SportIcon sport={program.sport} className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{program.skillName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">{program.skillCategory}</span>
              <span className={`text-[11px] font-medium ${c.text}`}>{program.priority}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="text-red-400/60" onClick={onDelete} disabled={deleteDisabled} data-testid={`remove-mod-${program.id}`}>
            <X className="w-4 h-4" />
          </Button>
          <div className="cursor-pointer p-1" onClick={onToggle} data-testid={`mod-chevron-${program.id}`}>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-white/[0.06] px-4 pb-4 space-y-4">
          {analyticsLoading ? (
            <div className="pt-4 space-y-3">
              <Skeleton className="h-20 w-full rounded-xl bg-white/5" />
              <Skeleton className="h-16 w-full rounded-xl bg-white/5" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 pt-3">
                <ImpactRing value={analytics?.impactScore || 0} sport={program.sport} />
                <div className="flex-1 space-y-1.5">
                  <p className="text-xs font-semibold text-zinc-300">Impact Score</p>
                  <p className="text-[11px] text-zinc-500">{analytics?.sportExercises || 0} of {analytics?.totalExercises || 0} exercises sport-targeted</p>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1"><Timer className="w-3 h-3 text-blue-400" /><span className="text-[11px] font-medium text-zinc-400">{analytics?.daysActive || 0}d active</span></div>
                    {analytics?.completionRate !== null && analytics?.completionRate !== undefined && (
                      <div className="flex items-center gap-1"><Flame className={`w-3 h-3`} style={{ color: c.hex }} /><span className="text-[11px] font-medium text-zinc-400">{analytics.completionRate}% done</span></div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: daysAffected, label: "Days", color: "text-blue-400" },
                  { value: totalAdded, label: "Added", color: "text-green-400" },
                  { value: totalRemoved, label: "Swapped", color: "text-red-400" },
                  { value: `${program.priority}%`, label: "Priority", color: c.text },
                ].map((stat, i) => (
                  <div key={i} className="rounded-xl p-2.5 text-center border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {analytics?.volumeChange && (analytics.volumeChange.removedSets > 0 || analytics.volumeChange.addedSets > 0) && (
                <div className="rounded-xl border border-white/[0.06] p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-xs font-semibold text-zinc-400 mb-2 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> Volume Change</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Sets", val: analytics.volumeChange.netSets },
                      { label: "Total Reps", val: analytics.volumeChange.netReps },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[10px] text-zinc-500 mb-1">{item.label}</p>
                        <div className="flex items-center gap-1.5">
                          {item.val > 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : item.val < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-zinc-500" />}
                          <span className={`text-sm font-bold ${item.val > 0 ? 'text-green-400' : item.val < 0 ? 'text-red-400' : 'text-zinc-500'}`}>{item.val > 0 ? '+' : ''}{item.val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics?.muscleDistribution && Object.keys(analytics.muscleDistribution).length > 0 && (
                <div className="rounded-xl border border-white/[0.06] p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-xs font-semibold text-zinc-400 mb-2.5 flex items-center gap-1"><PieChart className="w-3.5 h-3.5" /> Muscle Distribution</p>
                  <div className="space-y-1.5">
                    {Object.entries(analytics.muscleDistribution).sort((a, b) => b[1].sport - a[1].sport).slice(0, 6).map(([muscle, data]) => (
                      <MuscleBar key={muscle} name={muscle} total={data.total} sport={data.sport} sportName={program.sport} />
                    ))}
                  </div>
                </div>
              )}

              {analytics?.completionRate !== null && analytics?.completionRate !== undefined && (
                <div className="rounded-xl p-3 border border-white/[0.06]" style={{ background: `linear-gradient(135deg, ${c.hex}08, ${c.hex}04)` }}>
                  <p className={`text-xs font-semibold mb-2 flex items-center gap-1`} style={{ color: c.hex }}><Flame className="w-3.5 h-3.5" /> Completion</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, analytics.completionRate)}%`, background: `linear-gradient(90deg, ${c.hex}, ${c.hex}80)` }} />
                    </div>
                    <span className="text-sm font-bold w-10 text-right" style={{ color: c.hex }}>{analytics.completionRate}%</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">{analytics.completedSportExercises} of {analytics.totalSportExerciseOccurrences} exercises completed</p>
                </div>
              )}

              {analysis?.targetMuscles?.length > 0 && (
                <div className="p-3 rounded-xl border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: c.hex }}><Target className="w-3.5 h-3.5" /> Target Muscles</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.targetMuscles.map((m: string) => (
                      <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">{m}</span>
                    ))}
                  </div>
                  {analysis.whyTheseMuscles && <p className="text-[11px] text-zinc-500 mt-1.5">{analysis.whyTheseMuscles}</p>}
                </div>
              )}

              <div>
                <button className="w-full flex items-center justify-between py-2" onClick={() => setShowDayDetails(!showDayDetails)} data-testid={`day-details-toggle-${program.id}`}>
                  <p className="text-xs font-semibold text-zinc-400 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Day-by-Day Changes</p>
                  {showDayDetails ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                </button>
                {showDayDetails && (
                  <div className="space-y-2 mt-1">
                    {changes.map((change: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-white/[0.06] p-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <p className="text-xs font-semibold text-zinc-300 mb-2">Day {change.dayIndex + 1}</p>
                        {change.removals?.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {change.removals.map((r: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0"><X className="w-2.5 h-2.5 text-red-400" /></div>
                                <span className="text-zinc-500 line-through flex-1">{r.exerciseName}</span>
                                <span className="text-[9px] text-zinc-600">{r.muscleType}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {change.additions?.length > 0 && (
                          <div className="space-y-1">
                            {change.additions.map((a: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0"><Zap className="w-2.5 h-2.5 text-green-400" /></div>
                                <span className="text-zinc-200 font-medium flex-1">{a.exerciseName}</span>
                                <span className="text-zinc-500 text-[10px]">{a.sets}x{a.reps}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {program.createdAt && (
                <p className="text-[10px] text-zinc-600 text-center pt-1">Applied on {new Date(program.createdAt).toLocaleDateString()}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Step = "loading" | "select-sport" | "select-role" | "fitness-test" | "fitness-reveal" | "select-skill" | "previewing" | "preview-results" | "no-cycle" | "applying" | "dashboard";

export default function SportsModePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("loading");
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [testAnswers, setTestAnswers] = useState<Record<string, number>>({});
  const [currentTestQ, setCurrentTestQ] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedPriority, setSelectedPriority] = useState<number | null>(null);
  const [expandedModId, setExpandedModId] = useState<number | null>(null);
  const [fitnessScore, setFitnessScore] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<SportProfile | null>({ queryKey: ["/api/sport/profile"] });
  const { data: programs, isLoading: programsLoading } = useQuery<SportProgram[]>({ queryKey: ["/api/sport/programs"] });
  const { data: matchLogs } = useQuery<MatchLog[]>({ queryKey: ["/api/match-logs"] });
  const { data: profileHistory } = useQuery<SportProfile[]>({ queryKey: ["/api/sport/profile/history"] });

  const createProfile = useMutation({
    mutationFn: async (data: { sport: string; role: string; fitnessScore?: number; testAnswers?: any }) => {
      const res = await apiRequest("POST", "/api/sport/profile", data);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sport/profile"] }); },
  });

  const previewMods = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/sport/preview-modifications", data); return res.json(); },
    onSuccess: (result) => { setPreviewData(result); setStep(result.noCycle ? "no-cycle" : "preview-results"); },
    onError: () => { toast({ title: "Error", description: "Failed to generate preview. Please try again.", variant: "destructive" }); setStep("select-skill"); },
  });

  const applyMods = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/sport/apply-modifications", data); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/calendar/enhanced"] });
      toast({ title: "Workout Updated!", description: "Your cycle has been modified with sport-targeted exercises." });
      setStep("dashboard");
    },
    onError: () => { toast({ title: "Error", description: "Failed to apply changes.", variant: "destructive" }); },
  });

  const createFullCycle = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/sport/create-full-cycle", data); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/calendar/enhanced"] });
      toast({ title: "Workout Cycle Created!", description: "Your sport-focused workout cycle is ready." });
      setStep("dashboard");
    },
    onError: () => { toast({ title: "Error", description: "Failed to create cycle.", variant: "destructive" }); },
  });

  const deleteProgram = useMutation({
    mutationFn: async (id: number) => { const res = await apiRequest("DELETE", `/api/sport/programs/${id}`); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      toast({ title: "Sport modification removed" });
    },
  });

  const endSportProfile = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/sport/profile/end"); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sport/profile/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/calendar/enhanced"] });
      toast({ title: "Sports Mode Ended", description: "Your sport profile has been saved to history." });
      setStep("select-sport");
    },
    onError: () => { toast({ title: "Error", description: "Failed to end sports mode.", variant: "destructive" }); },
  });

  if (profileLoading || programsLoading) {
    if (step === "loading") {
      return (
        <PageShell>
          <div className="space-y-4 pt-8" data-testid="sports-mode-loading">
            <div className="flex justify-center"><Skeleton className="h-20 w-20 rounded-2xl bg-white/5" /></div>
            <Skeleton className="h-6 w-48 mx-auto bg-white/5" />
            <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
            <Skeleton className="h-32 w-full rounded-2xl bg-white/5" />
          </div>
        </PageShell>
      );
    }
  }

  const currentStep = (() => {
    if (step !== "loading") return step;
    if (profile && programs && programs.length > 0) return "dashboard";
    if (profile) return "select-skill";
    return "select-sport";
  })();

  const activeSport = selectedSport || profile?.sport || "";
  const activeRole = selectedRole || profile?.role || "";
  const c = getColors(activeSport);

  const activeMatches = matchLogs?.filter(m => !m.cancelled) || [];
  const totalMatches = activeMatches.length;
  const competitiveMatches = activeMatches.filter(m => m.intensity === "competitive").length;

  const handleSkillSelect = (skill: string) => {
    if (!profile) return;
    setSelectedSkill(skill);
    setStep("previewing");
    previewMods.mutate({ sportProfileId: profile.id, sport: activeSport, role: activeRole, skillCategory: selectedCategory, skillName: skill, fitnessScore: profile.fitnessScore ?? undefined });
  };

  const handleApply = () => {
    if (!profile || !previewData || selectedPriority === null) return;
    const preview = previewData.previews?.find((p: any) => p.priority === selectedPriority);
    if (!preview) return;
    setStep("applying");
    applyMods.mutate({ sportProfileId: profile.id, sport: activeSport, role: activeRole, skillCategory: selectedCategory, skillName: selectedSkill, priority: selectedPriority, changes: preview.changes, analysis: previewData.analysis });
  };

  const handleCreateFullCycle = () => {
    if (!profile) return;
    setStep("applying");
    createFullCycle.mutate({ sportProfileId: profile.id, sport: activeSport, role: activeRole, skillCategory: selectedCategory, skillName: selectedSkill, fitnessScore: profile.fitnessScore ?? undefined });
  };

  // ==================== SELECT SPORT ====================
  if (currentStep === "select-sport") {
    return (
      <PageShell>
        <BackButton onClick={() => navigate("/")} label="Dashboard" testId="back-to-dashboard-from-sport" />

        <FadeIn className="text-center mb-8" data-testid="sports-select-sport">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 mb-5 shadow-2xl shadow-orange-500/25 relative">
            <Trophy className="w-12 h-12 text-white" />
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 to-transparent" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Sports Mode</h1>
          <p className="text-zinc-500 mt-2 text-sm max-w-xs mx-auto">Choose your sport and unlock AI-powered training programs tailored to your position</p>
        </FadeIn>

        <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-3 px-1">Choose Your Sport</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SPORTS_DATA).map(([sport], idx) => {
            const sc = getColors(sport);
            return (
              <FadeIn key={sport} delay={idx * 60}>
                <button
                  onClick={() => { setSelectedSport(sport); setStep("select-role"); }}
                  className="w-full flex flex-col items-center p-5 rounded-2xl border border-white/[0.08] transition-all active:scale-[0.97] group relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}
                  data-testid={`sport-${sport.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `linear-gradient(90deg, ${sc.hex}, ${sc.hex}60)` }} />
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 group-active:scale-110 transition-transform shadow-lg" style={{ background: `linear-gradient(135deg, ${sc.hex}, ${sc.hex}80)` }}>
                    <SportIcon sport={sport} className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-200 text-center leading-tight">{sport}</span>
                </button>
              </FadeIn>
            );
          })}
        </div>

        {profileHistory && profileHistory.length > 0 && (
          <FadeIn delay={500} className="mt-8">
            <button className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] px-1 mb-3 w-full" onClick={() => setShowHistory(!showHistory)} data-testid="toggle-sport-history-select">
              <History className="w-3.5 h-3.5" />
              <span>Past Sports ({profileHistory.length})</span>
              {showHistory ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
            </button>
            {showHistory && (
              <div className="space-y-2">
                {profileHistory.map((past) => {
                  const pc = getColors(past.sport);
                  const startDate = new Date(past.createdAt!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  const endDate = past.endedAt ? new Date(past.endedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Switched";
                  return (
                    <div key={past.id} className="rounded-xl border border-white/[0.06] p-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)' }} data-testid={`history-item-select-${past.id}`}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center opacity-70 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${pc.hex}, ${pc.hex}80)` }}>
                        <SportIcon sport={past.sport} className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-300 truncate">{past.sport}</p>
                        <span className="text-[11px] text-zinc-500">{past.role}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 text-[10px] text-zinc-600"><Clock className="w-3 h-3" /><span>{startDate}</span></div>
                        <div className="text-[10px] text-zinc-600 mt-0.5">to {endDate}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FadeIn>
        )}
      </PageShell>
    );
  }

  // ==================== SELECT ROLE ====================
  if (currentStep === "select-role") {
    const sportData = SPORTS_DATA[selectedSport];
    const roleDescs = ROLE_DESCRIPTIONS[selectedSport] || {};
    return (
      <PageShell sport={selectedSport}>
        <BackButton onClick={() => setStep("select-sport")} testId="back-to-sports" />
        <FadeIn className="text-center mb-6" data-testid="sports-select-role">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
            <SportIcon sport={selectedSport} className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{selectedSport}</h1>
          <p className="text-zinc-500 text-sm mt-1">Select your position or playing style</p>
        </FadeIn>

        <div className="space-y-2.5">
          {sportData?.roles.map((role, idx) => (
            <FadeIn key={role} delay={idx * 70}>
              <button
                onClick={() => { setSelectedRole(role); setCurrentTestQ(0); setTestAnswers({}); setStep("fitness-test"); }}
                className="w-full flex items-center justify-between p-4 rounded-2xl border border-white/[0.08] transition-all active:scale-[0.98] group"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))' }}
                data-testid={`role-${role.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${c.hex}20` }}>
                    <Target className="w-5 h-5" style={{ color: c.hex }} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-zinc-200 block">{role}</span>
                    {roleDescs[role] && <p className="text-[11px] text-zinc-500 mt-0.5">{roleDescs[role]}</p>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </button>
            </FadeIn>
          ))}
        </div>
      </PageShell>
    );
  }

  // ==================== FITNESS TEST ====================
  if (currentStep === "fitness-test") {
    const question = FITNESS_TEST_QUESTIONS[currentTestQ];
    const progress = ((currentTestQ) / FITNESS_TEST_QUESTIONS.length) * 100;
    const stepLabels = ["Training", "Experience", "Health", "Endurance", "Commitment"];

    return (
      <PageShell sport={selectedSport}>
        <BackButton onClick={() => { if (currentTestQ > 0) setCurrentTestQ(currentTestQ - 1); else setStep("select-role"); }} testId="back-from-test" />

        <FadeIn className="text-center mb-5" data-testid="sports-fitness-test">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 shadow-lg shadow-blue-500/20" style={{ background: 'linear-gradient(135deg, #3b82f6, #4f46e5)' }}>
            <Activity className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Fitness Assessment</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Step {currentTestQ + 1} of {FITNESS_TEST_QUESTIONS.length}</p>
        </FadeIn>

        <div className="flex items-center gap-1.5 mb-6">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all duration-500 ${i < currentTestQ ? 'opacity-100' : i === currentTestQ ? 'opacity-100' : 'opacity-30'}`}
                style={{ background: i <= currentTestQ ? `linear-gradient(90deg, ${c.hex}, ${c.hex}80)` : 'rgba(255,255,255,0.1)' }} />
              <p className={`text-[8px] text-center mt-1 transition-colors ${i === currentTestQ ? 'text-zinc-300 font-semibold' : 'text-zinc-600'}`}>{label}</p>
            </div>
          ))}
        </div>

        <FadeIn key={currentTestQ}>
          <div className="rounded-2xl border border-white/[0.08] p-5 mb-4" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' }}>
            <h2 className="text-base font-semibold text-white mb-4">{question.question}</h2>
            <div className="space-y-2.5">
              {question.options.map((option, idx) => {
                const isSelected = testAnswers[question.id] === question.scores[idx];
                return (
                  <button
                    key={option}
                    onClick={() => {
                      const newAnswers = { ...testAnswers, [question.id]: question.scores[idx] };
                      setTestAnswers(newAnswers);
                      if (currentTestQ < FITNESS_TEST_QUESTIONS.length - 1) {
                        setTimeout(() => setCurrentTestQ(currentTestQ + 1), 200);
                      } else {
                        const finalScore = Object.values(newAnswers).reduce((sum, s) => sum + s, 0);
                        setFitnessScore(finalScore);
                        createProfile.mutate({ sport: selectedSport, role: selectedRole, fitnessScore: finalScore, testAnswers: newAnswers });
                        setStep("fitness-reveal");
                      }
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all active:scale-[0.98] ${
                      isSelected ? 'border-white/20' : 'border-white/[0.06]'
                    }`}
                    style={{ background: isSelected ? `${c.hex}15` : 'rgba(255,255,255,0.03)' }}
                    data-testid={`test-option-${idx}`}
                  >
                    <span className={isSelected ? 'text-white font-medium' : 'text-zinc-300'}>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </FadeIn>

        <Button variant="ghost" className="w-full text-zinc-500" onClick={() => { createProfile.mutate({ sport: selectedSport, role: selectedRole }); setStep("select-skill"); }} data-testid="skip-test">
          Skip Assessment
        </Button>
      </PageShell>
    );
  }

  // ==================== FITNESS REVEAL ====================
  if (currentStep === "fitness-reveal") {
    return (
      <PageShell sport={selectedSport}>
        <div className="flex items-center justify-center min-h-[70vh]" data-testid="sports-fitness-reveal">
          <FadeIn className="text-center max-w-sm px-4">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
              <SportIcon sport={selectedSport} className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Your Fitness Score</h2>
            <p className="text-sm text-zinc-500 mb-8">{selectedSport} · {selectedRole}</p>

            <ScoreGauge score={fitnessScore} sport={selectedSport} />

            <div className="mt-8 grid grid-cols-3 gap-3">
              {Object.entries(testAnswers).slice(0, 3).map(([key, val], i) => (
                <div key={key} className="rounded-xl p-2.5 text-center border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-lg font-bold text-white">{val}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">{["Training", "Experience", "Health"][i]}</p>
                </div>
              ))}
            </div>

            <Button
              className="w-full mt-8 h-12 text-base rounded-xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}cc)` }}
              onClick={() => setStep("select-skill")}
              data-testid="continue-from-reveal"
            >
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </FadeIn>
        </div>
      </PageShell>
    );
  }

  // ==================== SELECT SKILL ====================
  if (currentStep === "select-skill") {
    const sportData = SPORTS_DATA[activeSport];
    return (
      <PageShell sport={activeSport}>
        <BackButton
          onClick={() => {
            if (selectedCategory) { setSelectedCategory(""); }
            else if (programs && programs.length > 0) { setStep("dashboard"); }
            else { setStep("select-sport"); }
          }}
          label={selectedCategory ? selectedCategory : (programs && programs.length > 0) ? "Dashboard" : "Back"}
          testId="back-from-skills"
        />

        <FadeIn className="text-center mb-6" data-testid="sports-select-skill">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
            <SportIcon sport={activeSport} className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">What would you like to do?</h1>
          <p className="text-sm text-zinc-500 mt-1">Pick a skill to train or just track your matches</p>
          <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: `${c.hex}15`, color: c.hex }}>{activeSport}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-zinc-400">{activeRole}</span>
            {profile?.fitnessScore && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium">Score: {profile.fitnessScore}/100</span>
            )}
          </div>
        </FadeIn>

        {!selectedCategory ? (
          <div className="space-y-2.5">
            <FadeIn>
              <button
                onClick={() => setStep("dashboard")}
                className="w-full flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98]"
                style={{ background: `${c.hex}10`, borderColor: `${c.hex}30` }}
                data-testid="category-just-track"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold" style={{ color: c.hex }}>Just Track</span>
                    <p className="text-xs text-zinc-500">Log matches without training programs</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600" />
              </button>
            </FadeIn>

            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">or improve a skill</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {Object.keys(sportData?.skills || {}).map((category, idx) => (
              <FadeIn key={category} delay={(idx + 1) * 60}>
                <button
                  onClick={() => setSelectedCategory(category)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-white/[0.08] transition-all active:scale-[0.98] group"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))' }}
                  data-testid={`category-${category.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
                      <Dumbbell className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold text-zinc-200">{category}</span>
                      <p className="text-xs text-zinc-500">{sportData?.skills[category]?.length} skills</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-600" />
                </button>
              </FadeIn>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {sportData?.skills[selectedCategory]?.map((skill, idx) => (
              <FadeIn key={skill} delay={idx * 60}>
                <button
                  onClick={() => handleSkillSelect(skill)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl border border-white/[0.08] transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))' }}
                  data-testid={`skill-${skill.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${c.hex}20` }}>
                      <Zap className="w-5 h-5" style={{ color: c.hex }} />
                    </div>
                    <span className="font-semibold text-zinc-200">{skill}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: `${c.hex}10` }}>
                      <Brain className="w-3 h-3" style={{ color: c.hex }} />
                      <span className="text-[10px] font-semibold" style={{ color: c.hex }}>AI</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                  </div>
                </button>
              </FadeIn>
            ))}
          </div>
        )}
      </PageShell>
    );
  }

  // ==================== PREVIEWING / APPLYING ====================
  if (currentStep === "previewing" || currentStep === "applying") {
    return (
      <PageShell sport={activeSport}>
        {currentStep === "previewing" && (
          <BackButton onClick={() => { setStep("select-skill"); setSelectedCategory(""); }} label="Cancel" testId="back-from-previewing" />
        )}
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="sports-previewing">
          <div className="text-center max-w-sm px-4">
            <div className="relative inline-block mb-6">
              <div className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
                <Brain className="w-14 h-14 text-white relative z-10" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
              </div>
              <div className="absolute -inset-4 rounded-[2rem] animate-pulse" style={{ boxShadow: `0 0 60px ${c.glow}, 0 0 120px ${c.glow}` }} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {currentStep === "previewing" ? "Analyzing Your Cycle" : "Applying Changes"}
            </h2>
            <p className="text-zinc-500 mb-6 text-sm">
              {currentStep === "previewing" ? `AI is planning ${selectedSkill} modifications...` : "Updating your workout cycle..."}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ background: c.hex, animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  // ==================== NO CYCLE ====================
  if (currentStep === "no-cycle") {
    return (
      <PageShell sport={activeSport}>
        <BackButton onClick={() => { setStep("select-skill"); setSelectedCategory(""); }} testId="back-from-no-cycle" />
        <FadeIn className="text-center mb-6" data-testid="sports-no-cycle">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-3">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">No Workout Cycle Found</h1>
          <p className="text-zinc-500 text-sm mt-2">
            You need an active workout cycle to modify for <span className="font-semibold" style={{ color: c.hex }}>{selectedSkill}</span>.
          </p>
        </FadeIn>

        <div className="space-y-4">
          <FadeIn delay={100}>
            <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))' }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">Create a workout cycle first</h3>
                  <p className="text-sm text-zinc-500 mt-1">Set up your regular workout cycle, then come back to add sport-specific modifications.</p>
                  <Button className="mt-3" variant="outline" onClick={() => navigate("/workouts")} data-testid="go-to-workouts">
                    Go to Workouts <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          </FadeIn>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-white/10 flex-1" />
            <span className="px-3 text-sm text-zinc-600 bg-[#0c0c14]">or</span>
            <div className="border-t border-white/10 flex-1" />
          </div>

          <FadeIn delay={200}>
            <div className="rounded-2xl p-5 border" style={{ background: `${c.hex}08`, borderColor: `${c.hex}30` }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">Use this as your full workout</h3>
                  <p className="text-sm text-zinc-500 mt-1">AI will create a complete cycle focused on <span className="font-medium" style={{ color: c.hex }}>{selectedSkill}</span> in {activeSport}.</p>
                  <Button
                    className="mt-3 text-white border-0"
                    style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}cc)` }}
                    onClick={handleCreateFullCycle}
                    disabled={createFullCycle.isPending}
                    data-testid="create-full-cycle"
                  >
                    {createFullCycle.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                    Generate Sport Workout Cycle
                  </Button>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </PageShell>
    );
  }

  // ==================== PREVIEW RESULTS ====================
  if (currentStep === "preview-results" && previewData) {
    const previews = previewData.previews || [];
    const cycleInfo = previewData.cycleInfo;
    const analysis = previewData.analysis;

    const priorityLabels: Record<number, { label: string; icon: LucideIcon; desc: string }> = {
      50: { label: "Light", icon: Zap, desc: "Keep most workouts, add a few sport exercises" },
      80: { label: "Moderate", icon: Flame, desc: "Replace most exercises with sport-targeted ones" },
      100: { label: "Full Focus", icon: Star, desc: "Fully rebuild your cycle around this sport goal" },
    };

    return (
      <PageShell sport={activeSport}>
        <BackButton onClick={() => { setStep("select-skill"); setSelectedCategory(""); setSelectedPriority(null); }} testId="back-from-preview" />

        <FadeIn className="text-center mb-5" data-testid="sports-preview-results">
          <h1 className="text-xl font-bold text-white">How much do you want to change?</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Modifying <span className="text-zinc-300">"{cycleInfo?.name}"</span> for <span className="font-medium" style={{ color: c.hex }}>{selectedSkill}</span>
          </p>
        </FadeIn>

        {analysis?.targetMuscles?.length > 0 && (
          <FadeIn delay={100}>
            <div className="mb-4 p-3 rounded-xl border" style={{ background: `${c.hex}08`, borderColor: `${c.hex}25` }}>
              <p className="text-xs font-medium mb-1.5" style={{ color: c.hex }}>Target Muscles</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.targetMuscles.map((m: string) => (
                  <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">{m}</span>
                ))}
              </div>
              {analysis.whyTheseMuscles && <p className="text-xs text-zinc-500 mt-1.5">{analysis.whyTheseMuscles}</p>}
            </div>
          </FadeIn>
        )}

        <div className="space-y-3">
          {previews.map((preview: any, pIdx: number) => {
            const config = priorityLabels[preview.priority] || priorityLabels[50];
            const isSelected = selectedPriority === preview.priority;
            const PriorityIcon = config.icon;

            return (
              <FadeIn key={preview.priority} delay={(pIdx + 1) * 100}>
                <button
                  onClick={() => setSelectedPriority(preview.priority)}
                  className={`w-full text-left rounded-2xl border-2 transition-all active:scale-[0.99]`}
                  style={{
                    borderColor: isSelected ? `${c.hex}50` : 'rgba(255,255,255,0.06)',
                    background: isSelected ? `linear-gradient(135deg, ${c.hex}10, ${c.hex}05)` : 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    boxShadow: isSelected ? `0 0 30px ${c.glow}` : 'none',
                  }}
                  data-testid={`priority-${preview.priority}`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
                          <PriorityIcon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <span className="text-lg font-bold text-white">{preview.priority}%</span>
                          <span className="text-xs ml-1.5" style={{ color: c.hex }}>{config.label}</span>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}80)` }}>
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">{preview.summary || config.desc}</p>

                    <div className="space-y-2">
                      {preview.changes?.map((change: any, idx: number) => {
                        const dayLabel = cycleInfo?.dayLabels?.[change.dayIndex] || `Day ${change.dayIndex + 1}`;
                        return (
                          <div key={idx} className="rounded-xl p-3 border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <p className="text-xs font-semibold text-zinc-300 mb-2">{dayLabel}</p>
                            {change.removals?.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {change.removals.map((r: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <X className="w-3 h-3 text-red-400 flex-shrink-0" />
                                    <span className="text-zinc-500 line-through">{r.exerciseName}</span>
                                    <span className="text-[9px] text-zinc-600 ml-auto">{r.muscleType}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {change.additions?.length > 0 && (
                              <div className="space-y-1">
                                {change.additions.map((a: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                                    <span className="text-zinc-200 font-medium">{a.exerciseName}</span>
                                    <span className="text-zinc-500 ml-auto">{a.sets}x{a.reps}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </button>
              </FadeIn>
            );
          })}
        </div>

        {selectedPriority !== null && (
          <FadeIn className="mt-6 sticky bottom-20 pt-2 pb-2">
            <Button
              className="w-full text-white border-0 h-12 text-base rounded-xl shadow-lg"
              style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}cc)` }}
              onClick={handleApply}
              disabled={applyMods.isPending}
              data-testid="apply-changes"
            >
              {applyMods.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
              Apply {selectedPriority}% Changes
            </Button>
          </FadeIn>
        )}
      </PageShell>
    );
  }

  // ==================== DASHBOARD ====================
  const dashC = getColors(profile?.sport || "");
  const daysSinceStart = profile?.createdAt ? Math.max(1, Math.ceil((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <PageShell sport={profile?.sport}>
      <BackButton onClick={() => navigate("/")} label="Dashboard" testId="back-to-dashboard" />

      <FadeIn className="mb-6" data-testid="sports-dashboard">
        <div className="rounded-2xl overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${dashC.hex}15, ${dashC.hex}05)` }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${dashC.hex}, transparent)`, transform: 'translate(30%, -30%)' }} />
          <div className="p-5 relative">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${dashC.hex}, ${dashC.hex}80)` }}>
                <SportIcon sport={profile?.sport || ""} className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-black text-white tracking-tight">Sports Mode</h1>
                {profile && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: `${dashC.hex}20`, color: dashC.hex }}>
                      {profile.sport}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-zinc-400">{profile.role}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {profile?.fitnessScore && (
                <div className="rounded-xl p-2.5 text-center border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-lg font-black text-white">{profile.fitnessScore}</p>
                  <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">FITNESS</p>
                </div>
              )}
              <div className="rounded-xl p-2.5 text-center border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-lg font-black text-white">{totalMatches}</p>
                <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">MATCHES</p>
              </div>
              <div className="rounded-xl p-2.5 text-center border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-lg font-black text-white">{daysSinceStart}</p>
                <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">DAYS</p>
              </div>
              {!profile?.fitnessScore && (
                <div className="rounded-xl p-2.5 text-center border border-white/[0.06]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-lg font-black" style={{ color: dashC.hex }}>{competitiveMatches}</p>
                  <p className="text-[9px] text-zinc-500 font-semibold mt-0.5">COMPETITIVE</p>
                </div>
              )}
            </div>

            <Button
              onClick={() => { setSelectedCategory(""); setSelectedPriority(null); setStep("select-skill"); }}
              className="w-full text-white border-0 rounded-xl h-12 shadow-lg text-sm font-semibold"
              style={{ background: `linear-gradient(135deg, ${dashC.hex}, ${dashC.hex}cc)` }}
              data-testid="add-sport-modification"
            >
              <Zap className="w-4 h-4 mr-2" /> Modify Workouts for a Skill
            </Button>
          </div>
        </div>
      </FadeIn>

      {activeMatches.length > 0 && (
        <FadeIn delay={100} className="mb-4">
          <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] mb-2.5 px-1">Recent Matches</h2>
          <div className="space-y-2">
            {activeMatches.slice(0, 3).map((match) => (
              <div key={match.id} className="rounded-xl p-3 flex items-center gap-3 border border-white/[0.06]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))' }} data-testid={`match-log-${match.id}`}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${dashC.hex}20` }}>
                  <Play className="w-4 h-4" style={{ color: dashC.hex }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-200">{match.matchDate}</p>
                    {match.intensity && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${match.intensity === 'competitive' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {match.intensity}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {match.duration && <span className="text-[11px] text-zinc-500">{match.duration} min</span>}
                    {match.caloriesBurned && <span className="text-[11px] text-zinc-500">{match.caloriesBurned} cal</span>}
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] border-white/10 text-zinc-500">{match.status}</Badge>
              </div>
            ))}
            {activeMatches.length > 3 && (
              <p className="text-[11px] text-zinc-600 text-center pt-1">+ {activeMatches.length - 3} more matches</p>
            )}
          </div>
        </FadeIn>
      )}

      {(!programs || programs.length === 0) ? (
        <FadeIn delay={200}>
          <div className="rounded-2xl border border-white/[0.08] p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${dashC.hex}10` }}>
              <Medal className="w-8 h-8" style={{ color: `${dashC.hex}40` }} />
            </div>
            <h3 className="font-semibold text-zinc-300">No Sport Modifications Yet</h3>
            <p className="text-sm text-zinc-500 mt-1 max-w-xs mx-auto">
              Pick a sport skill above to modify your workout cycle with AI-powered exercises.
            </p>
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={200}>
          <div className="space-y-3">
            <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] px-1">Active Modifications</h2>
            {programs.filter(p => p.isActive).map((program) => (
              <SportModCard
                key={program.id} program={program}
                isExpanded={expandedModId === program.id}
                onToggle={() => setExpandedModId(expandedModId === program.id ? null : program.id)}
                onDelete={() => deleteProgram.mutate(program.id)}
                deleteDisabled={deleteProgram.isPending}
              />
            ))}
          </div>
        </FadeIn>
      )}

      <FadeIn delay={300} className="mt-6 space-y-3">
        <Button variant="outline" className="w-full border-white/10 text-zinc-400 rounded-xl" onClick={() => { setSelectedSport(""); setSelectedRole(""); setStep("select-sport"); }} data-testid="change-sport">
          Change Sport / Role
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full border-red-500/20 text-red-400 rounded-xl" data-testid="end-sports-mode">
              <Power className="w-4 h-4 mr-2" /> End Sports Mode
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-zinc-900 border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">End Sports Mode?</AlertDialogTitle>
              <AlertDialogDescription className="text-zinc-400">
                This will deactivate your current sport profile ({profile?.sport} - {profile?.role}) and all associated workout modifications. Your progress will be saved to history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/10 text-zinc-300" data-testid="cancel-end-sports">Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-500 text-white" onClick={() => endSportProfile.mutate()} disabled={endSportProfile.isPending} data-testid="confirm-end-sports">
                {endSportProfile.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                End Sports Mode
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </FadeIn>

      {profileHistory && profileHistory.length > 0 && (
        <FadeIn delay={400} className="mt-8">
          <button className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] px-1 mb-3 w-full" onClick={() => setShowHistory(!showHistory)} data-testid="toggle-sport-history">
            <History className="w-3.5 h-3.5" />
            <span>Past Sports ({profileHistory.length})</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showHistory && (
            <div className="space-y-2">
              {profileHistory.map((past) => {
                const pc = getColors(past.sport);
                const startDate = new Date(past.createdAt!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const endDate = past.endedAt ? new Date(past.endedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Switched";
                return (
                  <div key={past.id} className="rounded-xl border border-white/[0.06] p-3 flex items-center gap-3" style={{ background: 'rgba(255,255,255,0.03)' }} data-testid={`history-item-${past.id}`}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center opacity-70 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${pc.hex}, ${pc.hex}80)` }}>
                      <SportIcon sport={past.sport} className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-300 truncate">{past.sport}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-zinc-500">{past.role}</span>
                        {past.fitnessScore && <span className="text-[11px] text-zinc-500">{past.fitnessScore}/100</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-[10px] text-zinc-600"><Clock className="w-3 h-3" /><span>{startDate}</span></div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">to {endDate}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </FadeIn>
      )}
    </PageShell>
  );
}
