import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Shield, Flame, Target, Calendar, Dumbbell, TrendingUp, BarChart3, Loader2, ChevronDown, ChevronUp, CalendarDays, Moon, Search, X, AlertCircle, CheckCircle2, XCircle, Trophy, Weight, Activity, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { format, parseISO } from "date-fns";

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

const COLORS: Record<string, string> = {
  'Chest': '#6366f1',
  'Back': '#22c55e', 
  'Legs': '#f59e0b',
  'Shoulders': '#ec4899',
  'Arms': '#14b8a6',
  'Core': '#8b5cf6',
  'Glutes': '#f97316',
  'Full Body': '#0ea5e9',
  'Cardio': '#ef4444',
  'Rest': '#64748b',
};
const DEFAULT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316'];
const getColor = (name: string, index: number) => COLORS[name] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

export default function StatsPage() {
  const { user } = useAuth();
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
  });

  const { data: personalRecords = [] } = useQuery<PersonalRecord[]>({
    queryKey: ["/api/progress/prs"],
  });

  const { data: exerciseList = [] } = useQuery<string[]>({
    queryKey: ["/api/progress/exercises"],
  });

  const { data: exerciseAnalytics } = useQuery<ExerciseAnalytics>({
    queryKey: ["/api/progress/exercise", selectedExercise, exerciseRange],
    enabled: !!selectedExercise,
  });

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
      <div className="flex items-center gap-4">
        <Link href="/progress">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">My Stats</h2>
          <p className="text-muted-foreground text-sm">Your workout analytics and progress</p>
        </div>
      </div>

      {!stats || stats.totalWorkouts === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No stats yet</h3>
            <p className="text-muted-foreground mt-2">Complete some workouts to see your statistics!</p>
          </CardContent>
        </Card>
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
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{stats.volumeStats.totalSets}</p>
                    <p className="text-sm text-muted-foreground">Total Sets</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{stats.volumeStats.totalReps}</p>
                    <p className="text-sm text-muted-foreground">Total Reps</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{stats.volumeStats.totalVolume.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Volume</p>
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
              <Card data-testid="card-muscle-chart">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Muscle Group Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.muscleGroupBreakdown}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ cx, cy, midAngle, outerRadius, name, percentage }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius + 25;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text
                                x={x}
                                y={y}
                                fill="hsl(var(--foreground))"
                                textAnchor={x > cx ? 'start' : 'end'}
                                dominantBaseline="central"
                                fontSize={11}
                              >
                                {`${name} ${percentage}%`}
                              </text>
                            );
                          }}
                          labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                        >
                          {stats.muscleGroupBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getColor(entry.name, index)} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-muscle-list">
                <CardHeader>
                  <CardTitle>Sessions by Muscle Group</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats.muscleGroupBreakdown.map((group, index) => (
                    <div key={group.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: getColor(group.name, index) }}
                          />
                          <span className="text-sm font-medium">{group.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{group.count}</Badge>
                          <span className="text-sm text-muted-foreground">{group.percentage}%</span>
                        </div>
                      </div>
                      <Progress value={group.percentage} className="h-2" />
                    </div>
                  ))}
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
