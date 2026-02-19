import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, Minus, Dumbbell, Utensils, Target, Droplets, Flame, ArrowRight, Loader2, RefreshCw, Lightbulb, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-orange-500" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function NudgeIcon({ type }: { type: string }) {
  switch (type) {
    case "workout": return <Dumbbell className="w-4 h-4" />;
    case "nutrition": return <Utensils className="w-4 h-4" />;
    case "streak": return <Flame className="w-4 h-4" />;
    case "goal": return <Target className="w-4 h-4" />;
    case "health": return <Droplets className="w-4 h-4" />;
    default: return <Lightbulb className="w-4 h-4" />;
  }
}

function nudgeColor(type: string): string {
  switch (type) {
    case "workout": return "from-blue-500 to-indigo-600";
    case "nutrition": return "from-green-500 to-emerald-600";
    case "streak": return "from-orange-500 to-amber-600";
    case "goal": return "from-purple-500 to-violet-600";
    case "health": return "from-cyan-500 to-teal-600";
    default: return "from-primary to-indigo-600";
  }
}

export function ProactiveNudges() {
  const { data, isLoading } = useQuery<{
    nudges: { id: string; message: string; type: string; action?: string; link?: string }[];
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/nudges"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [dismissed, setDismissed] = useState<string[]>([]);

  if (isLoading) return null;

  const nudges = data?.nudges?.filter(n => !dismissed.includes(n.id)) || [];
  if (nudges.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="section-ai-nudges">
      {nudges.map((nudge) => (
        <Card key={nudge.id} className="bg-card/70 backdrop-blur-sm" data-testid={`nudge-${nudge.id}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${nudgeColor(nudge.type)} flex-shrink-0 mt-0.5`}>
                <NudgeIcon type={nudge.type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{nudge.message}</p>
                {nudge.action && nudge.link && (
                  <Link href={nudge.link}>
                    <Button variant="ghost" size="sm" className="mt-1.5 -ml-2 text-xs text-primary" data-testid={`nudge-action-${nudge.id}`}>
                      {nudge.action} <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 opacity-50"
                onClick={() => setDismissed(prev => [...prev, nudge.id])}
                data-testid={`nudge-dismiss-${nudge.id}`}
              >
                <span className="text-xs">x</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AiProgressPreview() {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<{
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

  return (
    <Card className="bg-card/70 backdrop-blur-sm" data-testid="card-ai-progress">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">AI Coach</CardTitle>
                  <p className="text-[10px] text-muted-foreground">Monthly progress + insights</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {!data && !isLoading && !isFetching && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => refetch()}
                data-testid="button-generate-progress"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Generate My Progress Report
              </Button>
            )}

            {(isLoading || isFetching) && (
              <div className="flex items-center justify-center py-4 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Analyzing your data...</span>
              </div>
            )}

            {data && !isFetching && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {data.highlights.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30" data-testid={`highlight-${h.label.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{h.label}</p>
                        <p className="text-sm font-semibold">{h.value}</p>
                      </div>
                      <TrendIcon trend={h.trend} />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground">Streak: </span>
                    <span className="text-sm font-semibold">{data.streaks.currentStreak} days</span>
                    <span className="text-xs text-muted-foreground ml-2">(best: {data.streaks.longestStreak})</span>
                  </div>
                </div>

                <p className="text-sm text-foreground leading-relaxed" data-testid="text-progress-summary">{data.summary}</p>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    Generated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs" data-testid="button-refresh-progress">
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function AiWorkoutInsights() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    coachNote: string;
    stats: { workoutDays: number; totalExercises: number; topMuscle: string; consistency: string };
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/workout-insights"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });

  return (
    <Card className="bg-card/70 backdrop-blur-sm" data-testid="card-ai-workout-insights">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">AI Workout Insights</CardTitle>
              <p className="text-[10px] text-muted-foreground">30-day analysis</p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {!data && !isLoading && !isFetching && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => refetch()}
            data-testid="button-generate-workout-insights"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Analyze My Workouts
          </Button>
        )}

        {(isLoading || isFetching) && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Analyzing workouts...</span>
          </div>
        )}

        {data && !isFetching && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Days</p>
                <p className="text-sm font-bold">{data.stats.workoutDays}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Exercises</p>
                <p className="text-sm font-bold">{data.stats.totalExercises}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Focus</p>
                <p className="text-sm font-bold truncate">{data.stats.topMuscle}</p>
              </div>
            </div>

            <Badge
              variant={data.stats.consistency === "Excellent" ? "default" : data.stats.consistency === "Good" ? "secondary" : "outline"}
              className="no-default-hover-elevate no-default-active-elevate"
              data-testid="badge-consistency"
            >
              Consistency: {data.stats.consistency}
            </Badge>

            <p className="text-sm text-foreground leading-relaxed" data-testid="text-coach-note">{data.coachNote}</p>

            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">
                Generated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs" data-testid="button-refresh-insights">
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AiWorkoutSuggestions() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    suggestions: { title: string; reason: string; priority: "high" | "medium" | "low" }[];
    generatedAt: string;
  }>({
    queryKey: ["/api/member/ai/workout-suggestions"],
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: false,
  });

  const priorityColors: Record<string, string> = {
    high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    low: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  };

  return (
    <Card className="bg-card/70 backdrop-blur-sm" data-testid="card-ai-suggestions">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 shadow-sm">
            <Lightbulb className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">Smart Suggestions</CardTitle>
            <p className="text-[10px] text-muted-foreground">What to focus on next</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {!data && !isLoading && !isFetching && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => refetch()}
            data-testid="button-generate-suggestions"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Get Suggestions
          </Button>
        )}

        {(isLoading || isFetching) && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Thinking...</span>
          </div>
        )}

        {data && !isFetching && (
          <>
            {data.suggestions.map((s, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 space-y-1" data-testid={`suggestion-${i}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{s.title}</span>
                  <Badge variant="outline" className={`text-[10px] py-0 px-1.5 no-default-hover-elevate no-default-active-elevate border ${priorityColors[s.priority]}`}>
                    {s.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.reason}</p>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-muted-foreground">
                Generated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs" data-testid="button-refresh-suggestions">
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
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
    <Card className="bg-card/70 backdrop-blur-sm" data-testid="card-ai-nutrition">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-sm">
            <Utensils className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">AI Nutrition Coach</CardTitle>
            <p className="text-[10px] text-muted-foreground">7-day food analysis</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {!data && !isLoading && !isFetching && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => refetch()}
            data-testid="button-generate-nutrition"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Analyze My Nutrition
          </Button>
        )}

        {(isLoading || isFetching) && (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Reviewing meals...</span>
          </div>
        )}

        {data && !isFetching && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Avg Cal</p>
                <p className="text-sm font-bold">{data.macroAnalysis.avgCalories}</p>
                {data.macroAnalysis.calorieTarget && (
                  <p className="text-[9px] text-muted-foreground">/ {data.macroAnalysis.calorieTarget}</p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Avg Protein</p>
                <p className="text-sm font-bold">{data.macroAnalysis.avgProtein}g</p>
                {data.macroAnalysis.proteinTarget && (
                  <p className="text-[9px] text-muted-foreground">/ {data.macroAnalysis.proteinTarget}g</p>
                )}
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Days Logged</p>
                <p className="text-sm font-bold">{data.macroAnalysis.daysLogged}/7</p>
              </div>
            </div>

            <p className="text-sm text-foreground leading-relaxed" data-testid="text-nutrition-advice">{data.advice}</p>

            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Quick Tips</p>
              {data.quickTips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 pl-1" data-testid={`tip-${i}`}>
                  <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-foreground">{tip}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-muted-foreground">
                Generated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="text-xs" data-testid="button-refresh-nutrition">
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
