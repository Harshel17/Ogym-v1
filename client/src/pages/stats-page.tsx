import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GuidedEmptyState } from "@/components/guided-empty-state";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Shield, Flame, Target, Calendar, Dumbbell, TrendingUp, BarChart3, Loader2, ChevronDown, ChevronUp, CalendarDays, Moon, Search, X, AlertCircle, CheckCircle2, XCircle, Trophy, Weight, Activity, Zap, Info, BookOpen, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useBackNavigation } from "@/hooks/use-back-navigation";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { format, parseISO } from "date-fns";
import { PerformanceIntelligenceCard } from "@/components/performance-intelligence-card";

type MemberStats = {
  streak: number;
  totalWorkouts: number;
  last7Days: number;
  thisMonth: number;
  muscleGroupBreakdown: { name: string; count: number; percentage: number }[];
  volumeStats: {
    totalSets: number;
    totalReps: number;
    totalVolume: number;
  };
  weeklyTrend: { week: string; count: number }[];
  restRecoveryStats?: {
    workoutDays: number;
    restDays: number;
    last30Days: { workoutDays: number; restDays: number };
    breakdown: { name: string; value: number; percentage: number }[];
    trackingWindowDays: number;
  };
};

type DailyWorkout = {
  date: string;
  muscleGroups: string[];
  exerciseCount: number;
  exercises: { name: string; muscleType: string; sets: number | null; reps: number | null; weight: string | null }[];
};

type ConsistencyStats = {
  scheduledDays: number;
  completedDays: number;
  missedDays: number;
  partialDays: number;
  restDays: number;
  completionRate: number;
  totalExercisesScheduled: number;
  totalExercisesCompleted: number;
  exerciseCompletionRate: number;
  recentPartialDays: { date: string; completed: number; missed: number }[];
};

type PerSetProgressSummary = {
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  sessionsCount: number;
  streak: number;
  topExercises: { name: string; volume: number; sessions: number }[];
  weeklyVolume: { week: string; volume: number; sessions: number }[];
};

type PersonalRecord = {
  exerciseName: string;
  maxWeight: number | null;
  maxReps: number | null;
  bestEst1rm: number | null;
  bestVolumeDate: string | null;
  bestVolume: number;
};

type ExerciseAnalytics = {
  dates: { date: string; volume: number; maxWeight: number | null; maxReps: number | null; est1rm: number | null }[];
  recentSets: { date: string; setNumber: number; reps: number | null; weight: string | null }[];
  pr: { maxWeight: number | null; maxReps: number | null; bestEst1rm: number | null; bestVolumeDate: string | null };
};

type AnalyticsExplanation = {
  explanations: {
    metric: string;
    definition: string;
    formula: string;
    tablesUsed: string;
  }[];
  exampleCalculation: {
    workoutDate: string;
    exercises: {
      name: string;
      sets: { setNumber: number; reps: number | null; weight: number | null; setVolume: number }[];
      exerciseVolume: number;
    }[];
    dayVolume: number;
    totalSets: number;
    totalReps: number;
  } | null;
  streakExplanation: {
    currentStreak: number;
    lastCompletedDate: string | null;
    explanation: string;
  };
};

const MUSCLE_COLORS: Record<string, { primary: string; light: string }> = {
  'Chest': { primary: '#6366f1', light: '#818cf8' },
  'Back': { primary: '#22c55e', light: '#4ade80' },
  'Legs': { primary: '#f59e0b', light: '#fbbf24' },
  'Shoulders': { primary: '#ec4899', light: '#f472b6' },
  'Arms': { primary: '#14b8a6', light: '#2dd4bf' },
  'Core': { primary: '#8b5cf6', light: '#a78bfa' },
  'Glutes': { primary: '#f97316', light: '#fb923c' },
  'Full Body': { primary: '#0ea5e9', light: '#38bdf8' },
  'Cardio': { primary: '#ef4444', light: '#f87171' },
  'Rest': { primary: '#64748b', light: '#94a3b8' },
};
const DEFAULT_MUSCLE_COLORS = [
  { primary: '#6366f1', light: '#818cf8' },
  { primary: '#22c55e', light: '#4ade80' },
  { primary: '#f59e0b', light: '#fbbf24' },
  { primary: '#ec4899', light: '#f472b6' },
  { primary: '#14b8a6', light: '#2dd4bf' },
  { primary: '#8b5cf6', light: '#a78bfa' },
  { primary: '#f97316', light: '#fb923c' },
];
const getMuscleColor = (name: string, index: number) => 
  MUSCLE_COLORS[name] || DEFAULT_MUSCLE_COLORS[index % DEFAULT_MUSCLE_COLORS.length];
const getColor = (name: string, index: number) => getMuscleColor(name, index).primary;

export default function StatsPage() {
  const { user } = useAuth();
  const { goBack } = useBackNavigation();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [progressRange, setProgressRange] = useState<'week' | 'month' | 'year' | 'all'>('month');
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [exerciseRange, setExerciseRange] = useState<'90d' | 'year' | 'all'>('90d');
  const WORKOUT_LIMIT = 7;

  const { data: stats, isLoading } = useQuery<MemberStats>({
    queryKey: ["/api/me/stats"],
  });

  const { data: dailyWorkouts = [] } = useQuery<DailyWorkout[]>({
    queryKey: ["/api/me/workouts/daily"],
  });

  const { data: consistencyStats } = useQuery<ConsistencyStats>({
    queryKey: ["/api/me/stats/consistency"],
  });

  const { data: progressSummary } = useQuery<PerSetProgressSummary>({
    queryKey: ["/api/progress/summary", progressRange],
    queryFn: async () => {
      const res = await fetch(`/api/progress/summary?range=${progressRange}`);
      if (!res.ok) throw new Error('Failed to fetch progress summary');
      return res.json();
    },
  });

  const { data: personalRecords = [] } = useQuery<PersonalRecord[]>({
    queryKey: ["/api/progress/prs"],
  });

  const { data: exerciseList = [] } = useQuery<string[]>({
    queryKey: ["/api/progress/exercises"],
  });

  const { data: exerciseAnalytics } = useQuery<ExerciseAnalytics>({
    queryKey: ["/api/progress/exercise", selectedExercise, exerciseRange],
    queryFn: async () => {
      const res = await fetch(`/api/progress/exercise/${encodeURIComponent(selectedExercise)}?range=${exerciseRange}`);
      if (!res.ok) throw new Error('Failed to fetch exercise analytics');
      return res.json();
    },
    enabled: !!selectedExercise,
  });

  const { data: analyticsExplanations } = useQuery<AnalyticsExplanation>({
    queryKey: ["/api/progress/explanations"],
  });

  const [showExplanationsModal, setShowExplanationsModal] = useState(false);
  const [showExampleModal, setShowExampleModal] = useState(false);

  // Helper to get explanation for a specific metric
  const getExplanation = (metricName: string) => {
    return analyticsExplanations?.explanations.find(e => e.metric === metricName);
  };

  // Info button component for metrics using Popover
  const MetricInfo = ({ metric }: { metric: string }) => {
    const explanation = getExplanation(metric);
    if (!explanation) return null;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" data-testid={`info-${metric.toLowerCase().replace(/\s+/g, '-')}`}>
            <Info className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" side="top">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">{explanation.metric}</h4>
            <p className="text-xs text-muted-foreground">{explanation.definition}</p>
            <div className="bg-muted p-2 rounded font-mono text-xs">
              {explanation.formula}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Data source:</span> {explanation.tablesUsed}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  if (user?.role !== "member") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Members Only</h2>
        <p className="text-muted-foreground">This page is only for gym members.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground mt-2">Loading your stats...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" data-testid="button-back" onClick={goBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground">My Stats</h2>
            <p className="text-muted-foreground text-sm">Your workout analytics and progress</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showExplanationsModal} onOpenChange={setShowExplanationsModal}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-how-analytics-works">
                <BookOpen className="w-4 h-4 mr-2" />
                How Analytics Works
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  How Analytics Works
                </DialogTitle>
                <DialogDescription>
                  Detailed explanations of every metric and how they are calculated
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4">
                  {analyticsExplanations?.explanations.map((exp) => (
                    <div key={exp.metric} className="p-4 border rounded-lg">
                      <h4 className="font-semibold text-primary mb-2">{exp.metric}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{exp.definition}</p>
                      <div className="bg-muted p-2 rounded font-mono text-sm mb-2">
                        {exp.formula}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Data source:</span> {exp.tablesUsed}
                      </p>
                    </div>
                  ))}
                  {analyticsExplanations?.streakExplanation && (
                    <div className="p-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                      <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-2">
                        <Flame className="w-4 h-4" />
                        Your Current Streak
                      </h4>
                      <p className="text-sm">{analyticsExplanations.streakExplanation.explanation}</p>
                      {analyticsExplanations.streakExplanation.lastCompletedDate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last completed: {format(parseISO(analyticsExplanations.streakExplanation.lastCompletedDate), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog open={showExampleModal} onOpenChange={setShowExampleModal}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-example-calculation">
                <Calculator className="w-4 h-4 mr-2" />
                Example Calculation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Example Calculation
                </DialogTitle>
                <DialogDescription>
                  Real calculation breakdown from your most recent completed workout
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[65vh] pr-4">
                {analyticsExplanations?.exampleCalculation ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        Workout Date: {format(parseISO(analyticsExplanations.exampleCalculation.workoutDate), 'EEEE, MMMM d, yyyy')}
                      </p>
                    </div>

                    {analyticsExplanations.exampleCalculation.exercises.map((exercise) => (
                      <div key={exercise.name} className="border rounded-lg overflow-hidden">
                        <div className="p-3 bg-primary/10 font-medium flex items-center justify-between gap-2">
                          <span>{exercise.name}</span>
                          <Badge variant="secondary">
                            Exercise Volume: {exercise.exerciseVolume.toLocaleString()} kg
                          </Badge>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-20">Set</TableHead>
                              <TableHead>Reps</TableHead>
                              <TableHead>Weight (kg)</TableHead>
                              <TableHead className="text-right">Set Volume</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {exercise.sets.map((set) => (
                              <TableRow key={set.setNumber}>
                                <TableCell className="font-medium">Set {set.setNumber}</TableCell>
                                <TableCell>{set.reps ?? '-'}</TableCell>
                                <TableCell>{set.weight ?? '-'}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {set.reps && set.weight ? (
                                    <span>
                                      {set.reps} x {set.weight} = <span className="font-bold">{set.setVolume}</span>
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">{set.setVolume}</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ))}

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Day Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-primary/10 rounded-lg">
                            <p className="text-2xl font-bold">{analyticsExplanations.exampleCalculation.dayVolume.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Total Day Volume (kg)</p>
                          </div>
                          <div className="p-3 bg-green-500/10 rounded-lg">
                            <p className="text-2xl font-bold">{analyticsExplanations.exampleCalculation.totalSets}</p>
                            <p className="text-xs text-muted-foreground">Total Sets</p>
                          </div>
                          <div className="p-3 bg-blue-500/10 rounded-lg">
                            <p className="text-2xl font-bold">{analyticsExplanations.exampleCalculation.totalReps}</p>
                            <p className="text-xs text-muted-foreground">Total Reps</p>
                          </div>
                        </div>
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium mb-1">Formula Applied:</p>
                          <p className="text-xs font-mono">
                            Day Volume = Sum of all (reps x weight) = {analyticsExplanations.exampleCalculation.dayVolume.toLocaleString()} kg
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calculator className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No completed workouts with per-set data found</p>
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <PerformanceIntelligenceCard />

      {!stats || stats.totalWorkouts === 0 ? (
        <GuidedEmptyState
          icon={BarChart3}
          title="No Progress Data Yet"
          description="Complete your first workout to start seeing your stats, streaks, and progress charts here."
          features={[
            "Track your workout streak day by day",
            "See weekly and monthly completion rates",
            "View detailed exercise history and personal records",
          ]}
          actionLabel="Go to Workout"
          actionHref="/my-workout"
          iconGradient="from-blue-500 to-indigo-600"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-streak">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Flame className="w-10 h-10 text-orange-500 mb-2" />
                <p className="text-3xl font-bold">{stats.streak}</p>
                <p className="text-xs text-muted-foreground text-center">Day Streak</p>
              </CardContent>
            </Card>
            <Card data-testid="card-total">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Target className="w-10 h-10 text-blue-500 mb-2" />
                <p className="text-3xl font-bold">{stats.totalWorkouts}</p>
                <p className="text-xs text-muted-foreground text-center">Total Workouts</p>
              </CardContent>
            </Card>
            <Card data-testid="card-week">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Calendar className="w-10 h-10 text-green-500 mb-2" />
                <p className="text-3xl font-bold">{stats.last7Days}</p>
                <p className="text-xs text-muted-foreground text-center">Days (Last 7)</p>
              </CardContent>
            </Card>
            <Card data-testid="card-month">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <CalendarDays className="w-10 h-10 text-purple-500 mb-2" />
                <p className="text-3xl font-bold">{stats.thisMonth}</p>
                <p className="text-xs text-muted-foreground text-center">Days (This Month)</p>
              </CardContent>
            </Card>
          </div>

          {stats.volumeStats && stats.volumeStats.totalSets > 0 && (
            <Card data-testid="card-volume">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Volume Metrics
                  <MetricInfo metric="Day/Workout Volume" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{stats.volumeStats.totalSets}</p>
                    <div className="flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Total Sets</p>
                      <MetricInfo metric="Total Sets" />
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{stats.volumeStats.totalReps}</p>
                    <div className="flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Total Reps</p>
                      <MetricInfo metric="Total Reps" />
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{stats.volumeStats.totalVolume.toLocaleString()}</p>
                    <div className="flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Total Volume</p>
                      <MetricInfo metric="Set Volume" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {progressSummary && (
            <Card data-testid="card-per-set-progress">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Per-Set Progress
                </CardTitle>
                <Select value={progressRange} onValueChange={(v) => setProgressRange(v as any)}>
                  <SelectTrigger className="w-32" data-testid="select-progress-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-primary/10 rounded-lg text-center">
                    <Weight className="w-6 h-6 mx-auto mb-2 text-primary" />
                    <p className="text-xl font-bold">{progressSummary.totalVolume.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Volume (kg)</p>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-lg text-center">
                    <Activity className="w-6 h-6 mx-auto mb-2 text-green-500" />
                    <p className="text-xl font-bold">{progressSummary.totalSets}</p>
                    <p className="text-xs text-muted-foreground">Total Sets</p>
                  </div>
                  <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                    <Zap className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                    <p className="text-xl font-bold">{progressSummary.totalReps}</p>
                    <p className="text-xs text-muted-foreground">Total Reps</p>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-lg text-center">
                    <Dumbbell className="w-6 h-6 mx-auto mb-2 text-purple-500" />
                    <p className="text-xl font-bold">{progressSummary.sessionsCount}</p>
                    <p className="text-xs text-muted-foreground">Sessions</p>
                  </div>
                </div>

                {progressSummary.weeklyVolume.length > 1 && (
                  <div>
                    <p className="text-sm font-medium mb-3">Weekly Volume Trend</p>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={progressSummary.weeklyVolume}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis 
                            dataKey="week" 
                            tickFormatter={(v) => format(parseISO(v), 'MMM d')}
                            fontSize={11}
                          />
                          <YAxis fontSize={11} />
                          <Tooltip 
                            labelFormatter={(v) => `Week of ${format(parseISO(v as string), 'MMM d')}`}
                            formatter={(value: number) => [value.toLocaleString() + ' kg', 'Volume']}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {progressSummary.topExercises.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3">Top Exercises by Volume</p>
                    <div className="space-y-2">
                      {progressSummary.topExercises.slice(0, 5).map((ex, idx) => (
                        <div key={ex.name} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                              {idx + 1}
                            </Badge>
                            <span className="text-sm font-medium">{ex.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{ex.sessions} sessions</span>
                            <Badge variant="secondary">{ex.volume.toLocaleString()} kg</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {personalRecords.length > 0 && (
            <Card data-testid="card-personal-records">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Personal Records
                </CardTitle>
                <CardDescription>Your best performances across all exercises</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {personalRecords.slice(0, 10).map((pr) => (
                    <div key={pr.exerciseName} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{pr.exerciseName}</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedExercise(pr.exerciseName)}
                          data-testid={`button-view-exercise-${pr.exerciseName}`}
                        >
                          View Details
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {pr.maxWeight && (
                          <div className="p-2 bg-muted/50 rounded text-center">
                            <p className="font-bold text-primary">{pr.maxWeight} kg</p>
                            <p className="text-xs text-muted-foreground">Max Weight</p>
                          </div>
                        )}
                        {pr.maxReps && (
                          <div className="p-2 bg-muted/50 rounded text-center">
                            <p className="font-bold text-green-600">{pr.maxReps}</p>
                            <p className="text-xs text-muted-foreground">Max Reps</p>
                          </div>
                        )}
                        {pr.bestEst1rm && (
                          <div className="p-2 bg-muted/50 rounded text-center">
                            <p className="font-bold text-blue-600">{pr.bestEst1rm} kg</p>
                            <p className="text-xs text-muted-foreground">Est. 1RM</p>
                          </div>
                        )}
                        {pr.bestVolume > 0 && (
                          <div className="p-2 bg-muted/50 rounded text-center">
                            <p className="font-bold text-purple-600">{pr.bestVolume.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Best Volume</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {exerciseList.length > 0 && (
            <Card data-testid="card-exercise-analytics">
              <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Exercise Analytics
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                    <SelectTrigger className="w-48" data-testid="select-exercise">
                      <SelectValue placeholder="Select exercise" />
                    </SelectTrigger>
                    <SelectContent>
                      {exerciseList.map((ex) => (
                        <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={exerciseRange} onValueChange={(v) => setExerciseRange(v as any)}>
                    <SelectTrigger className="w-28" data-testid="select-exercise-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90d">Last 90 Days</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedExercise ? (
                  <div className="text-center py-8">
                    <Dumbbell className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">Select an exercise to view detailed analytics</p>
                  </div>
                ) : exerciseAnalytics ? (
                  <Tabs defaultValue="trend" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="trend">Trend</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                      <TabsTrigger value="pr">PRs</TabsTrigger>
                    </TabsList>
                    <TabsContent value="trend" className="mt-4">
                      {exerciseAnalytics.dates.length > 0 ? (
                        <div className="h-[250px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={exerciseAnalytics.dates}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tickFormatter={(v) => format(parseISO(v), 'MMM d')}
                                fontSize={11}
                              />
                              <YAxis fontSize={11} />
                              <Tooltip 
                                labelFormatter={(v) => format(parseISO(v as string), 'MMM d, yyyy')}
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                              <Legend />
                              <Line type="monotone" dataKey="maxWeight" name="Max Weight (kg)" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                              <Line type="monotone" dataKey="volume" name="Volume (kg)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No data for this exercise</p>
                      )}
                    </TabsContent>
                    <TabsContent value="history" className="mt-4">
                      {exerciseAnalytics.recentSets.length > 0 ? (
                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2 py-1 sticky top-0 bg-background">
                            <span>Date</span>
                            <span>Set</span>
                            <span>Reps</span>
                            <span>Weight</span>
                          </div>
                          {exerciseAnalytics.recentSets.map((set, idx) => (
                            <div key={idx} className="grid grid-cols-4 gap-2 text-sm p-2 bg-muted/50 rounded">
                              <span>{format(parseISO(set.date), 'MMM d')}</span>
                              <span>Set {set.setNumber}</span>
                              <span className="font-medium">{set.reps ?? '-'}</span>
                              <span className="font-medium">{set.weight ? `${set.weight} kg` : '-'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No set history found</p>
                      )}
                    </TabsContent>
                    <TabsContent value="pr" className="mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        {exerciseAnalytics.pr.maxWeight && (
                          <div className="p-4 bg-primary/10 rounded-lg text-center">
                            <Weight className="w-8 h-8 mx-auto mb-2 text-primary" />
                            <p className="text-2xl font-bold">{exerciseAnalytics.pr.maxWeight} kg</p>
                            <p className="text-sm text-muted-foreground">Max Weight</p>
                          </div>
                        )}
                        {exerciseAnalytics.pr.maxReps && (
                          <div className="p-4 bg-green-500/10 rounded-lg text-center">
                            <Zap className="w-8 h-8 mx-auto mb-2 text-green-500" />
                            <p className="text-2xl font-bold">{exerciseAnalytics.pr.maxReps}</p>
                            <p className="text-sm text-muted-foreground">Max Reps</p>
                          </div>
                        )}
                        {exerciseAnalytics.pr.bestEst1rm && (
                          <div className="p-4 bg-blue-500/10 rounded-lg text-center">
                            <Trophy className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                            <p className="text-2xl font-bold">{exerciseAnalytics.pr.bestEst1rm} kg</p>
                            <p className="text-sm text-muted-foreground">Est. 1RM (Epley)</p>
                          </div>
                        )}
                        {exerciseAnalytics.pr.bestVolumeDate && (
                          <div className="p-4 bg-purple-500/10 rounded-lg text-center">
                            <CalendarDays className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                            <p className="text-lg font-bold">{format(parseISO(exerciseAnalytics.pr.bestVolumeDate), 'MMM d, yyyy')}</p>
                            <p className="text-sm text-muted-foreground">Best Volume Day</p>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {stats.restRecoveryStats && (
            <Card data-testid="card-rest-recovery">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Moon className="w-5 h-5" />
                  Rest & Recovery {stats.restRecoveryStats.trackingWindowDays < 30 
                    ? `(Last ${stats.restRecoveryStats.trackingWindowDays} Days)` 
                    : "(Last 30 Days)"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.restRecoveryStats.breakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          label={({ name, percentage }) => `${percentage}%`}
                        >
                          <Cell fill="#22c55e" />
                          <Cell fill="#64748b" />
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number, name: string) => [`${value} days`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col justify-center space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="w-5 h-5 text-green-500" />
                        <span className="font-medium">Workout Days</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">{stats.restRecoveryStats.last30Days.workoutDays}</p>
                        <p className="text-xs text-muted-foreground">{stats.restRecoveryStats.breakdown[0]?.percentage || 0}%</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-500/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Moon className="w-5 h-5 text-slate-500" />
                        <span className="font-medium">Rest Days</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-600">{stats.restRecoveryStats.last30Days.restDays}</p>
                        <p className="text-xs text-muted-foreground">{stats.restRecoveryStats.breakdown[1]?.percentage || 0}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {consistencyStats && consistencyStats.scheduledDays > 0 && (
            <Card data-testid="card-consistency">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Workout Consistency (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-green-500/10 rounded-lg text-center">
                      <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-green-600">{consistencyStats.completedDays}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-lg text-center">
                      <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-amber-600">{consistencyStats.partialDays}</p>
                      <p className="text-xs text-muted-foreground">Partial</p>
                    </div>
                    <div className="p-3 bg-red-500/10 rounded-lg text-center">
                      <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-red-600">{consistencyStats.missedDays}</p>
                      <p className="text-xs text-muted-foreground">Missed</p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                      <Moon className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                      <p className="text-2xl font-bold text-blue-600">{consistencyStats.restDays}</p>
                      <p className="text-xs text-muted-foreground">Rest Days</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Day Completion Rate</span>
                        <span className="text-sm font-bold">{consistencyStats.completionRate}%</span>
                      </div>
                      <Progress value={consistencyStats.completionRate} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {consistencyStats.completedDays} of {consistencyStats.scheduledDays} scheduled days fully completed
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Exercise Completion Rate</span>
                        <span className="text-sm font-bold">{consistencyStats.exerciseCompletionRate}%</span>
                      </div>
                      <Progress value={consistencyStats.exerciseCompletionRate} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {consistencyStats.totalExercisesCompleted} of {consistencyStats.totalExercisesScheduled} exercises completed
                      </p>
                    </div>
                  </div>

                  {consistencyStats.recentPartialDays.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-2">Recent Partial Days</p>
                      <div className="space-y-2">
                        {consistencyStats.recentPartialDays.map((day) => (
                          <div key={day.date} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <span className="text-sm">{format(parseISO(day.date), "MMM d, yyyy")}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                                {day.completed} done
                              </Badge>
                              <Badge variant="secondary" className="bg-red-500/20 text-red-700">
                                {day.missed} missed
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {stats.muscleGroupBreakdown && stats.muscleGroupBreakdown.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card data-testid="card-muscle-chart" className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Muscle Group Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <defs>
                          {stats.muscleGroupBreakdown.map((entry, index) => {
                            const colors = getMuscleColor(entry.name, index);
                            return (
                              <linearGradient key={`gradient-${index}`} id={`muscleGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor={colors.light} />
                                <stop offset="100%" stopColor={colors.primary} />
                              </linearGradient>
                            );
                          })}
                        </defs>
                        <Pie
                          data={stats.muscleGroupBreakdown}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={3}
                          cornerRadius={4}
                          label={({ cx, cy, midAngle, outerRadius, name, percentage }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius + 20;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text
                                x={x}
                                y={y}
                                fill="hsl(var(--foreground))"
                                textAnchor={x > cx ? 'start' : 'end'}
                                dominantBaseline="central"
                                fontSize={10}
                                fontWeight={500}
                              >
                                {`${name} ${percentage}%`}
                              </text>
                            );
                          }}
                          labelLine={{ 
                            stroke: 'hsl(var(--muted-foreground))',
                            strokeWidth: 1,
                            strokeDasharray: '2 2'
                          }}
                        >
                          {stats.muscleGroupBreakdown.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={`url(#muscleGradient-${index})`}
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                          formatter={(value: number, name: string) => [`${value} sessions`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {stats.muscleGroupBreakdown.reduce((sum, g) => sum + g.count, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-muscle-list">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Sessions by Muscle Group</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {stats.muscleGroupBreakdown.map((group, index) => {
                    const colors = getMuscleColor(group.name, index);
                    return (
                      <div 
                        key={group.name} 
                        className="group relative p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-default"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <div 
                              className="w-3.5 h-3.5 rounded-full shadow-sm transition-transform group-hover:scale-110" 
                              style={{ 
                                backgroundColor: colors.primary,
                                boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${colors.light}40`
                              }}
                            />
                            <span className="text-sm font-medium">{group.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-sm font-semibold px-2 py-0.5 rounded-full"
                              style={{ 
                                backgroundColor: `${colors.primary}20`,
                                color: colors.primary
                              }}
                            >
                              {group.count}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium w-10 text-right">
                              {group.percentage}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ 
                              width: `${group.percentage}%`,
                              background: `linear-gradient(90deg, ${colors.light}, ${colors.primary})`
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}

          {stats.weeklyTrend && stats.weeklyTrend.length > 0 && (
            <Card data-testid="card-weekly-trend">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Weekly Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="week" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {dailyWorkouts.length > 0 && (() => {
            const filteredWorkouts = searchQuery 
              ? dailyWorkouts.filter(day => {
                  const searchLower = searchQuery.toLowerCase();
                  const dateFormatted = format(parseISO(day.date), "EEEE, MMM d, yyyy").toLowerCase();
                  const muscles = day.muscleGroups.join(" ").toLowerCase();
                  return dateFormatted.includes(searchLower) || 
                         muscles.includes(searchLower) ||
                         day.date.includes(searchQuery);
                })
              : dailyWorkouts;
            
            const displayedWorkouts = searchQuery 
              ? filteredWorkouts 
              : (showAllWorkouts ? filteredWorkouts : filteredWorkouts.slice(0, WORKOUT_LIMIT));
            
            return (
            <Card data-testid="card-workout-history">
              <CardHeader className="flex flex-col gap-3">
                <div className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" />
                    Workout History
                  </CardTitle>
                  <Badge variant="secondary">{filteredWorkouts.length} days</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by date or muscle group..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-9"
                    data-testid="input-search-workouts"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setSearchQuery("")}
                      data-testid="button-clear-search"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {displayedWorkouts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No workouts found for "{searchQuery}"</p>
                ) : displayedWorkouts.map((day) => {
                  const isExpanded = expandedDate === day.date;
                  return (
                    <Collapsible
                      key={day.date}
                      open={isExpanded}
                      onOpenChange={() => setExpandedDate(isExpanded ? null : day.date)}
                    >
                      <CollapsibleTrigger asChild>
                        <div
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover-elevate"
                          data-testid={`workout-day-${day.date}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <CalendarDays className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {day.muscleGroups.join(" + ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{day.exerciseCount} exercises</Badge>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-4 space-y-2 border-l-2 border-muted pl-4">
                          {day.exercises.map((exercise, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded bg-background"
                              data-testid={`exercise-${day.date}-${idx}`}
                            >
                              <div>
                                <p className="font-medium text-sm">{exercise.name}</p>
                                <p className="text-xs text-muted-foreground">{exercise.muscleType}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {exercise.sets || "-"}x{exercise.reps || "-"}
                                </p>
                                {exercise.weight && (
                                  <p className="text-xs text-muted-foreground">@ {exercise.weight}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
                
                {!searchQuery && filteredWorkouts.length > WORKOUT_LIMIT && (
                  <Button
                    variant="ghost"
                    className="w-full mt-2"
                    onClick={() => setShowAllWorkouts(!showAllWorkouts)}
                    data-testid="button-toggle-workouts"
                  >
                    {showAllWorkouts 
                      ? `Show Less` 
                      : `Show ${filteredWorkouts.length - WORKOUT_LIMIT} More`}
                    {showAllWorkouts ? (
                      <ChevronUp className="w-4 h-4 ml-2" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-2" />
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
          })()}
        </>
      )}
    </div>
  );
}
