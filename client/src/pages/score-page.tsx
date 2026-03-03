import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Shield, Target, Utensils, Flame, Heart, Activity, Lock, Eye, EyeOff, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

function ScoreGauge({ score, maxScore = 850, minScore = 300, size = "large" }: { score: number; maxScore?: number; minScore?: number; size?: "large" | "small" }) {
  const range = maxScore - minScore;
  const normalizedScore = Math.max(0, Math.min(1, (score - minScore) / range));
  const angle = -135 + normalizedScore * 270;
  const isLarge = size === "large";
  const r = isLarge ? 90 : 50;
  const cx = isLarge ? 110 : 60;
  const cy = isLarge ? 110 : 60;
  const strokeWidth = isLarge ? 14 : 8;

  const arcPath = (startAngle: number, endAngle: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const needleRad = (angle * Math.PI) / 180;
  const needleLen = r - (isLarge ? 20 : 10);
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy + needleLen * Math.sin(needleRad);

  const svgSize = isLarge ? 220 : 120;

  return (
    <div className="flex flex-col items-center" data-testid="score-gauge">
      <svg width={svgSize} height={svgSize * 0.7} viewBox={`0 0 ${svgSize} ${svgSize * 0.75}`}>
        <path d={arcPath(-225, -180)} stroke="#ef4444" strokeWidth={strokeWidth} fill="none" strokeLinecap="round" opacity={0.3} />
        <path d={arcPath(-180, -135)} stroke="#f97316" strokeWidth={strokeWidth} fill="none" opacity={0.3} />
        <path d={arcPath(-135, -90)} stroke="#3b82f6" strokeWidth={strokeWidth} fill="none" opacity={0.3} />
        <path d={arcPath(-90, -20)} stroke="#22c55e" strokeWidth={strokeWidth} fill="none" opacity={0.3} />
        <path d={arcPath(-20, 45)} stroke="#eab308" strokeWidth={strokeWidth} fill="none" opacity={0.3} />

        <path d={arcPath(-225, angle)} stroke={
          score >= 750 ? "#eab308" : score >= 650 ? "#22c55e" : score >= 500 ? "#3b82f6" : score >= 400 ? "#f97316" : "#ef4444"
        } strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />

        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="currentColor" strokeWidth={isLarge ? 3 : 2} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={isLarge ? 5 : 3} fill="currentColor" />
      </svg>
      <div className={`text-center ${isLarge ? "-mt-4" : "-mt-2"}`}>
        <div className={`font-bold ${isLarge ? "text-4xl" : "text-2xl"}`} data-testid="text-ogym-score">{score}</div>
      </div>
    </div>
  );
}

function PillarBar({ label, score, icon, color }: { label: string; score: number; icon: any; color: string }) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3" data-testid={`pillar-${label.toLowerCase()}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">{score}/100</span>
        </div>
        <Progress value={score} className="h-2" />
      </div>
    </div>
  );
}

function FactorBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  return (
    <div className="space-y-1" data-testid={`factor-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{score} <span className="text-xs">({weight}%)</span></span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 80 ? "bg-green-500" : score >= 60 ? "bg-blue-500" : score >= 40 ? "bg-orange-500" : "bg-red-500"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export default function ScorePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showAllReasons, setShowAllReasons] = useState(false);

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
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const daily = scoreData?.daily;
  const ogym = scoreData?.ogym;

  return (
    <div className="max-w-lg mx-auto pb-8 space-y-4">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold">OGym Score</h1>
      </div>

      <Card className="mx-4" data-testid="card-ogym-score">
        <CardContent className="pt-6">
          {ogym?.building ? (
            <div className="text-center space-y-4 py-4" data-testid="score-building">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-lg">Building your OGym Score...</h3>
                <p className="text-sm text-muted-foreground mt-1">Keep logging workouts and meals to unlock your score</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span className="font-medium">{ogym.daysCompleted} / {ogym.daysRequired} days</span>
                </div>
                <Progress value={ogym.progress} className="h-3" />
              </div>
              <p className="text-xs text-muted-foreground">
                {ogym.daysRequired - ogym.daysCompleted} more days until your first score
              </p>
            </div>
          ) : ogym?.score ? (
            <div className="space-y-4">
              <ScoreGauge score={ogym.score} />
              <div className="text-center space-y-1">
                <Badge
                  className={`text-sm px-3 py-1 ${
                    ogym.tier === "elite" ? "bg-yellow-500/20 text-yellow-600 border-yellow-500/30" :
                    ogym.tier === "strong" ? "bg-green-500/20 text-green-600 border-green-500/30" :
                    ogym.tier === "building" ? "bg-blue-500/20 text-blue-600 border-blue-500/30" :
                    ogym.tier === "inconsistent" ? "bg-orange-500/20 text-orange-600 border-orange-500/30" :
                    "bg-red-500/20 text-red-600 border-red-500/30"
                  }`}
                  variant="outline"
                  data-testid="badge-tier"
                >
                  {ogym.tierLabel || ogym.tier}
                </Badge>
                {ogym.delta !== null && ogym.delta !== undefined && (
                  <div className={`flex items-center justify-center gap-1 text-sm ${
                    ogym.delta > 0 ? "text-green-600" : ogym.delta < 0 ? "text-red-600" : "text-muted-foreground"
                  }`} data-testid="text-ogym-delta">
                    {ogym.delta > 0 ? <TrendingUp className="w-4 h-4" /> : ogym.delta < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    {ogym.delta > 0 ? "+" : ""}{ogym.delta} from last week
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Updated weekly · 300-850 scale</p>
              </div>

              <div className="space-y-3 pt-2">
                <h4 className="font-medium text-sm">Score Factors</h4>
                <FactorBar label="Workout Adherence" score={ogym.workoutAdherence} weight={25} />
                <FactorBar label="Nutrition Discipline" score={ogym.nutritionDiscipline} weight={20} />
                <FactorBar label="Consistency" score={ogym.consistency} weight={20} />
                <FactorBar label="Protein Compliance" score={ogym.proteinCompliance} weight={10} />
                <FactorBar label="Recovery Respect" score={ogym.recoveryRespect} weight={10} />
                <FactorBar label="Engagement" score={ogym.engagement} weight={15} />
              </div>

              {ogym.gatesApplied && ogym.gatesApplied.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-3 space-y-2" data-testid="gates-applied">
                  <h4 className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-1">
                    <Shield className="w-4 h-4" /> Score Gates Active
                  </h4>
                  {(ogym.reasons as any[])?.filter((r: any) => r.direction === "down").map((r: any, i: number) => (
                    <p key={i} className="text-xs text-orange-600 dark:text-orange-400">{r.text}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">No OGym Score yet</p>
              <Button
                size="sm"
                onClick={() => calculateOGym.mutate()}
                disabled={calculateOGym.isPending}
                data-testid="button-calculate-ogym"
              >
                {calculateOGym.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                Generate Score
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {daily && (
        <Card className="mx-4" data-testid="card-daily-score">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Today's Discipline</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" data-testid="text-daily-score">{daily.score}</span>
                <span className="text-sm text-muted-foreground">/100</span>
                {daily.trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
                {daily.trend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
                {daily.trend === "stable" && <Minus className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">7-day avg: {daily.avg7Day} · {daily.label}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <PillarBar label="Workout" score={daily.pillars.workout.score} icon={Target} color="bg-blue-500" />
            <PillarBar label="Nutrition" score={daily.pillars.nutrition.score} icon={Utensils} color="bg-green-500" />
            <PillarBar label="Consistency" score={daily.pillars.consistency.score} icon={Flame} color="bg-orange-500" />
            <PillarBar label="Recovery" score={daily.pillars.recovery.score} icon={Heart} color="bg-purple-500" />
          </CardContent>
        </Card>
      )}

      {daily?.reasons && daily.reasons.length > 0 && (
        <Card className="mx-4" data-testid="card-reasons">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">What shaped your score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(showAllReasons ? daily.reasons : daily.reasons.slice(0, 3)).map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`font-mono text-xs mt-0.5 min-w-[36px] ${
                  r.delta.startsWith("+") ? "text-green-600" : r.delta.startsWith("-") ? "text-red-600" : "text-muted-foreground"
                }`}>{r.delta}</span>
                <span>{r.text}</span>
              </div>
            ))}
            {daily.reasons.length > 3 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAllReasons(!showAllReasons)} data-testid="button-toggle-reasons">
                {showAllReasons ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                {showAllReasons ? "Show less" : `Show all ${daily.reasons.length} reasons`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {daily?.tips && daily.tips.length > 0 && (
        <Card className="mx-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20" data-testid="card-tips">
          <CardContent className="pt-4">
            <h4 className="text-sm font-medium mb-2 text-blue-700 dark:text-blue-400">Tips to improve</h4>
            {daily.tips.map((tip: string, i: number) => (
              <p key={i} className="text-sm text-blue-600 dark:text-blue-400 flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span> {tip}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {history && history.length > 1 && (
        <Card className="mx-4" data-testid="card-history">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Score Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[2px] h-24">
              {history.slice(-30).map((h: any, i: number) => {
                const barHeight = Math.max(4, (h.score / 100) * 96);
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end" title={`${h.date}: ${h.score}`}>
                    <div
                      className={`rounded-t-sm transition-all ${
                        h.score >= 75 ? "bg-green-500" : h.score >= 50 ? "bg-blue-500" : h.score >= 25 ? "bg-orange-500" : "bg-red-500"
                      }`}
                      style={{ height: `${barHeight}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{history[0]?.date?.slice(5)}</span>
              <span>{history[history.length - 1]?.date?.slice(5)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {ogymHistory && ogymHistory.length > 1 && (
        <Card className="mx-4" data-testid="card-ogym-history">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OGym Score History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ogymHistory.slice(0, 8).map((h: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-muted last:border-0">
                <span className="text-muted-foreground">Week of {h.weekEndDate?.slice(5)}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{h.score}</span>
                  {h.delta !== null && h.delta !== undefined && (
                    <span className={`text-xs ${h.delta > 0 ? "text-green-600" : h.delta < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {h.delta > 0 ? "+" : ""}{h.delta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mx-4" data-testid="card-privacy">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4" /> Privacy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Who can see your score</p>
              <p className="text-xs text-muted-foreground">
                {settings?.visibility === "public" ? "Everyone" : settings?.visibility === "coach" ? "Your trainer and gym owner" : "Only you"}
              </p>
            </div>
            <Select
              value={settings?.visibility || "coach"}
              onValueChange={(v) => updateVisibility.mutate(v)}
            >
              <SelectTrigger className="w-32" data-testid="select-visibility">
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
        </CardContent>
      </Card>
    </div>
  );
}
