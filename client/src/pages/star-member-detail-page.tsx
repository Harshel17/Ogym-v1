import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, Star, Calendar, Dumbbell, TrendingUp, 
  Flame, Activity, Weight, ChevronRight, Loader2, Shield,
  CheckCircle2, XCircle, AlertCircle, Clock
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useState } from "react";

type MemberInfo = {
  id: number;
  username: string;
  publicId: string | null;
  gymName: string | null;
  gymCode: string | null;
};

type WorkoutSession = {
  date: string;
  title: string;
  exercises: {
    completionId: number | null;
    exerciseName: string;
    muscleType: string;
    sets: number;
    reps: number;
    weight: string | null;
    actualSets: number | null;
    actualReps: number | null;
    actualWeight: string | null;
    notes: string | null;
    completed: boolean;
  }[];
};

type MissedWorkout = {
  date: string;
  dayLabel: string;
  completedCount: number;
  totalCount: number;
  status: "missed" | "partial";
  missedExercises: string[];
};

type MemberStats = {
  stats: {
    streak: number;
    totalWorkouts: number;
    last7Days: number;
    thisMonth: number;
    thisWeek: number;
    muscleBreakdown: Record<string, number>;
    totalVolume: number;
    avgSessionDuration: number;
    avgExercisesPerSession: number;
  };
  progress: {
    exerciseName: string;
    muscleType: string;
    history: { date: string; weight: string | null; reps: number | null }[];
    personalRecord: { weight: string | null; reps: number | null; date: string } | null;
  }[];
};

export default function StarMemberDetailPage() {
  const { user } = useAuth();
  const params = useParams<{ memberId: string }>();
  const memberId = parseInt(params.memberId || "0");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: memberInfo, isLoading: memberLoading, error: memberError } = useQuery<MemberInfo>({
    queryKey: ["/api/trainer/star-members", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/star-members/${memberId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch member");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: workouts = [], isLoading: workoutsLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/trainer/star-members", memberId, "workouts"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/star-members/${memberId}/workouts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workouts");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<MemberStats>({
    queryKey: ["/api/trainer/star-members", memberId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/star-members/${memberId}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: missedWorkouts = [], isLoading: missedLoading } = useQuery<MissedWorkout[]>({
    queryKey: ["/api/trainer/star-members", memberId, "missed"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/star-members/${memberId}/missed`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch missed workouts");
      return res.json();
    },
    enabled: !!memberId
  });

  // Fetch individual session details when a session is selected
  const { data: selectedSession, isLoading: sessionLoading } = useQuery<WorkoutSession>({
    queryKey: ["/api/trainer/star-members", memberId, "workouts", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/star-members/${memberId}/workouts/${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
    enabled: !!selectedDate
  });

  if (user?.role !== "trainer") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Trainers Only</h2>
        <p className="text-muted-foreground">This page is only for trainers.</p>
      </div>
    );
  }

  if (memberLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (memberError || !memberInfo) {
    return (
      <div className="space-y-6">
        <Link href="/star-members">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Star Members
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h3 className="font-semibold text-lg">Access Denied</h3>
            <p className="text-muted-foreground mt-2">
              You don't have access to view this member's details.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = statsData?.stats;
  const progress = statsData?.progress || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/star-members">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-lg">
            {memberInfo.username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{memberInfo.username}</h2>
              <Star className="w-5 h-5 text-yellow-500 fill-current" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {memberInfo.publicId && <span>{memberInfo.publicId}</span>}
              {memberInfo.gymName && (
                <>
                  <span>|</span>
                  <span>{memberInfo.gymName} ({memberInfo.gymCode})</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="workouts" className="w-full">
        <TabsList className="w-full justify-start" data-testid="tabs-member-detail">
          <TabsTrigger value="workouts" data-testid="tab-workouts">
            <Dumbbell className="w-4 h-4 mr-2" />
            Workouts
          </TabsTrigger>
          <TabsTrigger value="missed" data-testid="tab-missed">
            <AlertCircle className="w-4 h-4 mr-2" />
            Missed
          </TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">
            <TrendingUp className="w-4 h-4 mr-2" />
            Stats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workouts" className="mt-6">
          {workoutsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : workouts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">No Workout History</h3>
                <p className="text-muted-foreground mt-2">This member hasn't logged any workouts yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {workouts.map((session) => {
                const completedCount = session.exercises.filter(e => e.completed).length;
                const totalCount = session.exercises.length;
                return (
                  <Card 
                    key={session.date} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedDate(session.date)}
                    data-testid={`card-session-${session.date}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{session.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(session.date), "EEEE, MMMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {completedCount}/{totalCount} done
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="missed" className="mt-6">
          {missedLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : missedWorkouts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Dumbbell className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="font-semibold text-lg">No Missed Workouts!</h3>
                <p className="text-muted-foreground mt-2">
                  This member hasn't missed any workout days in their current cycle.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {missedWorkouts.filter(d => d.status === "missed").length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      Fully Missed Days
                      <Badge variant="secondary" className="ml-2">
                        {missedWorkouts.filter(d => d.status === "missed").length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {missedWorkouts.filter(d => d.status === "missed").map((day) => (
                      <div
                        key={day.date}
                        className="flex items-center justify-between p-4 rounded-lg border bg-red-500/5"
                        data-testid={`missed-day-${day.date}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {day.dayLabel} - {day.totalCount} exercises planned
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
                          Missed
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {missedWorkouts.filter(d => d.status === "partial").length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      Partial Completions
                      <Badge variant="secondary" className="ml-2">
                        {missedWorkouts.filter(d => d.status === "partial").length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {missedWorkouts.filter(d => d.status === "partial").map((day) => (
                      <div
                        key={day.date}
                        className="p-4 rounded-lg border bg-yellow-500/5"
                        data-testid={`partial-day-${day.date}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                              <Clock className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {day.dayLabel}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                            {day.completedCount}/{day.totalCount} Done
                          </Badge>
                        </div>
                        {day.missedExercises.length > 0 && (
                          <div className="mt-3 pl-13">
                            <p className="text-xs text-muted-foreground mb-1">Missed exercises:</p>
                            <div className="flex flex-wrap gap-1">
                              {day.missedExercises.map((ex, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {ex}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-6">
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !stats ? (
            <Card>
              <CardContent className="py-12 text-center">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg">No Stats Available</h3>
                <p className="text-muted-foreground mt-2">Stats will appear once workouts are logged.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card data-testid="card-streak">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                    <CardTitle className="text-sm font-medium">Streak</CardTitle>
                    <Flame className="w-4 h-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{stats.streak} days</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-week">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                    <CardTitle className="text-sm font-medium">This Week</CardTitle>
                    <Activity className="w-4 h-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{stats.thisWeek}</p>
                    <p className="text-xs text-muted-foreground">workouts</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-month">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                    <CardTitle className="text-sm font-medium">This Month</CardTitle>
                    <Calendar className="w-4 h-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{stats.thisMonth}</p>
                    <p className="text-xs text-muted-foreground">workouts</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-total">
                  <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                    <CardTitle className="text-sm font-medium">Total</CardTitle>
                    <Dumbbell className="w-4 h-4 text-purple-500" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{stats.totalWorkouts}</p>
                    <p className="text-xs text-muted-foreground">workouts</p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-volume">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Weight className="w-4 h-4" />
                    Volume Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Volume</p>
                      <p className="text-xl font-bold">{stats.totalVolume?.toLocaleString() || 0} kg</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Avg Exercises/Session</p>
                      <p className="text-xl font-bold">{stats.avgExercisesPerSession?.toFixed(1) || 0}</p>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Last 7 Days</p>
                      <p className="text-xl font-bold">{stats.last7Days} workouts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {stats.muscleBreakdown && Object.keys(stats.muscleBreakdown).length > 0 && (
                <Card data-testid="card-muscle-breakdown">
                  <CardHeader>
                    <CardTitle className="text-base">Muscle Group Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.muscleBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .map(([muscle, percentage]) => (
                          <div key={muscle} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{muscle}</span>
                              <span className="font-medium">{percentage}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {progress.length > 0 && (
                <Card data-testid="card-personal-records">
                  <CardHeader>
                    <CardTitle className="text-base">Personal Records</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {progress
                        .filter(p => p.personalRecord)
                        .slice(0, 6)
                        .map((p) => (
                          <div key={p.exerciseName} className="p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium text-sm">{p.exerciseName}</p>
                            <p className="text-xs text-muted-foreground mb-1">{p.muscleType}</p>
                            <p className="text-lg font-bold">
                              {p.personalRecord?.weight || "-"} kg x {p.personalRecord?.reps || "-"}
                            </p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedSession?.title || "Loading..."}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedDate && format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
            </p>
          </DialogHeader>
          {sessionLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4 mt-4">
              {selectedSession?.exercises.map((exercise, idx) => (
                <Card 
                  key={exercise.completionId ?? `skipped-${idx}`} 
                  className={`border ${
                    exercise.completed 
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}
                  data-testid={`exercise-${idx}`}
                >
                  <CardHeader className="py-3 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{exercise.exerciseName}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{exercise.muscleType}</Badge>
                        {exercise.completed ? (
                          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Done
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
                            <XCircle className="w-3 h-3 mr-1" />
                            Skipped
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Prescribed: {exercise.sets}x{exercise.reps} {exercise.weight ? `@ ${exercise.weight}` : ''}
                    </p>
                  </CardHeader>
                  {exercise.completed && (
                    <CardContent className="py-3">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="p-2 bg-muted/50 rounded text-center">
                          <p className="text-muted-foreground text-xs">Sets</p>
                          <p className="font-medium">{exercise.actualSets ?? exercise.sets}</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-center">
                          <p className="text-muted-foreground text-xs">Reps</p>
                          <p className="font-medium">{exercise.actualReps ?? exercise.reps}</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded text-center">
                          <p className="text-muted-foreground text-xs">Weight</p>
                          <p className="font-medium">{exercise.actualWeight || exercise.weight || "-"}</p>
                        </div>
                      </div>
                      {exercise.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          Note: {exercise.notes}
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
