import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Shield, Target, Utensils, Flame, Heart, Activity, Lock, Eye, EyeOff, ChevronDown, ChevronUp, RefreshCw, Info, X, Sparkles, Award, Zap, Calendar, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";

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

function MiniSparkline({ data, color, height = 32 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length < 3) return <span className="text-xs text-white/30 tabular-nums">--</span>;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 120;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace('#','')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width} cy={parseFloat(points.split(" ").pop()?.split(",")[1] || "0")} r="3" fill={color} />
    </svg>
  );
}

function PillarCard({ label, score, icon, gradientFrom, gradientTo, color }: { label: string; score: number; icon: any; gradientFrom: string; gradientTo: string; color: string }) {
  const Icon = icon;
  return (
    <div className="rounded-xl p-3 border border-white/[0.06]" style={{ backgroundColor: `${color}08` }} data-testid={`pillar-${label.toLowerCase()}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradientFrom} ${gradientTo} flex items-center justify-center shadow-lg`} style={{ boxShadow: `0 4px 12px ${color}30` }}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-semibold text-white/70">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-black tabular-nums text-white">{score}</span>
        <span className="text-[10px] text-white/25 font-medium mb-1">/100</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06] mt-1.5">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}50` }} />
      </div>
    </div>
  );
}

function FactorRow({ label, score, weight, icon }: { label: string; score: number; weight: number; icon: any }) {
  const Icon = icon;
  const barColor = score >= 80 ? "#34d399" : score >= 60 ? "#60a5fa" : score >= 40 ? "#fb923c" : "#f87171";
  return (
    <div className="flex items-center gap-3" data-testid={`factor-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center border border-white/[0.06]">
        <Icon className="w-4 h-4 text-white/50" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-white/70">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white tabular-nums">{score}</span>
            <span className="text-[10px] text-white/30">({weight}%)</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: barColor, boxShadow: `0 0 6px ${barColor}40` }} />
        </div>
      </div>
    </div>
  );
}

export default function ScorePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAllReasons, setShowAllReasons] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const { data: scoreData, isLoading } = useQuery<any>({
    queryKey: ["/api/discipline/score/today"],
  });

  const { data: history } = useQuery<any[]>({
    queryKey: ["/api/discipline/score/history"],
  });

  const { data: ogymHistory } = useQuery<any[]>({
    queryKey: ["/api/discipline/ogym-history"],
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/discipline/settings"],
  });

  const calculateOGym = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/discipline/calculate-ogym");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discipline/score/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/discipline/ogym-history"] });
      toast({ title: "OGym Score updated" });
    },
  });

  const updateVisibility = useMutation({
    mutationFn: async (visibility: string) => {
      const res = await apiRequest("PATCH", "/api/discipline/settings", { visibility });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discipline/settings"] });
      toast({ title: "Privacy updated" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-gradient-to-b from-[#1a1a2e] to-[#121228]">
        <RefreshCw className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }

  const daily = scoreData?.daily;
  const ogym = scoreData?.ogym;

  const recentScores = history?.slice(-7).map((h: any) => h.score) || [];
  const avgScore = recentScores.length > 0 ? Math.round(recentScores.reduce((a: number, b: number) => a + b, 0) / recentScores.length) : 0;
  const weekWorkouts = history?.slice(-7).filter((h: any) => h.score >= 30).length || 0;

  const tierConfig: Record<string, { color: string; bg: string; ring: string; badge: string }> = {
    elite: { color: "#facc15", bg: "from-yellow-500/20 to-amber-500/20", ring: "#facc15", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/25" },
    strong: { color: "#34d399", bg: "from-emerald-500/20 to-green-500/20", ring: "#34d399", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/25" },
    building: { color: "#60a5fa", bg: "from-blue-500/20 to-indigo-500/20", ring: "#60a5fa", badge: "bg-blue-500/20 text-blue-300 border-blue-500/25" },
    inconsistent: { color: "#fb923c", bg: "from-orange-500/20 to-amber-500/20", ring: "#fb923c", badge: "bg-orange-500/20 text-orange-300 border-orange-500/25" },
    "at-risk": { color: "#f87171", bg: "from-red-500/20 to-rose-500/20", ring: "#f87171", badge: "bg-red-500/20 text-red-300 border-red-500/25" },
  };
  const tc = tierConfig[ogym?.tier] || tierConfig.building;
  const dailyColor = (daily?.score || 0) >= 70 ? "#34d399" : (daily?.score || 0) >= 40 ? "#fb923c" : "#f87171";

  return (
    <div className="max-w-lg mx-auto pb-8 min-h-screen bg-gradient-to-b from-[#1a1a2e] via-[#16213e] to-[#121228]">
      {/* Dark gradient header area */}
      <div className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-indigo-500/15 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-tr-full" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/[0.04] rounded-full blur-3xl" />

        <div className="relative z-10 px-4 pt-4 pb-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-white/70 hover:text-white hover:bg-white/10" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-white flex-1">OGym Score</h1>
            <Button variant="ghost" size="icon" onClick={() => setShowInfoModal(true)} className="text-white/50 hover:text-white hover:bg-white/10" data-testid="button-score-info">
              <Info className="w-5 h-5" />
            </Button>
          </div>

          {/* Two Circles */}
          <div className="flex items-center justify-center gap-8 py-3">
            {/* Left — OGym / Fitness Credit */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  {ogym?.building ? (
                    <circle cx="60" cy="60" r="50" fill="none" stroke="url(#hGrad)" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${((ogym.progress || 0) / 100) * 314.2} 314.2`}
                      transform="rotate(-90 60 60)" className="transition-all duration-1000"
                      style={{ filter: 'drop-shadow(0 0 10px rgba(129,140,248,0.5))' }} />
                  ) : ogym?.score ? (
                    <circle cx="60" cy="60" r="50" fill="none" stroke={tc.ring} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${Math.max(0.05, (ogym.score - 300) / 550) * 314.2} 314.2`}
                      transform="rotate(-90 60 60)" className="transition-all duration-1000"
                      style={{ filter: `drop-shadow(0 0 12px ${tc.ring}50)` }} />
                  ) : (
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" strokeDasharray="8 6" />
                  )}
                  <defs>
                    <linearGradient id="hGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {ogym?.building ? (
                    <>
                      <span className="text-3xl font-black text-white tabular-nums"><AnimatedNumber value={ogym.daysCompleted || 0} /></span>
                      <span className="text-[10px] text-white/35 font-medium mt-0.5">of {ogym.daysRequired} days</span>
                    </>
                  ) : ogym?.score ? (
                    <>
                      <span className="text-3xl font-black text-white tabular-nums" style={{ textShadow: `0 0 24px ${tc.ring}40` }}><AnimatedNumber value={ogym.score} /></span>
                      <span className={`text-[9px] font-bold mt-1 px-2 py-0.5 rounded-full border ${tc.badge}`}>{ogym.tierLabel || ogym.tier}</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-6 h-6 text-white/20" />
                      <span className="text-[9px] text-white/25 mt-1">No data</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-white/60">Fitness Credit</p>
                <p className="text-[9px] text-white/30">{ogym?.building ? "Unlocking..." : "300–850"}</p>
              </div>
            </div>

            <div className="w-px h-24 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

            {/* Right — Today's Score */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  {daily && (
                    <circle cx="60" cy="60" r="50" fill="none" stroke={dailyColor} strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${(daily.score / 100) * 314.2} 314.2`}
                      transform="rotate(-90 60 60)" className="transition-all duration-1000"
                      style={{ filter: `drop-shadow(0 0 12px ${dailyColor}50)` }} />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-white tabular-nums" style={{ textShadow: `0 0 24px ${dailyColor}40` }}>
                    <AnimatedNumber value={daily?.score || 0} />
                  </span>
                  <span className="text-[10px] text-white/35 font-medium mt-0.5">/100</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-white/60">Today's Score</p>
                <p className="text-[9px] text-white/30">
                  {(daily?.score || 0) >= 70 ? "Great day" : (daily?.score || 0) >= 40 ? "Keep going" : "Just start"}
                </p>
              </div>
            </div>
          </div>

          {/* OGym delta + scale bar */}
          {ogym?.score && (
            <div className="mt-3 px-2">
              {ogym.delta != null && ogym.delta !== 0 && (
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  {ogym.delta > 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                  <span className={`text-xs font-bold ${ogym.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {ogym.delta > 0 ? "+" : ""}{ogym.delta} from last week
                  </span>
                </div>
              )}
              <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(2, ((ogym.score - 300) / 550) * 100)}%`, background: `linear-gradient(90deg, ${tc.ring}80, ${tc.ring})`, boxShadow: `0 0 8px ${tc.ring}40` }} />
                {[63.6, 72.7, 81.8].map((gate, i) => (
                  <div key={i} className="absolute top-0 bottom-0 w-px bg-white/15" style={{ left: `${gate}%` }} />
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-white/25 font-medium mt-1 px-0.5">
                <span>300</span><span>650</span><span>700</span><span>750</span><span>850</span>
              </div>
            </div>
          )}

          {/* Weekly Summary */}
          {history && history.length > 1 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-2.5 text-center">
                <p className="text-lg font-black text-white tabular-nums">{weekWorkouts}</p>
                <p className="text-[9px] text-white/40 font-medium">This Week</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-2.5 text-center">
                <p className="text-lg font-black text-white tabular-nums">{avgScore}</p>
                <p className="text-[9px] text-white/40 font-medium">Avg Score</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-2.5 flex flex-col items-center justify-center">
                <MiniSparkline data={recentScores} color={dailyColor} height={24} />
                <p className="text-[9px] text-white/40 font-medium mt-0.5">7-Day Trend</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content below header */}
      <div className="space-y-3 px-4 pt-1">
        {/* Today's Pillars */}
        {daily && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1e1e3a] to-[#1a2744] p-4 shadow-lg" data-testid="card-daily-score">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-white/50" />
                <span className="text-sm font-bold text-white">Today's Breakdown</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-white/30">7-day avg: {daily.avg7Day}</span>
                <span className="text-[10px] text-white/20">·</span>
                <span className="text-[10px] text-white/40 font-medium">{daily.label}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PillarCard label="Workout" score={daily.pillars.workout.score} icon={Target} gradientFrom="from-blue-500" gradientTo="to-indigo-600" color="#60a5fa" />
              <PillarCard label="Nutrition" score={daily.pillars.nutrition.score} icon={Utensils} gradientFrom="from-emerald-500" gradientTo="to-green-600" color="#34d399" />
              <PillarCard label="Consistency" score={daily.pillars.consistency.score} icon={Flame} gradientFrom="from-orange-500" gradientTo="to-amber-600" color="#fb923c" />
              <PillarCard label="Recovery" score={daily.pillars.recovery.score} icon={Heart} gradientFrom="from-purple-500" gradientTo="to-pink-600" color="#a78bfa" />
            </div>
          </div>
        )}

        {/* Score Factors (OGym breakdown) */}
        {ogym?.score && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1e1e3a] to-[#1a2744] p-4 shadow-lg" data-testid="card-ogym-factors">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-white/50" />
              <span className="text-sm font-bold text-white">Score Factors</span>
            </div>
            <div className="space-y-3">
              <FactorRow label="Workout Adherence" score={ogym.workoutAdherence} weight={25} icon={Target} />
              <FactorRow label="Nutrition Discipline" score={ogym.nutritionDiscipline} weight={20} icon={Utensils} />
              <FactorRow label="Consistency" score={ogym.consistency} weight={20} icon={Flame} />
              <FactorRow label="Protein Compliance" score={ogym.proteinCompliance} weight={10} icon={Zap} />
              <FactorRow label="Recovery Respect" score={ogym.recoveryRespect} weight={10} icon={Heart} />
              <FactorRow label="Engagement" score={ogym.engagement} weight={15} icon={Activity} />
            </div>
          </div>
        )}

        {/* Gates */}
        {ogym?.gatesApplied && ogym.gatesApplied.length > 0 && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500/[0.08] to-amber-500/[0.04] border border-orange-500/15 p-4" data-testid="gates-applied">
            <h4 className="text-sm font-semibold text-orange-500 dark:text-orange-400 flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" /> Score Gates Active
            </h4>
            {(ogym.reasons as any[])?.filter((r: any) => r.direction === "down").map((r: any, i: number) => (
              <p key={i} className="text-xs text-orange-600 dark:text-orange-400 mb-1">{r.text}</p>
            ))}
          </div>
        )}

        {/* What shaped your score */}
        {daily?.reasons && daily.reasons.length > 0 && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1e1e3a] to-[#1a2744] p-4 shadow-lg" data-testid="card-reasons">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-white/50" />
              <span className="text-sm font-bold text-white">What Shaped Your Score</span>
            </div>
            <div className="space-y-2">
              {(showAllReasons ? daily.reasons : daily.reasons.slice(0, 3)).map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={`text-xs font-mono font-bold min-w-[36px] mt-0.5 ${
                    r.delta.startsWith("+") ? "text-emerald-400" : r.delta.startsWith("-") ? "text-red-400" : "text-white/30"
                  }`}>{r.delta}</span>
                  <span className="text-xs text-white/60">{r.text}</span>
                </div>
              ))}
            </div>
            {daily.reasons.length > 3 && (
              <Button variant="ghost" size="sm" className="w-full mt-2 text-white/40 hover:text-white/70 hover:bg-white/[0.04]" onClick={() => setShowAllReasons(!showAllReasons)} data-testid="button-toggle-reasons">
                {showAllReasons ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                <span className="text-xs">{showAllReasons ? "Show less" : `Show all ${daily.reasons.length} reasons`}</span>
              </Button>
            )}
          </div>
        )}

        {/* Tips */}
        {daily?.tips && daily.tips.length > 0 && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500/[0.08] to-purple-500/[0.04] border border-indigo-500/15 p-4" data-testid="card-tips">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-indigo-400">Tips to Improve</span>
            </div>
            {daily.tips.map((tip: string, i: number) => (
              <p key={i} className="text-xs text-indigo-300/70 flex items-start gap-2 mb-1">
                <span className="text-indigo-400 mt-0.5">•</span> {tip}
              </p>
            ))}
          </div>
        )}

        {/* Daily Score Trend Chart */}
        {history && history.length > 1 && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1e1e3a] to-[#1a2744] p-4 shadow-lg" data-testid="card-history">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-white/50" />
              <span className="text-sm font-bold text-white">Daily Score Trend</span>
            </div>
            <div className="flex items-end gap-[2px] h-20">
              {history.slice(-30).map((h: any, i: number) => {
                const barHeight = Math.max(3, (h.score / 100) * 76);
                const barColor = h.score >= 75 ? "#34d399" : h.score >= 50 ? "#60a5fa" : h.score >= 25 ? "#fb923c" : "#f87171";
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end group cursor-default" title={`${h.date}: ${h.score}`}>
                    <div className="rounded-t-sm transition-all group-hover:opacity-100 opacity-80"
                      style={{ height: `${barHeight}px`, backgroundColor: barColor, boxShadow: `0 0 4px ${barColor}30` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-white/25 mt-1.5 font-medium">
              <span>{history[Math.max(0, history.length - 30)]?.date?.slice(5)}</span>
              <span>{history[history.length - 1]?.date?.slice(5)}</span>
            </div>
          </div>
        )}

        {/* OGym History */}
        {ogymHistory && ogymHistory.length > 1 && (
          <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1e1e3a] to-[#1a2744] p-4 shadow-lg" data-testid="card-ogym-history">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-white/50" />
              <span className="text-sm font-bold text-white">Score History</span>
            </div>
            <div className="space-y-1.5">
              {ogymHistory.slice(0, 8).map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-xs text-white/40">Week of {h.weekEndDate?.slice(5)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tabular-nums">{h.score}</span>
                    {h.delta !== null && h.delta !== undefined && (
                      <span className={`text-[10px] font-bold tabular-nums ${h.delta > 0 ? "text-emerald-400" : h.delta < 0 ? "text-red-400" : "text-white/25"}`}>
                        {h.delta > 0 ? "+" : ""}{h.delta}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Privacy */}
        <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#1e1e3a] to-[#1a2744] p-4 shadow-lg" data-testid="card-privacy">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-white/50" />
              <div>
                <p className="text-sm font-semibold text-white">Privacy</p>
                <p className="text-[10px] text-white/35">
                  {settings?.visibility === "public" ? "Everyone can see" : settings?.visibility === "coach" ? "Trainer & gym owner" : "Only you"}
                </p>
              </div>
            </div>
            <Select
              value={settings?.visibility || "coach"}
              onValueChange={(v) => updateVisibility.mutate(v)}
            >
              <SelectTrigger className="w-28 bg-white/[0.06] border-white/[0.08] text-white text-xs h-8" data-testid="select-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Public</span>
                </SelectItem>
                <SelectItem value="coach">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Coach only</span>
                </SelectItem>
                <SelectItem value="private">
                  <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Private</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setShowInfoModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl mx-0 sm:mx-4 animate-in slide-in-from-bottom duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b p-4 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-lg font-bold">How Scores Work</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowInfoModal(false)} data-testid="button-close-info">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-5">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-green-500" />
                  <h3 className="text-sm font-bold">Daily Discipline Score (0–100)</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Calculated fresh every day based on 4 pillars of your fitness routine. This reflects how well you're doing today.
                </p>
                <div className="space-y-2 pl-1">
                  {[
                    { name: "Workout", pct: "35%", desc: "Did you complete your scheduled workout? Partial credit for some exercises." },
                    { name: "Nutrition", pct: "25%", desc: "Did you log meals and hit your calorie/protein targets?" },
                    { name: "Consistency", pct: "25%", desc: "Based on your current streak and recent workout frequency." },
                    { name: "Recovery", pct: "15%", desc: "Sleep, hydration, and rest day adherence." },
                  ].map((p) => (
                    <div key={p.name} className="flex gap-2 text-xs">
                      <span className="font-semibold text-foreground min-w-[90px]">{p.name} ({p.pct})</span>
                      <span className="text-muted-foreground">{p.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-400 to-purple-500" />
                  <h3 className="text-sm font-bold">Fitness Credit Score (300–850)</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Like a credit score but for fitness. Updated weekly, it looks at your last 30 days across 6 factors. Higher is better.
                </p>
                <div className="space-y-2 pl-1">
                  {[
                    { name: "Avg Daily Score", pct: "25%", desc: "Your average daily discipline score over 30 days." },
                    { name: "Workout Frequency", pct: "20%", desc: "How often you trained vs your plan." },
                    { name: "Nutrition Logging", pct: "15%", desc: "How consistently you logged meals." },
                    { name: "Streak Length", pct: "15%", desc: "Your longest and current workout streaks." },
                    { name: "Trend Direction", pct: "15%", desc: "Are your daily scores improving or declining?" },
                    { name: "Recovery Quality", pct: "10%", desc: "How well you maintain sleep and hydration." },
                  ].map((f) => (
                    <div key={f.name} className="flex gap-2 text-xs">
                      <span className="font-semibold text-foreground min-w-[120px]">{f.name} ({f.pct})</span>
                      <span className="text-muted-foreground">{f.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500" />
                  <h3 className="text-sm font-bold">Score Tiers</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { tier: "Elite", range: "750–850", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10" },
                    { tier: "Strong", range: "700–749", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
                    { tier: "Building", range: "650–699", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
                    { tier: "Inconsistent", range: "500–649", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
                    { tier: "At Risk", range: "300–499", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
                  ].map((t) => (
                    <div key={t.tier} className={`p-2 rounded-lg ${t.bg} flex items-center justify-between`}>
                      <span className={`text-xs font-bold ${t.color}`}>{t.tier}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{t.range}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" /> Privacy
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your scores are private by default. You can choose to share them with your trainer, your gym, or keep them completely private.
                </p>
              </div>

              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
                  Scores require at least 14 days of activity data to generate your first Fitness Credit Score. Daily scores are available immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
