import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Target, Utensils, Lock, Settings, Check, X, ChevronDown, ChevronUp, Flame, Footprints, Moon, Dumbbell, Sparkles, Share2, Trophy, Crown, Medal, Zap, Info, Brain, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";

const COLOR_MAP: Record<string, string> = {
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
};

const COLOR_BG_MAP: Record<string, string> = {
  green: "rgba(34,197,94,0.10)",
  blue: "rgba(59,130,246,0.10)",
  yellow: "rgba(234,179,8,0.10)",
  orange: "rgba(249,115,22,0.10)",
  red: "rgba(239,68,68,0.10)",
};

const PILLAR_CONFIG: Record<string, { label: string; icon: any; description: string; gradient: string; glow: string }> = {
  workout: { label: "Workout", icon: Dumbbell, description: "Track your training sessions", gradient: "from-violet-500 to-purple-600", glow: "shadow-violet-500/20" },
  nutrition: { label: "Nutrition", icon: Utensils, description: "Monitor meals and macros", gradient: "from-emerald-500 to-green-600", glow: "shadow-emerald-500/20" },
  activity: { label: "Activity", icon: Footprints, description: "Steps and daily movement", gradient: "from-blue-500 to-cyan-600", glow: "shadow-blue-500/20" },
  recovery: { label: "Recovery", icon: Moon, description: "Sleep, HRV and rest quality", gradient: "from-amber-500 to-orange-600", glow: "shadow-amber-500/20" },
};

const LEAGUE_CONFIG: Record<string, { label: string; description: string; pillars: string[]; icon: any; gradient: string }> = {
  casual: { label: "Casual", description: "Ranked by workout only", pillars: ["workout"], icon: Dumbbell, gradient: "from-blue-500 to-cyan-600" },
  balanced: { label: "Balanced", description: "Workout + Nutrition + Activity", pillars: ["workout", "nutrition", "activity"], icon: Target, gradient: "from-violet-500 to-purple-600" },
  full_tracker: { label: "Full Tracker", description: "All 4 pillars", pillars: ["workout", "nutrition", "activity", "recovery"], icon: Crown, gradient: "from-amber-500 to-orange-600" },
};

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
      else prevRef.current = value;
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{display}</>;
}

function ScoreRing({ score, color, size = 200, strokeWidth = 12, label, isLive, streak }: { score: number; color: string; size?: number; strokeWidth?: number; label?: string; isLive?: boolean; streak?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const hex = COLOR_MAP[color] || COLOR_MAP.blue;

  const tickCount = 60;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const angle = (i / tickCount) * 360;
    const isActive = i / tickCount <= score / 100;
    return { angle, isActive };
  });

  return (
    <div className="relative flex items-center justify-center" style={{ width: size + 20, height: size + 20 }}>
      <svg width={size + 20} height={size + 20} className="transform -rotate-90">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {ticks.map((tick, i) => {
          const innerR = radius - 8;
          const outerR = radius - 4;
          const rad = (tick.angle * Math.PI) / 180;
          const cx = (size + 20) / 2;
          const cy = (size + 20) / 2;
          return (
            <line
              key={i}
              x1={cx + innerR * Math.cos(rad)}
              y1={cy + innerR * Math.sin(rad)}
              x2={cx + outerR * Math.cos(rad)}
              y2={cy + outerR * Math.sin(rad)}
              stroke={tick.isActive ? hex : "rgba(255,255,255,0.06)"}
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={tick.isActive ? 0.85 : 0.3}
            />
          );
        })}
        <circle cx={(size + 20) / 2} cy={(size + 20) / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />
        <circle
          cx={(size + 20) / 2}
          cy={(size + 20) / 2}
          r={radius}
          fill="none"
          stroke={hex}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          filter="url(#glow)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black tabular-nums text-white tracking-tight" data-testid="score-value" style={{ textShadow: `0 0 40px ${hex}30` }}>
          <AnimatedNumber value={score} />
        </span>
        {label && (
          <span className="text-[11px] font-semibold mt-1 tracking-wide uppercase" style={{ color: hex }}>
            {label}
          </span>
        )}
        {isLive && (
          <div className="flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full" style={{ backgroundColor: `${hex}10` }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: hex }} />
            <span className="text-[9px] font-bold tracking-widest" style={{ color: `${hex}99` }}>LIVE</span>
          </div>
        )}
      </div>
      {streak !== undefined && streak >= 3 && (
        <div className="absolute -top-0.5 -right-0.5 flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(239,68,68,0.15))", border: "1px solid rgba(249,115,22,0.35)", backdropFilter: "blur(8px)" }} data-testid="streak-badge">
          <Flame className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-bold text-orange-300">{streak}</span>
        </div>
      )}
    </div>
  );
}

function MiniPillarRing({ score, color, size = 32 }: { score: number; color: string; size?: number }) {
  const sw = 3;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const p = (score / 100) * c;
  const hex = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={hex} strokeWidth={sw} strokeDasharray={c} strokeDashoffset={c - p} strokeLinecap="round" />
    </svg>
  );
}

function PillarSetupSheet({ onComplete }: { onComplete: (pillars: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(["workout", "activity"]);

  const toggle = (pillar: string) => {
    setSelected(prev => {
      if (prev.includes(pillar)) {
        if (prev.length <= 1) return prev;
        return prev.filter(p => p !== pillar);
      }
      return [...prev, pillar];
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md" data-testid="pillar-setup-sheet">
      <div className="w-full max-w-md bg-gradient-to-b from-[#1e1e35] to-[#14142a] rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-300 border-t border-white/[0.08]">
        <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-6" />
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-500/25">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Personalize Your Score</h2>
          <p className="text-sm text-white/40 mt-1.5">Choose pillars that match your fitness focus</p>
        </div>

        <div className="space-y-2.5 mb-6">
          {Object.entries(PILLAR_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const isSelected = selected.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 ${
                  isSelected ? "border-white/15 bg-white/[0.06]" : "border-white/[0.04] bg-white/[0.02]"
                }`}
                data-testid={`pillar-toggle-${key}`}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg ${config.glow}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-white">{config.label}</div>
                  <div className="text-[11px] text-white/35">{config.description}</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? "border-green-400 bg-green-400/20" : "border-white/15"
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 text-green-400" />}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-white/25 text-center mb-4">
          Weights redistribute proportionally based on your selection
        </p>

        <Button
          onClick={() => onComplete(selected)}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold shadow-xl shadow-purple-500/25 border-0"
          data-testid="button-save-pillars"
        >
          Start Tracking
        </Button>
      </div>
    </div>
  );
}

function PillarSettingsModal({ currentPillars, onSave, onClose }: { currentPillars: string[]; onSave: (pillars: string[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(currentPillars);

  const toggle = (pillar: string) => {
    setSelected(prev => {
      if (prev.includes(pillar)) {
        if (prev.length <= 1) return prev;
        return prev.filter(p => p !== pillar);
      }
      return [...prev, pillar];
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md" data-testid="pillar-settings-modal">
      <div className="w-full max-w-sm bg-gradient-to-b from-[#1e1e35] to-[#14142a] rounded-3xl p-5 mx-4 border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Score Pillars</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-colors" data-testid="button-close-settings">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="space-y-2 mb-5">
          {Object.entries(PILLAR_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const isSelected = selected.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isSelected ? "border-white/12 bg-white/[0.05]" : "border-white/[0.04] bg-white/[0.01] opacity-50"
                }`}
                data-testid={`settings-pillar-${key}`}
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="flex-1 text-left text-sm font-medium text-white">{config.label}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? "border-green-400 bg-green-400/20" : "border-white/15"
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-green-400" />}
                </div>
              </button>
            );
          })}
        </div>

        <Button
          onClick={() => onSave(selected)}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold border-0"
          data-testid="button-update-pillars"
        >
          Update Pillars
        </Button>
      </div>
    </div>
  );
}

function MiniTrend({ data }: { data: { date: string; score: number; color: string }[] }) {
  if (!data || data.length < 2) return null;
  const last7 = data.slice(-7);
  const maxScore = Math.max(...last7.map(d => d.score), 1);

  return (
    <div className="flex items-end gap-2 h-20 px-1" data-testid="mini-trend">
      {last7.map((d, i) => {
        const isLast = i === last7.length - 1;
        const hex = COLOR_MAP[d.color] || COLOR_MAP.blue;
        const barHeight = Math.max((d.score / 100) * 56, 6);

        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
            <span className={`text-[9px] font-bold tabular-nums transition-all ${isLast ? "text-white/80" : "text-white/25"}`}>
              {d.score}
            </span>
            <div className="w-full flex justify-center">
              <div
                className="w-full max-w-[28px] rounded-lg transition-all duration-500"
                style={{
                  height: `${barHeight}px`,
                  background: isLast
                    ? `linear-gradient(180deg, ${hex}, ${hex}88)`
                    : `linear-gradient(180deg, ${hex}50, ${hex}20)`,
                  boxShadow: isLast ? `0 2px 12px ${hex}30` : "none",
                }}
              />
            </div>
            <span className={`text-[9px] font-medium ${isLast ? "text-white/50" : "text-white/20"}`}>
              {new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "narrow" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FitnessCreditCard({ data }: { data: any }) {
  if (!data) return null;

  if (data.building) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #16162a 0%, #1a1a30 50%, #16162a 100%)" }} data-testid="fitness-credit-card">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-violet-500/5 blur-2xl" />
        <div className="p-4 relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-white/[0.04] flex items-center justify-center border border-white/[0.06]">
              <Lock className="w-5 h-5 text-white/25" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Fitness Credit</h3>
              <p className="text-[11px] text-white/35">Building your score...</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] text-white/40">{data.daysCompleted} of {data.daysRequired} days tracked</span>
            <span className="text-[11px] font-bold text-violet-400">{data.progress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-700 shadow-sm shadow-violet-500/30" style={{ width: `${data.progress}%` }} />
          </div>
          <p className="text-[10px] text-white/20 mt-2.5">Track consistently for {data.daysRequired} days to unlock</p>
        </div>
      </div>
    );
  }

  const tierColor = COLOR_MAP[data.tierColor || "blue"] || COLOR_MAP.blue;
  const tierLabel = data.tierLabel || "Building";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #16162a 0%, #1a1a30 50%, #16162a 100%)" }} data-testid="fitness-credit-card">
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl" style={{ backgroundColor: `${tierColor}08` }} />
      <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl" style={{ backgroundColor: `${tierColor}05` }} />
      <div className="p-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${tierColor}18, ${tierColor}08)`, border: `1px solid ${tierColor}25` }}>
              <Sparkles className="w-5 h-5" style={{ color: tierColor }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Fitness Credit</h3>
              <p className="text-[11px] font-semibold" style={{ color: tierColor }}>{tierLabel}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl font-black tabular-nums text-white" data-testid="fitness-credit-value" style={{ textShadow: `0 0 30px ${tierColor}20` }}>
                <AnimatedNumber value={data.score} />
              </span>
              <span className="text-xs text-white/20 font-medium">/1k</span>
            </div>
          </div>
        </div>
        {data.delta !== undefined && data.delta !== 0 && (
          <div className="flex items-center gap-1.5 mt-3 px-2.5 py-1.5 rounded-lg w-fit" style={{ backgroundColor: data.delta > 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)" }}>
            {data.delta > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={`text-[11px] font-semibold ${data.delta > 0 ? "text-green-400" : "text-red-400"}`}>
              {data.delta > 0 ? "+" : ""}{data.delta} from last calculation
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function LeagueSection({ userId }: { userId?: number }) {
  const { toast } = useToast();
  const [activeLeague, setActiveLeague] = useState<string | null>(null);

  const { data: myLeagues } = useQuery<any[]>({
    queryKey: ["/api/discipline/leagues/my"],
  });

  const { data: leaderboard } = useQuery<any[]>({
    queryKey: ["/api/discipline/leagues", activeLeague, "leaderboard"],
    enabled: !!activeLeague,
  });

  const joinMutation = useMutation({
    mutationFn: async (league: string) => {
      const res = await apiRequest("POST", "/api/discipline/leagues/join", { league });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discipline/leagues/my"] });
      toast({ title: "Joined league!" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (league: string) => {
      const res = await apiRequest("POST", "/api/discipline/leagues/leave", { league });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discipline/leagues/my"] });
      setActiveLeague(null);
      toast({ title: "Left league" });
    },
  });

  const joinedLeagues = new Set((myLeagues || []).map((l: any) => l.league));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06]" style={{ background: "linear-gradient(135deg, #16162a 0%, #1a1a30 50%, #16162a 100%)" }} data-testid="leagues-card">
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-amber-500/5 blur-3xl" />
      <div className="p-4 relative">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/15">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Leagues</h3>
            <p className="text-[10px] text-white/30">Compete with your gym</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {Object.entries(LEAGUE_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const isJoined = joinedLeagues.has(key);
            const isActive = activeLeague === key;

            return (
              <div key={key}>
                <div
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                    isActive ? "border-white/12 bg-white/[0.05]" : isJoined ? "border-white/[0.08] bg-white/[0.03]" : "border-white/[0.04] bg-white/[0.01]"
                  } ${isJoined ? "cursor-pointer" : ""}`}
                  onClick={() => isJoined ? setActiveLeague(isActive ? null : key) : null}
                  data-testid={`league-${key}`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-md`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white">{config.label}</div>
                    <div className="text-[10px] text-white/30">{config.description}</div>
                  </div>
                  {isJoined ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                        <Check className="w-2.5 h-2.5 text-green-400" />
                        <span className="text-[9px] font-semibold text-green-400">Joined</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); leaveMutation.mutate(key); }}
                        className="px-2 py-1 rounded-lg text-[10px] text-white/25 hover:text-red-400 hover:bg-red-500/8 transition-all font-medium border border-transparent hover:border-red-500/15"
                        data-testid={`leave-league-${key}`}
                      >
                        Leave
                      </button>
                      {isActive ? <ChevronUp className="w-3.5 h-3.5 text-white/20" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); joinMutation.mutate(key); }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white/60 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] transition-all"
                      data-testid={`join-league-${key}`}
                    >
                      Join
                    </button>
                  )}
                </div>

                {isActive && isJoined && leaderboard && (
                  <div className="mt-1.5 mx-1 space-y-1 animate-in slide-in-from-top-2 duration-200" data-testid={`leaderboard-${key}`}>
                    {leaderboard.length === 0 ? (
                      <div className="flex flex-col items-center py-4">
                        <Trophy className="w-6 h-6 text-white/10 mb-1.5" />
                        <p className="text-[11px] text-white/25">No other members yet</p>
                      </div>
                    ) : (
                      leaderboard.slice(0, 10).map((entry: any) => {
                        const isMe = entry.userId === userId;
                        const hex = COLOR_MAP[entry.color] || COLOR_MAP.blue;

                        return (
                          <div
                            key={entry.userId}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                              isMe ? "bg-violet-500/8 border border-violet-500/15" : "bg-white/[0.02] border border-white/[0.03]"
                            }`}
                            data-testid={`rank-entry-${entry.userId}`}
                          >
                            <div className="w-7 flex items-center justify-center shrink-0">
                              {entry.rank <= 3 ? (
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                  entry.rank === 1 ? "bg-amber-400/15" : entry.rank === 2 ? "bg-gray-300/10" : "bg-amber-700/10"
                                }`}>
                                  <Medal className={`w-4 h-4 ${entry.rank === 1 ? "text-amber-400" : entry.rank === 2 ? "text-gray-300" : "text-amber-600"}`} />
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-white/30">#{entry.rank}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`text-[13px] font-semibold truncate block ${isMe ? "text-violet-300" : "text-white/70"}`}>
                                {isMe ? "You" : entry.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              {entry.streak >= 3 && (
                                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/15">
                                  <Flame className="w-3 h-3 text-orange-400" />
                                  <span className="text-[10px] font-bold text-orange-400">{entry.streak}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${hex}12`, border: `1px solid ${hex}20` }}>
                                <span className="text-sm font-black tabular-nums" style={{ color: hex }}>{entry.score}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const ALIGNMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  on_track: { label: "On Track", color: "#22c55e", bg: "rgba(34,197,94,0.10)" },
  partially_aligned: { label: "Partially Aligned", color: "#eab308", bg: "rgba(234,179,8,0.10)" },
  off_track: { label: "Off Track", color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  no_goal: { label: "No Goal Set", color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
};

function WeeklyInsights({ profile }: { profile: any }) {
  if (!profile) return null;

  const alignment = ALIGNMENT_CONFIG[profile.goalAlignment?.alignmentLabel] || ALIGNMENT_CONFIG.no_goal;
  const correlations = profile.correlations || [];
  const hasGoal = profile.goalAlignment?.primaryGoal && profile.goalAlignment?.alignmentLabel !== 'no_goal';

  return (
    <div
      className="rounded-2xl border border-white/[0.06] overflow-hidden mb-4"
      style={{ background: "linear-gradient(135deg, #14142a 0%, #1a1a30 100%)" }}
      data-testid="weekly-insights-card"
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3.5">
          <Brain className="w-4 h-4 text-purple-400" />
          <h3 className="text-[13px] font-bold text-white">Weekly Insights</h3>
          {profile.overallAssessment && (
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
              style={{
                color: profile.overallAssessment === 'improving' ? '#22c55e' :
                       profile.overallAssessment === 'declining' ? '#ef4444' :
                       profile.overallAssessment === 'consistent' ? '#3b82f6' : '#eab308',
                backgroundColor: profile.overallAssessment === 'improving' ? 'rgba(34,197,94,0.12)' :
                       profile.overallAssessment === 'declining' ? 'rgba(239,68,68,0.12)' :
                       profile.overallAssessment === 'consistent' ? 'rgba(59,130,246,0.12)' : 'rgba(234,179,8,0.12)',
              }}
              data-testid="text-overall-assessment"
            >
              {profile.overallAssessment === 'new_user' ? 'Getting Started' : profile.overallAssessment}
            </span>
          )}
        </div>

        {profile.summaryText && (
          <p className="text-[12px] text-white/50 leading-relaxed mb-3" data-testid="text-summary">
            {profile.summaryText}
          </p>
        )}

        {hasGoal && (
          <div
            className="flex items-center gap-2.5 p-2.5 rounded-xl border mb-3"
            style={{ backgroundColor: alignment.bg, borderColor: `${alignment.color}20` }}
            data-testid="goal-alignment-badge"
          >
            <Target className="w-4 h-4 shrink-0" style={{ color: alignment.color }} />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] text-white/40">Goal: </span>
              <span className="text-[11px] text-white/70 capitalize">
                {profile.goalAlignment.primaryGoal?.replace(/_/g, ' ')}
              </span>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: alignment.color }}>
              {alignment.label}
            </span>
          </div>
        )}

        {correlations.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">Patterns Detected</span>
            {correlations.slice(0, 3).map((c: any, i: number) => (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                data-testid={`correlation-${i}`}
              >
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                  c.confidence === 'high' ? 'bg-purple-500/15' : 'bg-white/[0.06]'
                }`}>
                  {c.confidence === 'high' ? (
                    <AlertTriangle className="w-3 h-3 text-purple-400" />
                  ) : (
                    <Info className="w-3 h-3 text-white/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/55 leading-relaxed">{c.suggestion}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!profile.summaryText && correlations.length === 0 && (
          <p className="text-[11px] text-white/30 text-center py-2">
            Keep tracking for a few more days to see behavioral insights here.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ScorePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);

  const { data: scoreData, isLoading } = useQuery<any>({
    queryKey: ["/api/discipline/score/today"],
    refetchInterval: 60000,
  });

  const { data: history } = useQuery<any[]>({
    queryKey: ["/api/discipline/score/history"],
  });

  const { data: authUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const { data: contextProfile } = useQuery<any>({
    queryKey: ["/api/member/context-profile"],
    refetchInterval: 300000,
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: { selectedPillars?: string[]; setupCompleted?: boolean }) => {
      const res = await apiRequest("PATCH", "/api/discipline/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discipline/score/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discipline/settings"] });
      toast({ title: "Settings updated" });
    },
  });

  const handleSetupComplete = (pillars: string[]) => {
    settingsMutation.mutate({ selectedPillars: pillars, setupCompleted: true });
  };

  const handleSettingsSave = (pillars: string[]) => {
    settingsMutation.mutate({ selectedPillars: pillars });
    setShowSettings(false);
  };

  const handleShare = async () => {
    try {
      const res = await fetch("/api/discipline/share-card", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to generate");
      const svgText = await res.text();

      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      if (navigator.share) {
        const file = new File([blob], "ogym-score.svg", { type: "image/svg+xml" });
        try {
          await navigator.share({ files: [file], title: "My OGym Score", text: "Check out my fitness score!" });
          return;
        } catch {}
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = "ogym-score.svg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Share card downloaded!" });
    } catch {
      toast({ title: "Couldn't generate share card", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a14] p-4">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate("/")} className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center border border-white/[0.06]" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 text-white/50" />
          </button>
          <h1 className="text-lg font-bold text-white">OGym Score</h1>
        </div>
        <div className="flex flex-col items-center gap-4 pt-12">
          <div className="w-[220px] h-[220px] rounded-full bg-white/[0.03] animate-pulse" />
          <div className="w-36 h-4 rounded-lg bg-white/[0.04] animate-pulse mt-2" />
          <div className="grid grid-cols-2 gap-3 w-full mt-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  const needsSetup = scoreData && !scoreData.settings?.setupCompleted;
  const daily = scoreData?.daily;
  const fitnessCredit = scoreData?.fitnessCredit;
  const yesterday = scoreData?.yesterday;
  const selectedPillars = scoreData?.settings?.selectedPillars || ["workout", "activity"];
  const pillars = daily?.pillars || {};

  const streak = daily?.reasons?.find((r: any) => r.pillar === "streak");
  const streakCount = streak ? parseInt(streak.text?.match(/\d+/)?.[0] || "0") : 0;

  const trendData = (history || []).map((h: any) => ({
    date: h.date,
    score: h.score,
    color: h.color || "blue",
  }));

  return (
    <div className="min-h-screen bg-[#0a0a14] pb-24" data-testid="score-page">
      {needsSetup && <PillarSetupSheet onComplete={handleSetupComplete} />}
      {showSettings && (
        <PillarSettingsModal
          currentPillars={selectedPillars}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center border border-white/[0.06] hover:bg-white/[0.06] transition-colors" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 text-white/50" />
            </button>
            <h1 className="text-lg font-bold text-white tracking-tight">OGym Score</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleShare} className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center border border-white/[0.06] hover:bg-white/[0.06] transition-colors" data-testid="button-share">
              <Share2 className="w-4 h-4 text-white/50" />
            </button>
            <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center border border-white/[0.06] hover:bg-white/[0.06] transition-colors" data-testid="button-settings">
              <Settings className="w-4 h-4 text-white/50" />
            </button>
          </div>
        </div>

        {daily && (
          <>
            <div className="flex flex-col items-center mb-4 pt-2">
              <ScoreRing score={daily.score} color={daily.color} isLive={daily.isLive} label={daily.label} streak={streakCount} />

              <div className="flex items-center gap-3 mt-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.04]">
                <div className="flex items-center gap-1">
                  {daily.trend === "up" ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : daily.trend === "down" ? (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  ) : (
                    <Minus className="w-3 h-3 text-white/20" />
                  )}
                  <span className="text-[10px] text-white/40">vs yesterday</span>
                </div>
                <div className="w-px h-2.5 bg-white/[0.06]" />
                <span className="text-[10px] text-white/40">7d avg: <span className="text-white/60 font-bold">{daily.avg7Day}</span></span>
              </div>
            </div>

            {yesterday && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] mb-4" data-testid="yesterday-card">
                <div className="relative">
                  <MiniPillarRing score={yesterday.score} color={yesterday.color} size={36} />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">{yesterday.score}</span>
                </div>
                <div className="flex-1">
                  <span className="text-[11px] font-medium text-white/50">Yesterday</span>
                  <span className="text-[10px] text-white/25 ml-1.5">{yesterday.label}</span>
                </div>
                <span className="text-[10px] text-white/20 font-medium">{yesterday.date}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {Object.entries(pillars).map(([key, pillar]: [string, any]) => {
                if (!pillar.enabled) return null;
                const config = PILLAR_CONFIG[key];
                if (!config) return null;
                const Icon = config.icon;
                const hex = COLOR_MAP[pillar.color] || COLOR_MAP.blue;
                const scoreLabel = pillar.score >= 90 ? "Excellent" : pillar.score >= 70 ? "Strong" : pillar.score >= 50 ? "Moderate" : pillar.score >= 30 ? "Low" : "Needs work";

                return (
                  <div
                    key={key}
                    className="relative overflow-hidden rounded-2xl border border-white/[0.06] p-3.5"
                    style={{ background: `linear-gradient(135deg, #14142a 0%, ${hex}06 100%)` }}
                    data-testid={`pillar-card-${key}`}
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl" style={{ backgroundColor: `${hex}08` }} />
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-md ${config.glow}`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[9px] font-semibold text-white/20 uppercase tracking-wider">{pillar.weight}%</span>
                    </div>
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-3xl font-black tabular-nums text-white" style={{ textShadow: `0 0 20px ${hex}15` }}>
                        {pillar.score}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-white/40">{config.label}</span>
                      <span className="text-[9px] font-semibold" style={{ color: hex }}>{scoreLabel}</span>
                    </div>
                    {key === "activity" && pillar.steps !== undefined && (
                      <div className="text-[10px] text-white/30 mt-1 tabular-nums">
                        {pillar.steps > 0 ? `${pillar.steps.toLocaleString()} / ${(pillar.targetSteps || 7000).toLocaleString()} steps` : "No steps synced"}
                      </div>
                    )}
                    {key === "recovery" && pillar.sleepHours && (
                      <div className="text-[10px] text-white/30 mt-1">
                        {pillar.sleepHours}h sleep{pillar.restingHR ? ` · ${pillar.restingHR} bpm` : ""}
                      </div>
                    )}
                    <div className="h-1 rounded-full overflow-hidden bg-white/[0.04] mt-2.5">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pillar.score}%`, background: `linear-gradient(90deg, ${hex}88, ${hex})` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {daily.reasons && daily.reasons.length > 0 && (
              <div className="rounded-2xl border border-white/[0.06] overflow-hidden mb-4" style={{ background: "linear-gradient(135deg, #14142a 0%, #161630 100%)" }} data-testid="reasons-card">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3.5">
                    <Info className="w-4 h-4 text-white/30" />
                    <h3 className="text-[13px] font-bold text-white">What Shaped Your Score</h3>
                  </div>
                  <div className="space-y-2">
                    {daily.reasons.filter((r: any) => r.pillar !== "streak").map((r: any, i: number) => {
                      const config = PILLAR_CONFIG[r.pillar];
                      const isPositive = r.delta === "+" || r.delta === "+full" || r.delta === "+0";
                      const isPending = r.delta === "~";
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-3 p-3 rounded-xl border ${
                            isPositive ? "bg-green-500/[0.06] border-green-500/10" : isPending ? "bg-amber-500/[0.06] border-amber-500/10" : "bg-red-500/[0.06] border-red-500/10"
                          }`}
                          data-testid={`reason-${i}`}
                        >
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 shrink-0 ${
                            isPositive ? "bg-green-500/20" : isPending ? "bg-amber-500/20" : "bg-red-500/20"
                          }`}>
                            {isPositive ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : isPending ? (
                              <Minus className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-red-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-[12px] leading-relaxed ${isPositive ? "text-white/70" : isPending ? "text-white/60" : "text-white/55"}`}>{r.text}</span>
                            {config && (
                              <span className="text-[10px] text-white/25 ml-1.5">{config.label}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {daily.tips && daily.tips.length > 0 && (
              <div className="rounded-2xl border border-white/[0.06] overflow-hidden mb-4" style={{ background: "linear-gradient(135deg, #1a1a20 0%, #18182e 100%)" }} data-testid="tips-card">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-[13px] font-bold text-white">Tips to Improve</h3>
                  </div>
                  <div className="space-y-2">
                    {daily.tips.map((tip: string, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/8">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                        <span className="text-[12px] text-white/55 leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <WeeklyInsights profile={contextProfile} />

            {trendData.length >= 3 && (
              <div className="rounded-2xl border border-white/[0.06] overflow-hidden mb-4" style={{ background: "linear-gradient(135deg, #14142a 0%, #161630 100%)" }} data-testid="trend-card">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[13px] font-bold text-white">7-Day Trend</h3>
                    <TrendingUp className="w-4 h-4 text-white/15" />
                  </div>
                  <MiniTrend data={trendData} />
                </div>
              </div>
            )}
          </>
        )}

        <div className="space-y-3">
          <FitnessCreditCard data={fitnessCredit} />
          <LeagueSection userId={authUser?.id} />
        </div>
      </div>
    </div>
  );
}
