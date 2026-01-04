import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, Target, Calendar, Dumbbell, 
  Loader2, Shield, TrendingUp, CheckCircle2, Flame, Activity, Scale, ChevronRight
} from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval, isPast, isFuture } from "date-fns";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";
import { useState } from "react";

type TrainingPhase = {
  id: number;
  name: string;
  goalType: string;
  startDate: string;
  endDate: string;
  cycleId: number;
  cycleName: string | null;
  notes: string | null;
  memberId: number;
  gymId: number;
};

type PhaseAnalytics = {
  attendanceDays: number;
  totalDays: number;
  totalPoints: number;
  avgPointsPerDay: number;
  totalWorkouts: number;
  startWeight: number | null;
  endWeight: number | null;
  weightChange: number | null;
  pointsTrend: { date: string; points: number }[];
  weightTrend: { date: string; weight: number }[];
};

type WorkoutCycle = {
  id: number;
  name: string;
  cycleLength: number;
  dayLabels: string[];
  restDays: number[];
  items: {
    id: number;
    dayIndex: number;
    exerciseName: string;
    sets: number;
    reps: number;
    weight: string;
    muscleType: string;
  }[];
};

const goalTypeLabels: Record<string, string> = {
  cut: "Cut (Fat Loss)",
  bulk: "Bulk (Muscle Gain)",
  strength: "Strength",
  endurance: "Endurance",
  rehab: "Rehabilitation",
  general: "General Fitness"
};

const goalTypeColors: Record<string, string> = {
  cut: "bg-red-500/10 text-red-700 dark:text-red-400",
  bulk: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  strength: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  endurance: "bg-green-500/10 text-green-700 dark:text-green-400",
  rehab: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  general: "bg-gray-500/10 text-gray-700 dark:text-gray-400"
};

function getPhaseStatus(startDate: string, endDate: string): { label: string; color: string } {
  const today = new Date();
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  if (isWithinInterval(today, { start, end })) {
    return { label: "Active", color: "bg-green-500/10 text-green-700 dark:text-green-400" };
  } else if (isPast(end)) {
    return { label: "Completed", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" };
  } else if (isFuture(start)) {
    return { label: "Upcoming", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" };
  }
  return { label: "Unknown", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" };
}

export default function PhaseDetailPage() {
  const { user } = useAuth();
  const { phaseId } = useParams();
  const [workoutDialogOpen, setWorkoutDialogOpen] = useState(false);
  const [durationDialogOpen, setDurationDialogOpen] = useState(false);
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false);

  const { data: phase, isLoading: phaseLoading } = useQuery<TrainingPhase>({
    queryKey: ["/api/training-phases", phaseId],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<PhaseAnalytics>({
    queryKey: ["/api/training-phases", phaseId, "analytics"],
    enabled: !!phase,
  });

  const { data: cycle } = useQuery<WorkoutCycle>({
    queryKey: ["/api/workouts/cycles/my"],
    enabled: !!phase?.cycleId,
  });

  if (user?.role !== "member" && user?.role !== "trainer" && user?.role !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  if (phaseLoading || analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!phase) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Target className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Phase Not Found</h2>
        <p className="text-muted-foreground">This training phase doesn't exist or you don't have access to it.</p>
        <Link href="/progress/phases">
          <Button variant="outline" className="mt-4">Back to Phases</Button>
        </Link>
      </div>
    );
  }

  const status = getPhaseStatus(phase.startDate, phase.endDate);
  const durationDays = differenceInDays(parseISO(phase.endDate), parseISO(phase.startDate)) + 1;
  const daysPassed = Math.min(
    Math.max(0, differenceInDays(new Date(), parseISO(phase.startDate)) + 1),
    durationDays
  );
  const progressPercent = Math.round((daysPassed / durationDays) * 100);

  const backUrl = user?.role === "member" ? "/progress/phases" : `/star-members/${phase.memberId}`;

  const workoutDaysWithPoints = analytics?.pointsTrend?.filter(p => p.points > 0) || [];
  const groupedExercises = cycle?.items?.reduce((acc, item) => {
    if (!acc[item.dayIndex]) acc[item.dayIndex] = [];
    acc[item.dayIndex].push(item);
    return acc;
  }, {} as Record<number, typeof cycle.items>) || {};

  return (
    <div className="space-y-6 p-1">
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold font-display text-foreground truncate">{phase.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge className={goalTypeColors[phase.goalType] || goalTypeColors.general} data-testid="badge-goal-type">
              {goalTypeLabels[phase.goalType] || phase.goalType}
            </Badge>
            <Badge className={status.color} data-testid="badge-status">
              {status.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Dialog open={durationDialogOpen} onOpenChange={setDurationDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover-elevate" data-testid="card-duration">
              <CardContent className="pt-4 pb-3 px-3 sm:pt-6 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg shrink-0">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Duration</p>
                    <p className="text-lg sm:text-xl font-semibold">{durationDays} days</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </div>
                <p className="mt-1.5 text-[10px] sm:text-xs text-muted-foreground truncate">
                  {format(parseISO(phase.startDate), "MMM d")} - {format(parseISO(phase.endDate), "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Workout History
              </DialogTitle>
              <DialogDescription>
                Workouts completed during {phase.name}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              {workoutDaysWithPoints.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No workouts recorded during this phase.</p>
              ) : (
                <div className="space-y-2">
                  {workoutDaysWithPoints.map((day, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Dumbbell className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{format(parseISO(day.date), "EEEE, MMM d")}</p>
                          <p className="text-sm text-muted-foreground">{format(parseISO(day.date), "yyyy")}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        <Flame className="w-3 h-3 mr-1 text-orange-500" />
                        {day.points} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Card data-testid="card-progress">
          <CardContent className="pt-4 pb-3 px-3 sm:pt-6 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-500/10 rounded-lg shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Progress</p>
                <p className="text-lg sm:text-xl font-semibold">{progressPercent}%</p>
              </div>
            </div>
            <div className="mt-2 w-full bg-muted rounded-full h-1.5">
              <div 
                className="bg-green-500 h-1.5 rounded-full transition-all" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground">
              Day {daysPassed} of {durationDays}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-attendance">
          <CardContent className="pt-4 pb-3 px-3 sm:pt-6 sm:px-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-blue-500/10 rounded-lg shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm text-muted-foreground">Attendance</p>
                <p className="text-lg sm:text-xl font-semibold">{analytics?.attendanceDays || 0} days</p>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] sm:text-xs text-muted-foreground">
              {analytics?.totalDays ? Math.round((analytics.attendanceDays / analytics.totalDays) * 100) : 0}% attendance rate
            </p>
          </CardContent>
        </Card>

        <Dialog open={pointsDialogOpen} onOpenChange={setPointsDialogOpen}>
          <DialogTrigger asChild>
            <Card className="cursor-pointer hover-elevate" data-testid="card-points">
              <CardContent className="pt-4 pb-3 px-3 sm:pt-6 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-orange-500/10 rounded-lg shrink-0">
                    <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Points</p>
                    <p className="text-lg sm:text-xl font-semibold">{analytics?.totalPoints || 0}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0" />
                </div>
                <p className="mt-1.5 text-[10px] sm:text-xs text-muted-foreground">
                  Avg {analytics?.avgPointsPerDay?.toFixed(1) || 0} pts/day
                </p>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Daily Points Breakdown
              </DialogTitle>
              <DialogDescription>
                Points earned each day during this phase
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              {workoutDaysWithPoints.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No points recorded during this phase.</p>
              ) : (
                <div className="space-y-4">
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={workoutDaysWithPoints.slice(-14)}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(val) => format(parseISO(val), "d")}
                          className="text-xs"
                        />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                          formatter={(value: number) => [value, "Points"]}
                        />
                        <Bar dataKey="points" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {workoutDaysWithPoints.map((day, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-sm">{format(parseISO(day.date), "EEE, MMM d")}</span>
                        <Badge variant="outline">
                          <Flame className="w-3 h-3 mr-1 text-orange-500" />
                          {day.points} points
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
        {phase.cycleName && (
          <Dialog open={workoutDialogOpen} onOpenChange={setWorkoutDialogOpen}>
            <DialogTrigger asChild>
              <Card className="cursor-pointer hover-elevate" data-testid="card-workout-cycle">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 sm:w-5 sm:h-5" />
                    Linked Workout Cycle
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{phase.cycleName}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {analytics?.totalWorkouts || 0} workout sessions completed during this phase
                  </p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5" />
                  {phase.cycleName}
                </DialogTitle>
                <DialogDescription>
                  Assigned exercises in this workout cycle
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[60vh] pr-4">
                {!cycle?.items || cycle.items.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No exercises found in this cycle.</p>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedExercises).map(([dayIndex, exercises]) => {
                      const dayNum = parseInt(dayIndex);
                      const isRestDay = cycle?.restDays?.includes(dayNum);
                      const dayLabel = cycle?.dayLabels?.[dayNum] || `Day ${dayNum + 1}`;
                      
                      return (
                        <div key={dayIndex} className="border rounded-lg overflow-hidden">
                          <div className="bg-muted/50 px-4 py-2 font-medium flex items-center justify-between">
                            <span>{dayLabel}</span>
                            {isRestDay && <Badge variant="secondary">Rest Day</Badge>}
                          </div>
                          {!isRestDay && (
                            <div className="divide-y">
                              {exercises.map((ex, idx) => (
                                <div key={idx} className="px-4 py-2 flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{ex.exerciseName}</p>
                                    <p className="text-xs text-muted-foreground">{ex.muscleType}</p>
                                  </div>
                                  <div className="text-right text-sm">
                                    <p>{ex.sets} x {ex.reps}</p>
                                    <p className="text-xs text-muted-foreground">{ex.weight}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}

        {(analytics?.startWeight || analytics?.endWeight) && (
          <Card data-testid="card-weight-change">
            <CardHeader className="pb-2">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
                Weight Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                {analytics?.startWeight && (
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Start</p>
                    <p className="text-lg sm:text-xl font-semibold">{analytics.startWeight} kg</p>
                  </div>
                )}
                {analytics?.endWeight && (
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Current</p>
                    <p className="text-lg sm:text-xl font-semibold">{analytics.endWeight} kg</p>
                  </div>
                )}
                {analytics?.weightChange !== null && analytics?.weightChange !== undefined && (
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Change</p>
                    <p className={`text-lg sm:text-xl font-semibold ${analytics.weightChange < 0 ? 'text-green-600 dark:text-green-400' : analytics.weightChange > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {analytics.weightChange > 0 ? '+' : ''}{analytics.weightChange} kg
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {phase.notes && (
        <Card data-testid="card-notes">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg">Trainer Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{phase.notes}</p>
          </CardContent>
        </Card>
      )}

      {analytics?.pointsTrend && analytics.pointsTrend.length > 0 && (
        <Card data-testid="card-points-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
              Points Trend
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Daily workout points earned during this phase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.pointsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), "M/d")}
                    className="text-[10px] sm:text-xs"
                    interval="preserveStartEnd"
                  />
                  <YAxis className="text-[10px] sm:text-xs" width={30} />
                  <Tooltip 
                    labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                    formatter={(value: number) => [value, "Points"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="points" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {analytics?.weightTrend && analytics.weightTrend.length > 1 && (
        <Card data-testid="card-weight-chart">
          <CardHeader className="pb-2">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
              Weight Trend
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Body weight measurements during this phase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 sm:h-64 -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.weightTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), "M/d")}
                    className="text-[10px] sm:text-xs"
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    domain={['dataMin - 2', 'dataMax + 2']}
                    className="text-[10px] sm:text-xs"
                    width={35}
                  />
                  <Tooltip 
                    labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                    formatter={(value: number) => [`${value} kg`, "Weight"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
