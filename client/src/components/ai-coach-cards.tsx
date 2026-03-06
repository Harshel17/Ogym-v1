import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, TrendingUp, TrendingDown, Minus, Dumbbell, Utensils, Target,
  Droplets, Flame, ArrowRight, Loader2, RefreshCw, Lightbulb, Sparkles,
  Activity, Zap, ChevronRight, X, MessageCircle, ChevronDown, ChevronUp, BarChart3, Heart,
  Moon, Footprints, Trophy, ChevronLeft,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link, useLocation } from "wouter";

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-orange-500" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

const NUDGE_STYLE: Record<string, { icon: typeof Dumbbell; color: string; bg: string; border: string; glow: string }> = {
  workout: { icon: Dumbbell, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/15", glow: "shadow-violet-500/5" },
  nutrition: { icon: Utensils, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/15", glow: "shadow-emerald-500/5" },
  streak: { icon: Flame, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/15", glow: "shadow-amber-500/5" },
  goal: { icon: Target, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/15", glow: "shadow-blue-500/5" },
  health: { icon: Heart, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/15", glow: "shadow-rose-500/5" },
};

const SENTIMENT_STYLE: Record<string, { accent: string; iconBg: string; label: string }> = {
  positive: { accent: "border-green-500/20", iconBg: "bg-green-500/15", label: "Win" },
  warning: { accent: "border-amber-500/20", iconBg: "bg-amber-500/15", label: "Heads up" },
  info: { accent: "border-white/[0.06]", iconBg: "bg-white/[0.06]", label: "" },
};

type Nudge = {
  id: string;
  message: string;
  type: "workout" | "nutrition" | "streak" | "goal" | "health";
  sentiment?: "positive" | "warning" | "info";
  action?: string;
  link?: string;
};

function FeaturedNudge({ nudge, onDismiss }: { nudge: Nudge; onDismiss: () => void }) {
  const style = NUDGE_STYLE[nudge.type] || NUDGE_STYLE.health;
  const sentiment = nudge.sentiment || "info";
  const isPositive = sentiment === "positive";
  const isWarning = sentiment === "warning";
  const Icon = style.icon;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 ${
        isPositive ? "border-green-500/20 bg-gradient-to-br from-green-500/[0.06] to-emerald-600/[0.02]" :
        isWarning ? "border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-orange-600/[0.02]" :
        "border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01]"
      }`}
      data-testid={`nudge-featured-${nudge.id}`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-30 ${
        isPositive ? "bg-green-500" : isWarning ? "bg-amber-500" : "bg-white/10"
      }`} />

      <div className="relative">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isPositive ? "bg-green-500/15" : isWarning ? "bg-amber-500/15" : style.bg
          }`}>
            {isPositive ? (
              <Trophy className="w-4.5 h-4.5 text-green-400" />
            ) : (
              <Icon className={`w-4.5 h-4.5 ${isWarning ? "text-amber-400" : style.color}`} />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className={`text-[13px] leading-relaxed font-medium ${
              isPositive ? "text-green-100/90" : isWarning ? "text-amber-100/90" : "text-white/70"
            }`}>
              {nudge.message}
            </p>
          </div>
          <button
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.05] transition-colors"
            onClick={onDismiss}
            data-testid={`nudge-dismiss-${nudge.id}`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {nudge.action && nudge.link && (
          <Link href={nudge.link}>
            <div className={`inline-flex items-center gap-1.5 mt-3 ml-12 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              isPositive ? "bg-green-500/15 text-green-400 hover:bg-green-500/25" :
              isWarning ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25" :
              "bg-white/[0.06] text-white/60 hover:bg-white/[0.10]"
            }`} data-testid={`nudge-action-${nudge.id}`}>
              {nudge.action}
              <ChevronRight className="w-3 h-3" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

function CompactNudge({ nudge, onDismiss, onTap }: { nudge: Nudge; onDismiss: () => void; onTap: () => void }) {
  const style = NUDGE_STYLE[nudge.type] || NUDGE_STYLE.health;
  const sentiment = nudge.sentiment || "info";
  const isPositive = sentiment === "positive";
  const isWarning = sentiment === "warning";
  const Icon = style.icon;

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
        isPositive ? "border-green-500/10 bg-green-500/[0.04] hover:bg-green-500/[0.07]" :
        isWarning ? "border-amber-500/10 bg-amber-500/[0.04] hover:bg-amber-500/[0.07]" :
        "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
      data-testid={`nudge-${nudge.id}`}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
        isPositive ? "bg-green-500/12" : isWarning ? "bg-amber-500/12" : style.bg
      }`}>
        {isPositive ? (
          <Trophy className="w-3.5 h-3.5 text-green-400" />
        ) : (
          <Icon className={`w-3.5 h-3.5 ${isWarning ? "text-amber-400" : style.color}`} />
        )}
      </div>
      <p
        className="flex-1 text-[11px] text-white/55 leading-snug min-w-0 cursor-pointer"
        onClick={onTap}
      >
        {nudge.message}
      </p>
      {nudge.link && (
        <Link href={nudge.link}>
          <div className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/[0.05] transition-colors" data-testid={`nudge-go-${nudge.id}`}>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      )}
      <button
        className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-white/15 hover:text-white/40 transition-colors"
        onClick={onDismiss}
        data-testid={`nudge-dismiss-${nudge.id}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function ProactiveNudges() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{
    nudges: Nudge[];
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/nudges"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) return null;

  const allNudges = data?.nudges?.filter(n => !dismissed.includes(n.id)) || [];
  if (allNudges.length === 0) return null;

  const positiveNudges = allNudges.filter(n => n.sentiment === "positive");
  const warningNudges = allNudges.filter(n => n.sentiment === "warning");
  const infoNudges = allNudges.filter(n => n.sentiment === "info" || !n.sentiment);

  const sorted = [...positiveNudges, ...warningNudges, ...infoNudges];
  const featured = sorted[0];
  const rest = sorted.slice(1);

  const MAX_COLLAPSED = 2;
  const visibleRest = expanded ? rest : rest.slice(0, MAX_COLLAPSED);
  const hasMore = rest.length > MAX_COLLAPSED;

  const handleDismiss = (id: string) => setDismissed(prev => [...prev, id]);

  const handleTapNudge = (nudge: Nudge) => {
    if (nudge.link) {
      setLocation(nudge.link);
    }
  };

  return (
    <div className="space-y-2" data-testid="section-ai-nudges">
      {featured && (
        <FeaturedNudge
          nudge={featured}
          onDismiss={() => handleDismiss(featured.id)}
        />
      )}

      {visibleRest.length > 0 && (
        <div className="space-y-1.5">
          {visibleRest.map(nudge => (
            <CompactNudge
              key={nudge.id}
              nudge={nudge}
              onDismiss={() => handleDismiss(nudge.id)}
              onTap={() => handleTapNudge(nudge)}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-white/25 hover:text-white/40 transition-colors"
          onClick={() => setExpanded(!expanded)}
          data-testid="button-toggle-nudges"
        >
          {expanded ? (
            <>Show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>{rest.length - MAX_COLLAPSED} more insight{rest.length - MAX_COLLAPSED > 1 ? 's' : ''} <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

type CoachTab = "progress" | "workouts" | "suggestions";

const tabConfig: { id: CoachTab; label: string; icon: typeof Activity }[] = [
  { id: "progress", label: "Progress", icon: Activity },
  { id: "workouts", label: "Workouts", icon: Dumbbell },
  { id: "suggestions", label: "Focus Areas", icon: Lightbulb },
];

export function AiCoachHub() {
  const [activeTab, setActiveTab] = useState<CoachTab>("progress");
  const [isOpen, setIsOpen] = useState(true);
  const [, setLocation] = useLocation();

  const progress = useQuery<{
    summary: string;
    highlights: { label: string; value: string; trend: "up" | "down" | "stable" }[];
    streaks: { currentStreak: number; longestStreak: number };
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/progress-summary"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });

  const workouts = useQuery<{
    coachNote: string;
    stats: { workoutDays: number; totalExercises: number; topMuscle: string; consistency: string; cardioMinutes: number; cardioSessions: number; favoriteCardio: string | null };
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/workout-insights"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });

  const suggestions = useQuery<{
    suggestions: { title: string; reason: string; priority: "high" | "medium" | "low" }[];
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/workout-suggestions"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });

  const queryMap = { progress, workouts, suggestions } as const;

  function getCurrent() {
    return queryMap[activeTab];
  }

  const current = getCurrent();
  const hasData = current.data as Record<string, unknown> | undefined;
  const isGenerating = current.isLoading || current.isFetching;

  function handleGenerate() {
    current.refetch();
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-visible" data-testid="card-ai-coach-hub">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm shadow-violet-500/20">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Dika AI Insights</h3>
                <p className="text-[10px] text-muted-foreground">Powered by your real data</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasData && !isGenerating && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleGenerate}
                  data-testid="button-refresh-coach"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="button-toggle-coach"
                >
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-4 pb-2">
            <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50">
              {tabConfig.map(tab => {
                const isActive = activeTab === tab.id;
                const TabIcon = tab.icon;
                const tabHasData = queryMap[tab.id].data;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`tab-coach-${tab.id}`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">{tab.label}</span>
                    {tabHasData && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <CardContent className="pt-1 pb-4">
            {!hasData && !isGenerating && (
              <div className="py-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted/50">
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-foreground font-medium">
                    {activeTab === "progress" && "Get your monthly report card"}
                    {activeTab === "workouts" && "Analyze your workout patterns"}
                    {activeTab === "suggestions" && "See what to focus on next"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    AI analyzes your real activity data
                  </p>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleGenerate}
                  data-testid={`button-generate-${activeTab}`}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  {activeTab === "progress" && "Generate Report"}
                  {activeTab === "workouts" && "Analyze Workouts"}
                  {activeTab === "suggestions" && "Get Suggestions"}
                </Button>
              </div>
            )}

            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                <span className="text-xs text-muted-foreground">
                  {activeTab === "progress" && "Building your report..."}
                  {activeTab === "workouts" && "Reviewing your workouts..."}
                  {activeTab === "suggestions" && "Analyzing your patterns..."}
                </span>
              </div>
            )}

            {activeTab === "progress" && progress.data && !progress.isFetching && (
              <ProgressContent data={progress.data} />
            )}

            {activeTab === "workouts" && workouts.data && !workouts.isFetching && (
              <WorkoutsContent data={workouts.data} />
            )}

            {activeTab === "suggestions" && suggestions.data && !suggestions.isFetching && (
              <SuggestionsContent data={suggestions.data} />
            )}

            {hasData && !isGenerating && (
              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] text-muted-foreground">
                  Updated {new Date(String(hasData.generatedAt || "")).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    const prompt = encodeURIComponent("Tell me more about my recent fitness progress and what I should focus on this week");
                    setLocation(`/dika?prompt=${prompt}`);
                  }}
                  data-testid="button-ask-dika-coach"
                >
                  <MessageCircle className="w-3 h-3 mr-1" /> Ask Dika
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function ProgressContent({ data }: {
  data: {
    summary: string;
    highlights: { label: string; value: string; trend: "up" | "down" | "stable" }[];
    streaks: { currentStreak: number; longestStreak: number };
  };
}) {
  return (
    <div className="space-y-3" data-testid="content-progress">
      <div className="grid grid-cols-2 gap-2">
        {data.highlights.map((h, i) => (
          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30" data-testid={`highlight-${h.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <div>
              <p className="text-[10px] text-muted-foreground">{h.label}</p>
              <p className="text-sm font-semibold">{h.value}</p>
            </div>
            <TrendIcon trend={h.trend} />
          </div>
        ))}
      </div>

      {data.streaks.currentStreak > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/10">
          <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="text-sm font-semibold">{data.streaks.currentStreak}-day streak</span>
          {data.streaks.longestStreak > data.streaks.currentStreak && (
            <span className="text-xs text-muted-foreground ml-auto">best: {data.streaks.longestStreak}</span>
          )}
        </div>
      )}

      <p className="text-sm text-foreground leading-relaxed" data-testid="text-progress-summary">{data.summary}</p>
    </div>
  );
}

function WorkoutsContent({ data }: {
  data: {
    coachNote: string;
    stats: { workoutDays: number; totalExercises: number; topMuscle: string; consistency: string; cardioMinutes?: number; cardioSessions?: number; favoriteCardio?: string | null };
  };
}) {
  const consistencyColor = data.stats.consistency === "Excellent"
    ? "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/15"
    : data.stats.consistency === "Good"
      ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/15"
      : "text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/15";

  const hasCardioData = (data.stats.cardioMinutes || 0) > 0 || (data.stats.cardioSessions || 0) > 0;

  return (
    <div className="space-y-3" data-testid="content-workouts">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="text-center">
            <p className="text-lg font-bold">{data.stats.workoutDays}</p>
            <p className="text-[10px] text-muted-foreground">days</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-lg font-bold">{data.stats.totalExercises}</p>
            <p className="text-[10px] text-muted-foreground">exercises</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center min-w-0">
            <p className="text-sm font-bold truncate">{data.stats.topMuscle}</p>
            <p className="text-[10px] text-muted-foreground">top focus</p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={`no-default-hover-elevate no-default-active-elevate text-[10px] border ${consistencyColor}`}
          data-testid="badge-consistency"
        >
          {data.stats.consistency}
        </Badge>
      </div>

      {hasCardioData && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-rose-500/5 border border-rose-500/10" data-testid="cardio-stats-row">
          <Heart className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="font-medium">{data.stats.cardioMinutes} min cardio</span>
            <span className="text-muted-foreground">{data.stats.cardioSessions} sessions</span>
            {data.stats.favoriteCardio && (
              <span className="text-muted-foreground">Fav: {data.stats.favoriteCardio}</span>
            )}
          </div>
        </div>
      )}

      <div className="relative pl-3 border-l-2 border-violet-500/30">
        <p className="text-sm text-foreground leading-relaxed" data-testid="text-coach-note">{data.coachNote}</p>
        <p className="text-[10px] text-violet-500 dark:text-violet-400 mt-1 font-medium">Coach's Note</p>
      </div>
    </div>
  );
}

function SuggestionsContent({ data }: {
  data: { suggestions: { title: string; reason: string; priority: "high" | "medium" | "low" }[] };
}) {
  const priorityConfig: Record<string, { color: string; label: string }> = {
    high: { color: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/15", label: "Start now" },
    medium: { color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/15", label: "Consider" },
    low: { color: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/15", label: "Nice to do" },
  };

  return (
    <div className="space-y-2" data-testid="content-suggestions">
      {data.suggestions.map((s, i) => {
        const config = priorityConfig[s.priority] || priorityConfig.medium;
        return (
          <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-1.5" data-testid={`suggestion-${i}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${config.color.split(' ')[0]}`} />
                <span className="text-sm font-medium">{s.title}</span>
              </div>
              <Badge
                variant="outline"
                className={`no-default-hover-elevate no-default-active-elevate text-[9px] py-0 px-1.5 border flex-shrink-0 ${config.color}`}
              >
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-5.5">{s.reason}</p>
          </div>
        );
      })}
    </div>
  );
}

export function AiNutritionCoaching() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    advice: string;
    quickTips: string[];
    macroAnalysis: { avgCalories: number; avgProtein: number; daysLogged: number; calorieTarget: number | null; proteinTarget: number | null };
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/nutrition-coaching"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });

  return (
    <Card className="overflow-visible" data-testid="card-ai-nutrition">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-sm shadow-green-500/20">
              <Utensils className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Nutrition Coach</h3>
              <p className="text-[10px] text-muted-foreground">7-day food analysis</p>
            </div>
          </div>
          {data && !isFetching && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-nutrition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <CardContent className="pt-0 space-y-3">
        {!data && !isLoading && !isFetching && (
          <div className="py-4 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Get personalized advice based on your recent meals
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => refetch()}
              data-testid="button-generate-nutrition"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Analyze My Nutrition
            </Button>
          </div>
        )}

        {(isLoading || isFetching) && (
          <div className="flex flex-col items-center justify-center py-6 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-green-500" />
            <span className="text-xs text-muted-foreground">Reviewing your meals...</span>
          </div>
        )}

        {data && !isFetching && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-center flex-1">
                <p className="text-lg font-bold">{data.macroAnalysis.avgCalories}</p>
                <p className="text-[10px] text-muted-foreground">
                  avg cal{data.macroAnalysis.calorieTarget ? ` / ${data.macroAnalysis.calorieTarget}` : ""}
                </p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center flex-1">
                <p className="text-lg font-bold">{data.macroAnalysis.avgProtein}g</p>
                <p className="text-[10px] text-muted-foreground">
                  avg protein{data.macroAnalysis.proteinTarget ? ` / ${data.macroAnalysis.proteinTarget}g` : ""}
                </p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center flex-1">
                <p className="text-lg font-bold">{data.macroAnalysis.daysLogged}<span className="text-xs font-normal text-muted-foreground">/7</span></p>
                <p className="text-[10px] text-muted-foreground">days logged</p>
              </div>
            </div>

            <div className="relative pl-3 border-l-2 border-green-500/30">
              <p className="text-sm text-foreground leading-relaxed" data-testid="text-nutrition-advice">{data.advice}</p>
            </div>

            {data.quickTips.length > 0 && (
              <div className="space-y-1">
                {data.quickTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-muted/20" data-testid={`tip-${i}`}>
                    <Sparkles className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-foreground/80">{tip}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-right">
              Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AiStatsInterpreter() {
  const [isOpen, setIsOpen] = useState(true);
  const [, setLocation] = useLocation();

  const stats = useQuery<{
    interpretation: string;
    keyFindings: { label: string; insight: string; type: "positive" | "warning" | "neutral" }[];
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/stats-interpretation"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });

  const isGenerating = stats.isLoading || stats.isFetching;

  const findingColors = {
    positive: "text-green-500",
    warning: "text-orange-500",
    neutral: "text-blue-500",
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-visible" data-testid="card-stats-interpreter">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-sm shadow-cyan-500/20">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Stats Interpreter</h3>
                <p className="text-[10px] text-muted-foreground">AI reads your numbers</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {stats.data && !isGenerating && (
                <Button variant="ghost" size="icon" onClick={() => stats.refetch()} data-testid="button-refresh-stats">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-toggle-stats">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </div>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {!stats.data && !isGenerating && (
              <div className="py-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted/50">
                  <BarChart3 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-foreground font-medium">What do your stats mean?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">AI interprets your workout, nutrition & health data</p>
                </div>
                <Button variant="default" size="sm" onClick={() => stats.refetch()} data-testid="button-generate-stats">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Interpret My Stats
                </Button>
              </div>
            )}

            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                <span className="text-xs text-muted-foreground">Analyzing your data...</span>
              </div>
            )}

            {stats.data && !isGenerating && (
              <div className="space-y-3">
                <p className="text-sm text-foreground leading-relaxed" data-testid="text-stats-interpretation">{stats.data.interpretation}</p>

                {stats.data.keyFindings.length > 0 && (
                  <div className="space-y-1.5">
                    {stats.data.keyFindings.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/30" data-testid={`finding-${i}`}>
                        <Zap className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${findingColors[f.type]}`} />
                        <div>
                          <span className="text-xs font-semibold">{f.label}</span>
                          <p className="text-xs text-muted-foreground">{f.insight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[10px] text-muted-foreground">
                    Updated {new Date(stats.data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const prompt = encodeURIComponent("Explain my stats in more detail and tell me what to improve");
                      setLocation(`/dika?prompt=${prompt}`);
                    }}
                    data-testid="button-ask-dika-stats"
                  >
                    <MessageCircle className="w-3 h-3 mr-1" /> Ask Dika
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
