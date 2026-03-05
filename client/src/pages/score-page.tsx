import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Target, Utensils, Heart, Activity, Lock, Settings, Check, X, ChevronRight, Flame, Footprints, Moon, Dumbbell, Sparkles } from "lucide-react";
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
  green: "rgba(34,197,94,0.12)",
  blue: "rgba(59,130,246,0.12)",
  yellow: "rgba(234,179,8,0.12)",
  orange: "rgba(249,115,22,0.12)",
  red: "rgba(239,68,68,0.12)",
};

const PILLAR_CONFIG: Record<string, { label: string; icon: any; description: string; gradient: string }> = {
  workout: { label: "Workout", icon: Dumbbell, description: "Track your training sessions", gradient: "from-violet-500 to-purple-600" },
  nutrition: { label: "Nutrition", icon: Utensils, description: "Monitor meals and macros", gradient: "from-emerald-500 to-green-600" },
  activity: { label: "Activity", icon: Footprints, description: "Steps and daily movement", gradient: "from-blue-500 to-cyan-600" },
  recovery: { label: "Recovery", icon: Moon, description: "Sleep, HRV and rest quality", gradient: "from-amber-500 to-orange-600" },
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

function ScoreRing({ score, color, size = 180, strokeWidth = 10, label, isLive }: { score: number; color: string; size?: number; strokeWidth?: number; label?: string; isLive?: boolean }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const hex = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={hex} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" className="transition-all duration-1000 ease-out" style={{ filter: `drop-shadow(0 0 8px ${hex}40)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums text-white" data-testid="score-value">
          <AnimatedNumber value={score} />
        </span>
        {label && <span className="text-xs font-medium mt-0.5" style={{ color: hex }}>{label}</span>}
        {isLive && (
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-white/40 font-medium">LIVE</span>
          </div>
        )}
      </div>
    </div>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" data-testid="pillar-setup-sheet">
      <div className="w-full max-w-md bg-[#1a1a2e] rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-300">
        <div className="w-12 h-1 rounded-full bg-white/20 mx-auto mb-6" />
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-500/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Personalize Your Score</h2>
          <p className="text-sm text-white/50 mt-1">Choose pillars that match your fitness focus</p>
        </div>

        <div className="space-y-3 mb-6">
          {Object.entries(PILLAR_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const isSelected = selected.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
                  isSelected ? "border-white/20 bg-white/[0.08]" : "border-white/[0.06] bg-white/[0.02]"
                }`}
                data-testid={`pillar-toggle-${key}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-white">{config.label}</div>
                  <div className="text-xs text-white/40">{config.description}</div>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? "border-green-400 bg-green-400/20" : "border-white/20"
                }`}>
                  {isSelected && <Check className="w-3.5 h-3.5 text-green-400" />}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-white/30 text-center mb-4">
          Weights redistribute proportionally based on your selection
        </p>

        <Button
          onClick={() => onComplete(selected)}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-semibold shadow-lg shadow-purple-500/20"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="pillar-settings-modal">
      <div className="w-full max-w-sm bg-[#1a1a2e] rounded-2xl p-5 mx-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Score Pillars</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center" data-testid="button-close-settings">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        <div className="space-y-2.5 mb-5">
          {Object.entries(PILLAR_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const isSelected = selected.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  isSelected ? "border-white/15 bg-white/[0.06]" : "border-white/[0.04] bg-white/[0.02] opacity-60"
                }`}
                data-testid={`settings-pillar-${key}`}
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="flex-1 text-left text-sm font-medium text-white">{config.label}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? "border-green-400 bg-green-400/20" : "border-white/20"
                }`}>
                  {isSelected && <Check className="w-3 h-3 text-green-400" />}
                </div>
              </button>
            );
          })}
        </div>

        <Button
          onClick={() => onSave(selected)}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold"
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
  const barWidth = 100 / last7.length;

  return (
    <div className="flex items-end gap-1 h-10" data-testid="mini-trend">
      {last7.map((d, i) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-sm transition-all duration-500"
            style={{
              height: `${Math.max(d.score * 0.4, 4)}px`,
              backgroundColor: COLOR_MAP[d.color] || COLOR_MAP.blue,
              opacity: i === last7.length - 1 ? 1 : 0.5,
            }}
          />
          <span className="text-[8px] text-white/25 font-medium">
            {new Date(d.date + "T00:00:00").toLocaleDateString("en", { weekday: "narrow" })}
          </span>
        </div>
      ))}
    </div>
  );
}

function FitnessCreditCard({ data }: { data: any }) {
  if (!data) return null;

  if (data.building) {
    return (
      <Card className="bg-[#12121f] border-white/[0.06] overflow-hidden" data-testid="fitness-credit-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center border border-white/[0.06]">
              <Lock className="w-5 h-5 text-white/30" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Fitness Credit</h3>
              <p className="text-xs text-white/40">Building your score...</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-white/50">{data.daysCompleted} of {data.daysRequired} days</span>
            <span className="text-xs font-semibold text-white/60">{data.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-700" style={{ width: `${data.progress}%` }} />
          </div>
          <p className="text-[10px] text-white/30 mt-2">Track consistently for {data.daysRequired} days to unlock your Fitness Credit score</p>
        </CardContent>
      </Card>
    );
  }

  const tier = data.tier || "building";
  const tierLabel = data.tierLabel || "Building";
  const tierColor = COLOR_MAP[data.tierColor || "blue"] || COLOR_MAP.blue;

  return (
    <Card className="bg-[#12121f] border-white/[0.06] overflow-hidden" data-testid="fitness-credit-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tierColor}15`, border: `1px solid ${tierColor}30` }}>
              <Sparkles className="w-5 h-5" style={{ color: tierColor }} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Fitness Credit</h3>
              <p className="text-xs" style={{ color: tierColor }}>{tierLabel}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums text-white" data-testid="fitness-credit-value">
              <AnimatedNumber value={data.score} />
            </div>
            <span className="text-[10px] text-white/30">/1000</span>
          </div>
        </div>
        {data.delta !== undefined && data.delta !== 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            {data.delta > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={`text-xs font-medium ${data.delta > 0 ? "text-green-400" : "text-red-400"}`}>
              {data.delta > 0 ? "+" : ""}{data.delta} from last calculation
            </span>
          </div>
        )}
      </CardContent>
    </Card>
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a14] p-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/")} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center border border-white/[0.06]" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>
          <h1 className="text-lg font-bold text-white">OGym Score</h1>
        </div>
        <div className="flex flex-col items-center gap-4 pt-16">
          <div className="w-44 h-44 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="w-32 h-5 rounded bg-white/[0.06] animate-pulse" />
          <div className="grid grid-cols-2 gap-3 w-full mt-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-xl bg-white/[0.04] animate-pulse" />)}
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center border border-white/[0.06]" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 text-white/60" />
            </button>
            <h1 className="text-lg font-bold text-white">OGym Score</h1>
          </div>
          <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center border border-white/[0.06]" data-testid="button-settings">
            <Settings className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {daily && (
          <>
            <div className="flex flex-col items-center mb-6">
              <ScoreRing score={daily.score} color={daily.color} isLive={daily.isLive} label={daily.label} />

              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  {daily.trend === "up" ? (
                    <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  ) : daily.trend === "down" ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-white/30" />
                  )}
                  <span className="text-xs text-white/50">vs yesterday</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <span className="text-xs text-white/50">7-day avg: <span className="text-white/70 font-semibold">{daily.avg7Day}</span></span>
              </div>
            </div>

            {yesterday && (
              <Card className="bg-[#12121f] border-white/[0.06] mb-4" data-testid="yesterday-card">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: COLOR_BG_MAP[yesterday.color] }}>
                      <span className="text-sm font-bold" style={{ color: COLOR_MAP[yesterday.color] }}>{yesterday.score}</span>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-white/60">Yesterday</span>
                      <span className="text-[10px] text-white/30 ml-1.5">{yesterday.label}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-white/10 text-white/40">{yesterday.date}</Badge>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              {Object.entries(pillars).map(([key, pillar]: [string, any]) => {
                if (!pillar.enabled) return null;
                const config = PILLAR_CONFIG[key];
                if (!config) return null;
                const Icon = config.icon;
                const hex = COLOR_MAP[pillar.color] || COLOR_MAP.blue;

                return (
                  <Card key={key} className="bg-[#12121f] border-white/[0.06] overflow-hidden" data-testid={`pillar-card-${key}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`} style={{ boxShadow: `0 2px 8px ${hex}25` }}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-white/70 block truncate">{config.label}</span>
                          <span className="text-[9px] text-white/30">{pillar.weight}%</span>
                        </div>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-black tabular-nums text-white">{pillar.score}</span>
                        <span className="text-[10px] mb-1 font-medium" style={{ color: hex }}>
                          {pillar.score >= 90 ? "Excellent" : pillar.score >= 70 ? "Strong" : pillar.score >= 50 ? "Moderate" : pillar.score >= 30 ? "Low" : "—"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06] mt-2">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pillar.score}%`, backgroundColor: hex }} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {daily.reasons && daily.reasons.length > 0 && (
              <Card className="bg-[#12121f] border-white/[0.06] mb-4" data-testid="reasons-card">
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold text-white mb-3">What Shaped Your Score</h3>
                  <div className="space-y-2.5">
                    {daily.reasons.map((r: any, i: number) => {
                      const config = PILLAR_CONFIG[r.pillar];
                      const isPositive = r.delta === "+" || r.delta === "+full" || r.delta === "+0";
                      const isPending = r.delta === "~";
                      return (
                        <div key={i} className="flex items-start gap-2.5" data-testid={`reason-${i}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                            isPositive ? "bg-green-500/15" : isPending ? "bg-yellow-500/15" : "bg-red-500/15"
                          }`}>
                            {isPositive ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : isPending ? (
                              <Minus className="w-3 h-3 text-yellow-400" />
                            ) : (
                              <X className="w-3 h-3 text-red-400" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="text-xs text-white/70">{r.text}</span>
                            {config && (
                              <span className="text-[10px] text-white/25 ml-1.5">{config.label}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {daily.tips && daily.tips.length > 0 && (
              <Card className="bg-[#12121f] border-white/[0.06] mb-4" data-testid="tips-card">
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold text-white mb-2">Tips</h3>
                  <div className="space-y-2">
                    {daily.tips.map((tip: string, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-xs text-white/60">{tip}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {trendData.length >= 3 && (
              <Card className="bg-[#12121f] border-white/[0.06] mb-4" data-testid="trend-card">
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold text-white mb-3">7-Day Trend</h3>
                  <MiniTrend data={trendData} />
                </CardContent>
              </Card>
            )}
          </>
        )}

        <FitnessCreditCard data={fitnessCredit} />
      </div>
    </div>
  );
}
