import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAiConsent, AiDataConsentDialog } from "@/components/ai-data-consent";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Trophy, Dumbbell, Target, Zap, ChevronRight, ChevronLeft, Loader2,
  ArrowLeft, ArrowRight, Activity, Medal, Brain, Waves, Swords, Crosshair,
  Check, X, AlertTriangle, ChevronDown, ChevronUp, Calendar, BarChart3,
  TrendingUp, TrendingDown, Minus, Timer, Flame, PieChart, Sparkles, Star,
  type LucideIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { SportProfile, SportProgram } from "@shared/schema";

const SPORT_COLORS: Record<string, { primary: string; gradient: string; bg: string; ring: string; lightBg: string; accent: string; iconBg: string; text: string }> = {
  "Football (Soccer)": {
    primary: "text-emerald-500", gradient: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-500", ring: "ring-emerald-500/30", lightBg: "bg-emerald-500/10",
    accent: "border-emerald-500/30", iconBg: "bg-emerald-500/20", text: "text-emerald-400",
  },
  "Basketball": {
    primary: "text-orange-500", gradient: "from-orange-500 to-amber-600",
    bg: "bg-orange-500", ring: "ring-orange-500/30", lightBg: "bg-orange-500/10",
    accent: "border-orange-500/30", iconBg: "bg-orange-500/20", text: "text-orange-400",
  },
  "Tennis": {
    primary: "text-lime-500", gradient: "from-lime-500 to-green-600",
    bg: "bg-lime-500", ring: "ring-lime-500/30", lightBg: "bg-lime-500/10",
    accent: "border-lime-500/30", iconBg: "bg-lime-500/20", text: "text-lime-400",
  },
  "Swimming": {
    primary: "text-cyan-500", gradient: "from-cyan-500 to-blue-600",
    bg: "bg-cyan-500", ring: "ring-cyan-500/30", lightBg: "bg-cyan-500/10",
    accent: "border-cyan-500/30", iconBg: "bg-cyan-500/20", text: "text-cyan-400",
  },
  "Boxing": {
    primary: "text-red-500", gradient: "from-red-500 to-rose-600",
    bg: "bg-red-500", ring: "ring-red-500/30", lightBg: "bg-red-500/10",
    accent: "border-red-500/30", iconBg: "bg-red-500/20", text: "text-red-400",
  },
  "MMA": {
    primary: "text-violet-500", gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-500", ring: "ring-violet-500/30", lightBg: "bg-violet-500/10",
    accent: "border-violet-500/30", iconBg: "bg-violet-500/20", text: "text-violet-400",
  },
  "Cricket": {
    primary: "text-blue-500", gradient: "from-blue-500 to-indigo-600",
    bg: "bg-blue-500", ring: "ring-blue-500/30", lightBg: "bg-blue-500/10",
    accent: "border-blue-500/30", iconBg: "bg-blue-500/20", text: "text-blue-400",
  },
  "Volleyball": {
    primary: "text-yellow-500", gradient: "from-yellow-500 to-orange-600",
    bg: "bg-yellow-500", ring: "ring-yellow-500/30", lightBg: "bg-yellow-500/10",
    accent: "border-yellow-500/30", iconBg: "bg-yellow-500/20", text: "text-yellow-400",
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

function BackButton({ onClick, label = "Back", testId = "sports-back" }: { onClick: () => void; label?: string; testId?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors mb-4"
      data-testid={testId}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function PageShell({ children, sport, noPad }: { children: React.ReactNode; sport?: string; noPad?: boolean }) {
  const c = getColors(sport || "");
  return (
    <div className={`min-h-screen bg-[#0c0c14] ${noPad ? '' : 'p-4 pb-24'}`} data-testid="sports-mode-page">
      <div className={`absolute inset-0 bg-gradient-to-b ${c.gradient} opacity-[0.04] pointer-events-none`} />
      <div className={`relative max-w-lg mx-auto ${noPad ? 'p-4 pb-24' : 'pt-2'}`}>
        {children}
      </div>
    </div>
  );
}

interface AnalyticsData {
  impactScore: number;
  totalExercises: number;
  sportExercises: number;
  muscleDistribution: Record<string, { total: number; sport: number }>;
  volumeChange: {
    removedSets: number; removedReps: number;
    addedSets: number; addedReps: number;
    netSets: number; netReps: number;
  };
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
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
          strokeWidth={strokeWidth} className="text-white/10" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor"
          strokeWidth={strokeWidth} className={c.primary}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
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
        <div className={`h-full bg-gradient-to-r ${c.gradient} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-medium text-zinc-500 w-8">{sportCount}/{total}</span>
    </div>
  );
}

function SportModCard({ program, isExpanded, onToggle, onDelete, deleteDisabled }: {
  program: SportProgram;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
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
    <div className={`rounded-2xl bg-white/[0.04] border border-white/[0.08] overflow-hidden backdrop-blur-sm transition-all duration-300 ${isExpanded ? `ring-1 ${c.ring}` : ''}`} data-testid={`mod-card-${program.id}`}>
      <div className="w-full text-left p-4 flex items-center gap-3">
        <div
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
          onClick={onToggle}
          data-testid={`mod-toggle-${program.id}`}
        >
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
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
          <Button
            variant="ghost"
            size="icon"
            className="text-red-400/60"
            onClick={onDelete}
            disabled={deleteDisabled}
            data-testid={`remove-mod-${program.id}`}
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="cursor-pointer" onClick={onToggle} data-testid={`mod-chevron-${program.id}`}>
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
                  <p className="text-[11px] text-zinc-500">
                    {analytics?.sportExercises || 0} of {analytics?.totalExercises || 0} exercises sport-targeted
                  </p>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-1">
                      <Timer className="w-3 h-3 text-blue-400" />
                      <span className="text-[11px] font-medium text-zinc-400">{analytics?.daysActive || 0}d active</span>
                    </div>
                    {analytics?.completionRate !== null && analytics?.completionRate !== undefined && (
                      <div className="flex items-center gap-1">
                        <Flame className={`w-3 h-3 ${c.primary}`} />
                        <span className="text-[11px] font-medium text-zinc-400">{analytics.completionRate}% done</span>
                      </div>
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
                  <div key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-2.5 text-center">
                    <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[9px] text-zinc-500 mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {analytics?.volumeChange && (analytics.volumeChange.removedSets > 0 || analytics.volumeChange.addedSets > 0) && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-xs font-semibold text-zinc-400 mb-2 flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> Volume Change
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Sets", val: analytics.volumeChange.netSets },
                      { label: "Total Reps", val: analytics.volumeChange.netReps },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[10px] text-zinc-500 mb-1">{item.label}</p>
                        <div className="flex items-center gap-1.5">
                          {item.val > 0 ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : item.val < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-zinc-500" />}
                          <span className={`text-sm font-bold ${item.val > 0 ? 'text-green-400' : item.val < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                            {item.val > 0 ? '+' : ''}{item.val}
                          </span>
                          <span className="text-[10px] text-zinc-600">net</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics?.muscleDistribution && Object.keys(analytics.muscleDistribution).length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-xs font-semibold text-zinc-400 mb-2.5 flex items-center gap-1">
                    <PieChart className="w-3.5 h-3.5" /> Muscle Distribution
                  </p>
                  <div className="space-y-1.5">
                    {Object.entries(analytics.muscleDistribution)
                      .sort((a, b) => b[1].sport - a[1].sport)
                      .slice(0, 6)
                      .map(([muscle, data]) => (
                        <MuscleBar key={muscle} name={muscle} total={data.total} sport={data.sport} sportName={program.sport} />
                      ))}
                  </div>
                </div>
              )}

              {analytics?.completionRate !== null && analytics?.completionRate !== undefined && (
                <div className={`rounded-xl bg-gradient-to-r ${c.gradient} bg-opacity-10 p-3`} style={{ background: `linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))` }}>
                  <p className={`text-xs font-semibold ${c.text} mb-2 flex items-center gap-1`}>
                    <Flame className="w-3.5 h-3.5" /> Completion
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${c.gradient} rounded-full transition-all duration-700`}
                          style={{ width: `${Math.min(100, analytics.completionRate)}%` }} />
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${c.text} w-10 text-right`}>{analytics.completionRate}%</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {analytics.completedSportExercises} of {analytics.totalSportExerciseOccurrences} exercises completed
                  </p>
                </div>
              )}

              {analysis?.targetMuscles?.length > 0 && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className={`text-xs font-semibold ${c.text} mb-1.5 flex items-center gap-1`}>
                    <Target className="w-3.5 h-3.5" /> Target Muscles
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.targetMuscles.map((m: string) => (
                      <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">{m}</span>
                    ))}
                  </div>
                  {analysis.whyTheseMuscles && (
                    <p className="text-[11px] text-zinc-500 mt-1.5">{analysis.whyTheseMuscles}</p>
                  )}
                </div>
              )}

              <div>
                <button
                  className="w-full flex items-center justify-between py-2"
                  onClick={() => setShowDayDetails(!showDayDetails)}
                  data-testid={`day-details-toggle-${program.id}`}
                >
                  <p className="text-xs font-semibold text-zinc-400 flex items-center gap-1">
                    <BarChart3 className="w-3.5 h-3.5" /> Day-by-Day Changes
                  </p>
                  {showDayDetails ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                </button>
                {showDayDetails && (
                  <div className="space-y-2 mt-1">
                    {changes.map((change: any, idx: number) => (
                      <div key={idx} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                        <p className="text-xs font-semibold text-zinc-300 mb-2">Day {change.dayIndex + 1}</p>
                        {change.removals?.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {change.removals.map((r: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                  <X className="w-2.5 h-2.5 text-red-400" />
                                </div>
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
                                <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                  <Zap className="w-2.5 h-2.5 text-green-400" />
                                </div>
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
                <p className="text-[10px] text-zinc-600 text-center pt-1">
                  Applied on {new Date(program.createdAt).toLocaleDateString()}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Step = "loading" | "select-sport" | "select-role" | "fitness-test" | "select-skill" | "previewing" | "preview-results" | "no-cycle" | "applying" | "dashboard";

export default function SportsModePage() {
  const { toast } = useToast();
  const aiConsent = useAiConsent();
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

  const { data: profile, isLoading: profileLoading } = useQuery<SportProfile | null>({
    queryKey: ["/api/sport/profile"],
  });

  const { data: programs, isLoading: programsLoading } = useQuery<SportProgram[]>({
    queryKey: ["/api/sport/programs"],
  });

  const createProfile = useMutation({
    mutationFn: async (data: { sport: string; role: string; fitnessScore?: number; testAnswers?: any }) => {
      const res = await apiRequest("POST", "/api/sport/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/profile"] });
    },
  });

  const previewMods = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sport/preview-modifications", data);
      return res.json();
    },
    onSuccess: (result) => {
      setPreviewData(result);
      if (result.noCycle) {
        setStep("no-cycle");
      } else {
        setStep("preview-results");
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate preview. Please try again.", variant: "destructive" });
      setStep("select-skill");
    },
  });

  const applyMods = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sport/apply-modifications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/calendar/enhanced"] });
      toast({ title: "Workout Updated!", description: "Your cycle has been modified with sport-targeted exercises." });
      setStep("dashboard");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply changes. Please try again.", variant: "destructive" });
    },
  });

  const createFullCycle = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sport/create-full-cycle", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/calendar/enhanced"] });
      toast({ title: "Workout Cycle Created!", description: "Your sport-focused workout cycle is ready." });
      setStep("dashboard");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create cycle. Please try again.", variant: "destructive" });
    },
  });

  const deleteProgram = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/sport/programs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      toast({ title: "Sport modification removed" });
    },
  });

  const consentDialog = (
    <AiDataConsentDialog
      open={aiConsent.showDialog}
      onConsentGranted={aiConsent.onConsentGranted}
      onConsentDenied={aiConsent.onConsentDenied}
    />
  );

  if (profileLoading || programsLoading) {
    if (step === "loading") {
      return (
        <PageShell>
          <div className="space-y-4 pt-4" data-testid="sports-mode-loading">
            <Skeleton className="h-8 w-48 bg-white/5" />
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

  const handleSkillSelect = (skill: string) => {
    if (!profile) return;
    setSelectedSkill(skill);
    setStep("previewing");
    previewMods.mutate({
      sportProfileId: profile.id,
      sport: activeSport,
      role: activeRole,
      skillCategory: selectedCategory,
      skillName: skill,
      fitnessScore: profile.fitnessScore ?? undefined,
    });
  };

  const handleApply = () => {
    if (!profile || !previewData || selectedPriority === null) return;
    const preview = previewData.previews?.find((p: any) => p.priority === selectedPriority);
    if (!preview) return;

    setStep("applying");
    applyMods.mutate({
      sportProfileId: profile.id,
      sport: activeSport,
      role: activeRole,
      skillCategory: selectedCategory,
      skillName: selectedSkill,
      priority: selectedPriority,
      changes: preview.changes,
      analysis: previewData.analysis,
    });
  };

  const handleCreateFullCycle = () => {
    if (!profile) return;
    aiConsent.requireConsent(() => {
      setStep("applying");
      createFullCycle.mutate({
        sportProfileId: profile.id,
        sport: activeSport,
        role: activeRole,
        skillCategory: selectedCategory,
        skillName: selectedSkill,
        fitnessScore: profile.fitnessScore ?? undefined,
      });
    });
  };

  if (currentStep === "select-sport") {
    return (
      <PageShell>
        <BackButton onClick={() => navigate("/")} label="Dashboard" testId="back-to-dashboard-from-sport" />

        <div className="text-center mb-8" data-testid="sports-select-sport">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 mb-4 shadow-lg shadow-orange-500/20">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Sports Mode</h1>
          <p className="text-zinc-500 mt-1 text-sm">Train smarter for your sport</p>
        </div>

        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-1">Choose Your Sport</h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SPORTS_DATA).map(([sport]) => {
            const sc = getColors(sport);
            return (
              <button
                key={sport}
                onClick={() => { setSelectedSport(sport); setStep("select-role"); }}
                className="flex flex-col items-center p-5 rounded-2xl bg-white/[0.04] border border-white/[0.08] transition-all group"
                data-testid={`sport-${sport.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${sc.gradient} flex items-center justify-center mb-3 shadow-lg group-active:shadow-none transition-shadow`}>
                  <SportIcon sport={sport} className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-zinc-200 text-center leading-tight">{sport}</span>
              </button>
            );
          })}
        </div>
      </PageShell>
    );
  }

  if (currentStep === "select-role") {
    const sportData = SPORTS_DATA[selectedSport];
    return (
      <PageShell sport={selectedSport}>
        <BackButton onClick={() => setStep("select-sport")} testId="back-to-sports" />
        <div className="text-center mb-6" data-testid="sports-select-role">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${c.gradient} mb-3 shadow-lg`}>
            <SportIcon sport={selectedSport} className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">{selectedSport}</h1>
          <p className="text-zinc-500 text-sm mt-1">What position do you play?</p>
        </div>

        <div className="space-y-2.5">
          {sportData?.roles.map((role, idx) => (
            <button
              key={role}
              onClick={() => {
                setSelectedRole(role);
                setCurrentTestQ(0);
                setTestAnswers({});
                setStep("fitness-test");
              }}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] transition-all group"
              data-testid={`role-${role.replace(/\s+/g, '-').toLowerCase()}`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                  <Target className={`w-5 h-5 ${c.primary}`} />
                </div>
                <span className="font-medium text-zinc-200">{role}</span>
              </div>
              <ChevronRight className="w-5 h-5 text-zinc-600" />
            </button>
          ))}
        </div>
      </PageShell>
    );
  }

  if (currentStep === "fitness-test") {
    const question = FITNESS_TEST_QUESTIONS[currentTestQ];
    const progress = ((currentTestQ) / FITNESS_TEST_QUESTIONS.length) * 100;

    return (
      <PageShell sport={selectedSport}>
        <BackButton onClick={() => {
          if (currentTestQ > 0) setCurrentTestQ(currentTestQ - 1);
          else setStep("select-role");
        }} testId="back-from-test" />

        <div className="text-center mb-5" data-testid="sports-fitness-test">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-3 shadow-lg shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">Fitness Assessment</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Question {currentTestQ + 1} of {FITNESS_TEST_QUESTIONS.length}</p>
        </div>

        <div className="h-1.5 bg-white/10 rounded-full mb-6 overflow-hidden">
          <div className={`h-full bg-gradient-to-r ${c.gradient} rounded-full transition-all duration-500`} style={{ width: `${progress}%` }} />
        </div>

        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5 mb-4">
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
                      setCurrentTestQ(currentTestQ + 1);
                    } else {
                      const finalScore = Object.values(newAnswers).reduce((sum, s) => sum + s, 0);
                      createProfile.mutate({
                        sport: selectedSport,
                        role: selectedRole,
                        fitnessScore: finalScore,
                        testAnswers: newAnswers,
                      });
                      setStep("select-skill");
                    }
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? `${c.accent} ${c.lightBg} border`
                      : "border-white/[0.08] bg-white/[0.02]"
                  }`}
                  data-testid={`test-option-${idx}`}
                >
                  <span className={isSelected ? 'text-white' : 'text-zinc-300'}>{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full text-zinc-500"
          onClick={() => {
            createProfile.mutate({ sport: selectedSport, role: selectedRole });
            setStep("select-skill");
          }}
          data-testid="skip-test"
        >
          Skip Assessment
        </Button>
      </PageShell>
    );
  }

  if (currentStep === "select-skill") {
    const sportData = SPORTS_DATA[activeSport];

    return (
      <PageShell sport={activeSport}>
        <BackButton
          onClick={() => {
            if (selectedCategory) {
              setSelectedCategory("");
            } else if (programs && programs.length > 0) {
              setStep("dashboard");
            } else {
              setStep("select-sport");
            }
          }}
          label={selectedCategory ? selectedCategory : (programs && programs.length > 0) ? "Dashboard" : "Back"}
          testId="back-from-skills"
        />

        <div className="text-center mb-6" data-testid="sports-select-skill">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${c.gradient} mb-3 shadow-lg`}>
            <SportIcon sport={activeSport} className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">Choose a Skill to Improve</h1>
          <p className="text-sm text-zinc-500 mt-1">Your workout cycle will be modified to target this skill</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`text-xs px-2.5 py-1 rounded-full ${c.lightBg} ${c.text} font-medium`}>{activeSport}</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-zinc-400">{activeRole}</span>
            {profile?.fitnessScore && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                Score: {profile.fitnessScore}/100
              </span>
            )}
          </div>
        </div>

        {!selectedCategory ? (
          <div className="space-y-2.5">
            {Object.keys(sportData?.skills || {}).map((category, idx) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] transition-all group"
                data-testid={`category-${category.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center shadow-md`}>
                    <Dumbbell className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="font-medium text-zinc-200">{category}</span>
                    <p className="text-xs text-zinc-500">{sportData?.skills[category]?.length} skills</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600" />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {sportData?.skills[selectedCategory]?.map((skill) => (
              <button
                key={skill}
                onClick={() => handleSkillSelect(skill)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] transition-all"
                data-testid={`skill-${skill.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center`}>
                    <Zap className={`w-5 h-5 ${c.primary}`} />
                  </div>
                  <span className="font-medium text-zinc-200">{skill}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06]">
                    <Sparkles className="w-3 h-3 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">AI</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </div>
              </button>
            ))}
          </div>
        )}
      </PageShell>
    );
  }

  if (currentStep === "previewing" || currentStep === "applying") {
    return (
      <PageShell sport={activeSport}>
        {currentStep === "previewing" && (
          <BackButton
            onClick={() => { setStep("select-skill"); setSelectedCategory(""); }}
            label="Cancel"
            testId="back-from-previewing"
          />
        )}
        {currentStep === "applying" && (
          <div className="mb-4">
            <span className="text-sm text-zinc-600" data-testid="applying-status">Applying...</span>
          </div>
        )}
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="sports-previewing">
          <div className="text-center max-w-sm px-4">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br ${c.gradient} mb-6 shadow-2xl animate-pulse`}>
              <Brain className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {currentStep === "previewing" ? "Analyzing Your Cycle" : "Applying Changes"}
            </h2>
            <p className="text-zinc-500 mb-6 text-sm">
              {currentStep === "previewing"
                ? `AI is planning ${selectedSkill} modifications for your workouts...`
                : "Updating your workout cycle with sport-targeted exercises..."}
            </p>
            <div className="flex items-center justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${c.bg} animate-bounce`}
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (currentStep === "no-cycle") {
    return (
      <PageShell sport={activeSport}>
        <BackButton onClick={() => { setStep("select-skill"); setSelectedCategory(""); }} testId="back-from-no-cycle" />

        <div className="text-center mb-6" data-testid="sports-no-cycle">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 mb-3">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-xl font-bold text-white">No Workout Cycle Found</h1>
          <p className="text-zinc-500 text-sm mt-2">
            You need an active workout cycle to modify for <span className={`font-semibold ${c.text}`}>{selectedSkill}</span>.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Dumbbell className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">Create a workout cycle first</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Set up your regular workout cycle, then come back to add sport-specific modifications.
                </p>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => navigate("/workouts")}
                  data-testid="go-to-workouts"
                >
                  Go to Workouts <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-white/10 flex-1" />
            <span className="px-3 text-sm text-zinc-600 bg-[#0c0c14]">or</span>
            <div className="border-t border-white/10 flex-1" />
          </div>

          <div className={`rounded-2xl bg-white/[0.04] border ${c.accent} p-5`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">Use this as your full workout</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  AI will create a complete cycle focused on <span className={`font-medium ${c.text}`}>{selectedSkill}</span> in {activeSport}.
                </p>
                <Button
                  className={`mt-3 bg-gradient-to-r ${c.gradient} text-white border-0`}
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
        </div>
      </PageShell>
    );
  }

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

        <div className="text-center mb-5" data-testid="sports-preview-results">
          <h1 className="text-xl font-bold text-white">How much do you want to change?</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Modifying <span className="text-zinc-300">"{cycleInfo?.name}"</span> for <span className={`font-medium ${c.text}`}>{selectedSkill}</span>
          </p>
        </div>

        {analysis?.targetMuscles?.length > 0 && (
          <div className={`mb-4 p-3 rounded-xl ${c.lightBg} border ${c.accent}`}>
            <p className={`text-xs font-medium ${c.text} mb-1.5`}>Target Muscles</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.targetMuscles.map((m: string) => (
                <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">{m}</span>
              ))}
            </div>
            {analysis.whyTheseMuscles && (
              <p className="text-xs text-zinc-500 mt-1.5">{analysis.whyTheseMuscles}</p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {previews.map((preview: any) => {
            const config = priorityLabels[preview.priority] || priorityLabels[50];
            const isSelected = selectedPriority === preview.priority;
            const PriorityIcon = config.icon;

            return (
              <button
                key={preview.priority}
                onClick={() => setSelectedPriority(preview.priority)}
                className={`w-full text-left rounded-2xl border-2 transition-all ${
                  isSelected
                    ? `${c.accent} ring-2 ${c.ring} bg-white/[0.06]`
                    : "border-white/[0.08] bg-white/[0.03]"
                }`}
                data-testid={`priority-${preview.priority}`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${c.gradient} flex items-center justify-center`}>
                        <PriorityIcon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <span className="text-lg font-bold text-white">{preview.priority}%</span>
                        <span className={`text-xs ml-1.5 ${c.text}`}>{config.label}</span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${c.gradient} flex items-center justify-center`}>
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">{preview.summary || config.desc}</p>

                  <div className="space-y-2">
                    {preview.changes?.map((change: any, idx: number) => {
                      const dayLabel = cycleInfo?.dayLabels?.[change.dayIndex] || `Day ${change.dayIndex + 1}`;
                      return (
                        <div key={idx} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
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
            );
          })}
        </div>

        {selectedPriority !== null && (
          <div className="mt-6 sticky bottom-20 pt-2 pb-2">
            <Button
              className={`w-full bg-gradient-to-r ${c.gradient} text-white border-0 h-12 text-base rounded-xl shadow-lg`}
              onClick={handleApply}
              disabled={applyMods.isPending}
              data-testid="apply-changes"
            >
              {applyMods.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
              Apply {selectedPriority}% Changes
            </Button>
          </div>
        )}
      </PageShell>
    );
  }

  // Dashboard
  const dashC = getColors(profile?.sport || "");

  return (
    <PageShell sport={profile?.sport}>
      <BackButton onClick={() => navigate("/")} label="Dashboard" testId="back-to-dashboard" />

      <div className="mb-6" data-testid="sports-dashboard">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${dashC.gradient} flex items-center justify-center shadow-lg`}>
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Sports Mode</h1>
            {profile && (
              <div className="flex gap-1.5 mt-1">
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${dashC.lightBg} ${dashC.text} font-medium flex items-center gap-1`}>
                  <SportIcon sport={profile.sport} className="w-3 h-3" /> {profile.sport}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-zinc-400">{profile.role}</span>
                {profile.fitnessScore && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                    {profile.fitnessScore}/100
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={() => { setSelectedCategory(""); setSelectedPriority(null); setStep("select-skill"); }}
          className={`w-full bg-gradient-to-r ${dashC.gradient} text-white border-0 rounded-xl h-12 shadow-lg`}
          data-testid="add-sport-modification"
        >
          <Zap className="w-4 h-4 mr-2" /> Modify Workouts for a Skill
        </Button>
      </div>

      {(!programs || programs.length === 0) ? (
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] p-8 text-center">
          <Medal className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <h3 className="font-semibold text-zinc-300">No Sport Modifications Yet</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Pick a sport skill above to modify your workout cycle.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1">Active Modifications</h2>
          {programs.filter(p => p.isActive).map((program) => (
            <SportModCard
              key={program.id}
              program={program}
              isExpanded={expandedModId === program.id}
              onToggle={() => setExpandedModId(expandedModId === program.id ? null : program.id)}
              onDelete={() => deleteProgram.mutate(program.id)}
              deleteDisabled={deleteProgram.isPending}
            />
          ))}
        </div>
      )}

      <div className="mt-6">
        <Button
          variant="outline"
          className="w-full border-white/10 text-zinc-400 rounded-xl"
          onClick={() => { setSelectedSport(""); setSelectedRole(""); setStep("select-sport"); }}
          data-testid="change-sport"
        >
          Change Sport / Role
        </Button>
      </div>
    </PageShell>
  );
}
