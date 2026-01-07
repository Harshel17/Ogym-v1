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
  CheckCircle2, XCircle, AlertCircle, Clock, StickyNote, Plus, Minus, Trash2, Edit, Moon
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { useBackNavigation } from "@/hooks/use-back-navigation";

type MemberInfo = {
  id: number;
  username: string;
  publicId: string | null;
  gymName: string | null;
  gymCode: string | null;
  currentCycleName: string | null;
  currentCycleLength: number | null;
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

type MemberNote = {
  id: number;
  content: string;
  createdAt: string;
};

export default function StarMemberDetailPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const params = useParams<{ memberId: string }>();
  const memberId = parseInt(params.memberId || "0");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");

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

  const { data: notes = [], isLoading: notesLoading } = useQuery<MemberNote[]>({
    queryKey: ["/api/trainer/members", memberId, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/members/${memberId}/notes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
    enabled: !!memberId
  });

  const addNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/trainer/members/${memberId}/notes`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/members", memberId, "notes"] });
      toast({ title: "Note added" });
      setNewNote("");
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      await apiRequest("DELETE", `/api/trainer/members/${memberId}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/members", memberId, "notes"] });
      toast({ title: "Note deleted" });
    }
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

  const { goBack } = useBackNavigation();

  if (memberError || !memberInfo) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" data-testid="button-back" onClick={goBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
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
        <Button variant="ghost" size="icon" data-testid="button-back" onClick={goBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
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
          <TabsTrigger value="notes" data-testid="tab-notes">
            <StickyNote className="w-4 h-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="phases" data-testid="tab-phases">
            <Calendar className="w-4 h-4 mr-2" />
            Phases
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

        <TabsContent value="notes" className="mt-6">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <Label htmlFor="new-note">Add a Note</Label>
                <Textarea
                  id="new-note"
                  placeholder="Write a private note about this member..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="mt-2"
                  data-testid="input-new-note"
                />
                <Button
                  className="mt-3"
                  onClick={() => {
                    if (newNote.trim()) addNoteMutation.mutate(newNote.trim());
                  }}
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  {addNoteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Note
                </Button>
              </CardContent>
            </Card>

            {notesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : notes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <StickyNote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg">No Notes Yet</h3>
                  <p className="text-muted-foreground mt-2">Add a private note about this member.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <Card key={note.id} data-testid={`note-${note.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-2">
                            {format(parseISO(note.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                          <p className="whitespace-pre-wrap">{note.content}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                          data-testid={`button-delete-note-${note.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="phases" className="mt-6">
          <TrainingPhasesTab 
            memberId={memberId} 
            memberName={memberInfo.username}
            currentCycleName={memberInfo.currentCycleName}
            currentCycleLength={memberInfo.currentCycleLength}
          />
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

type TrainingPhase = {
  id: number;
  name: string;
  goalType: string;
  startDate: string;
  endDate: string;
  cycleId: number | null;
  dietPlanId: number | null;
  autoAssignCycle: boolean | null;
  useCustomExercises: boolean | null;
  cycleLength: number | null;
  dayLabels: string[] | null;
  restDays: number[] | null;
  notes: string | null;
  createdAt: string;
};

type WorkoutCycleOption = {
  id: number;
  name: string;
};

function TrainingPhasesTab({ memberId, memberName, currentCycleName, currentCycleLength }: { 
  memberId: number; 
  memberName: string;
  currentCycleName: string | null;
  currentCycleLength: number | null;
}) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<string>("general");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cycleId, setCycleId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [autoAssignCycle, setAutoAssignCycle] = useState(false);
  const [useCustomExercises, setUseCustomExercises] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [editingPhase, setEditingPhase] = useState<TrainingPhase | null>(null);
  const [exerciseSource, setExerciseSource] = useState<"existing" | "custom">("existing");

  const { data: phases = [], isLoading } = useQuery<TrainingPhase[]>({
    queryKey: ["/api/training-phases/member", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/training-phases/member/${memberId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch phases");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: cycles = [] } = useQuery<WorkoutCycleOption[]>({
    queryKey: ["/api/trainer/cycles/member", memberId],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/members/${memberId}/cycles`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!memberId
  });

  const createPhaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/training-phases", data);
      return res.json();
    },
    onSuccess: async (createdPhase: any) => {
      // If using custom exercises and a template cycle is selected, copy exercises from the cycle
      if (useCustomExercises && cycleId) {
        try {
          await apiRequest("POST", `/api/training-phases/${createdPhase.id}/copy-from-cycle`, { cycleId: parseInt(cycleId) });
          toast({ title: "Phase created with exercises copied from template" });
        } catch (e) {
          toast({ title: "Phase created, but failed to copy exercises" });
        }
      } else {
        toast({ title: "Training phase created" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases/member", memberId] });
      setShowCreateDialog(false);
      // If using custom exercises, open the exercise editor
      if (useCustomExercises) {
        setEditingPhaseId(createdPhase.id);
      }
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Failed to create phase", description: err.message, variant: "destructive" });
    }
  });

  const deletePhaseMutation = useMutation({
    mutationFn: async (phaseId: number) => {
      await apiRequest("DELETE", `/api/training-phases/${phaseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases/member", memberId] });
      toast({ title: "Training phase deleted" });
    }
  });

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ phaseId, data }: { phaseId: number; data: Partial<TrainingPhase> }) => {
      const res = await apiRequest("PATCH", `/api/training-phases/${phaseId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases/member", memberId] });
      toast({ title: "Training phase updated" });
      setEditingPhase(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update phase", description: err.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setName("");
    setGoalType("general");
    setStartDate("");
    setEndDate("");
    setCycleId("");
    setNotes("");
    setAutoAssignCycle(false);
    setUseCustomExercises(false);
    setExerciseSource("existing");
  };

  const handleCreate = () => {
    if (!name || !startDate || !endDate) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    // Cycle is required unless using custom exercises
    if (!useCustomExercises && !cycleId) {
      toast({ title: "Please select a workout cycle or enable custom exercises", variant: "destructive" });
      return;
    }
    createPhaseMutation.mutate({
      memberId,
      name,
      goalType,
      startDate,
      endDate,
      cycleId: cycleId ? parseInt(cycleId) : undefined,
      autoAssignCycle,
      useCustomExercises,
      notes: notes || undefined
    });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with current cycle info */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold">Training Phases</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Track {memberName}'s progress through different training periods with specific goals.
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-phase">
          <Plus className="w-4 h-4 mr-2" />
          Create Phase
        </Button>
      </div>

      {/* Current workout info */}
      <Card className="bg-muted/30">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <Dumbbell className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Current Workout</p>
              {currentCycleName ? (
                <p className="text-sm text-muted-foreground">
                  {currentCycleName}{currentCycleLength ? ` (${currentCycleLength}-day cycle)` : ''}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No cycle assigned</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {phases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No Training Phases Yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              A phase is a time period (like 8 weeks) with a specific goal. You can either use an existing workout cycle or create custom exercises for the phase.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {phases.map((phase) => {
            const start = parseISO(phase.startDate);
            const end = parseISO(phase.endDate);
            const now = new Date();
            const isActive = now >= start && now <= end;
            
            return (
              <Card 
                key={phase.id} 
                data-testid={`phase-${phase.id}`}
                className="cursor-pointer hover-elevate"
                onClick={() => setEditingPhase(phase as any)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{phase.name}</h4>
                        {isActive && (
                          <Badge variant="default" className="text-xs">Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={goalTypeColors[phase.goalType] || goalTypeColors.general}>
                          {goalTypeLabels[phase.goalType] || phase.goalType}
                        </Badge>
                        {phase.useCustomExercises && (
                          <Badge variant="outline" className="text-xs">Custom Exercises</Badge>
                        )}
                        {phase.autoAssignCycle && (
                          <Badge variant="outline" className="text-xs">Auto-assign</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {format(start, "MMM d, yyyy")} - {format(end, "MMM d, yyyy")}
                        </span>
                      </div>
                      {phase.notes && (
                        <p className="text-sm text-muted-foreground mt-2">{phase.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {phase.useCustomExercises && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setEditingPhaseId(phase.id); }}
                          data-testid={`button-edit-exercises-${phase.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); deletePhaseMutation.mutate(phase.id); }}
                        data-testid={`button-delete-phase-${phase.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Training Phase</DialogTitle>
          </DialogHeader>
          
          {/* Info Banner */}
          <div className="bg-muted/50 rounded-md p-3 text-sm">
            <p className="text-muted-foreground">
              A <strong>Training Phase</strong> is a time period (e.g., 8 weeks) focused on a specific goal like fat loss or muscle gain. 
              You can use their current workout or create a custom plan for this phase.
            </p>
          </div>

          <div className="space-y-5 py-2">
            {/* Step 1: Basic Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Step 1: Phase Details</h4>
              
              <div>
                <Label htmlFor="phase-name">Phase Name</Label>
                <input
                  id="phase-name"
                  type="text"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                  placeholder="e.g., 12-Week Lean Bulk"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-phase-name"
                />
              </div>

              <div>
                <Label htmlFor="goal-type">Goal Type</Label>
                <select
                  id="goal-type"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  data-testid="select-goal-type"
                >
                  <option value="general">General Fitness</option>
                  <option value="cut">Cut (Fat Loss)</option>
                  <option value="bulk">Bulk (Muscle Gain)</option>
                  <option value="strength">Strength</option>
                  <option value="endurance">Endurance</option>
                  <option value="rehab">Rehabilitation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <input
                    id="start-date"
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <input
                    id="end-date"
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    data-testid="input-end-date"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Workout Selection */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Step 2: Workout Plan</h4>
              
              <div className="space-y-2">
                <div 
                  className={`p-3 border rounded-md cursor-pointer ${exerciseSource === "existing" ? "border-primary bg-primary/5" : "border-input hover-elevate"}`}
                  onClick={() => { setExerciseSource("existing"); setUseCustomExercises(false); }}
                  data-testid="option-use-existing"
                >
                  <div className="flex items-start gap-3">
                    <input 
                      type="radio" 
                      checked={exerciseSource === "existing"} 
                      onChange={() => {}} 
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-sm">Use existing workout cycle</p>
                      <p className="text-xs text-muted-foreground">
                        Member continues with their current or selected workout. No changes to exercises.
                      </p>
                    </div>
                  </div>
                </div>

                <div 
                  className={`p-3 border rounded-md cursor-pointer ${exerciseSource === "custom" ? "border-primary bg-primary/5" : "border-input hover-elevate"}`}
                  onClick={() => { setExerciseSource("custom"); setUseCustomExercises(true); }}
                  data-testid="option-use-custom"
                >
                  <div className="flex items-start gap-3">
                    <input 
                      type="radio" 
                      checked={exerciseSource === "custom"} 
                      onChange={() => {}} 
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-sm">Create custom workout plan</p>
                      <p className="text-xs text-muted-foreground">
                        Design a new workout specifically for this phase. Can be any number of days.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {exerciseSource === "existing" && (
                <div>
                  <Label htmlFor="cycle">Select Workout Cycle</Label>
                  <select
                    id="cycle"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={cycleId}
                    onChange={(e) => setCycleId(e.target.value)}
                    data-testid="select-cycle"
                  >
                    <option value="">Select a workout cycle</option>
                    {cycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id.toString()}>
                        {cycle.name}
                      </option>
                    ))}
                  </select>
                  {currentCycleName && !cycleId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Currently using: {currentCycleName}
                    </p>
                  )}
                </div>
              )}

              {exerciseSource === "custom" && (
                <div>
                  <Label htmlFor="template-cycle">Start from template (optional)</Label>
                  <select
                    id="template-cycle"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={cycleId}
                    onChange={(e) => setCycleId(e.target.value)}
                    data-testid="select-template-cycle"
                  >
                    <option value="">Start from scratch</option>
                    {cycles.map((cycle) => (
                      <option key={cycle.id} value={cycle.id.toString()}>
                        Copy from: {cycle.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {cycleId ? "Exercises will be copied and you can edit them after creation." : "You'll add exercises after creating the phase."}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-assign">Auto-assign Cycle</Label>
                  <p className="text-xs text-muted-foreground">Automatically switch member's workout when this phase becomes active</p>
                </div>
                <input
                  id="auto-assign"
                  type="checkbox"
                  checked={autoAssignCycle}
                  onChange={(e) => setAutoAssignCycle(e.target.checked)}
                  className="h-4 w-4"
                  data-testid="checkbox-auto-assign"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="phase-notes">Notes (Optional)</Label>
              <Textarea
                id="phase-notes"
                placeholder="Any additional notes about this training phase..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                data-testid="input-phase-notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={createPhaseMutation.isPending}
              data-testid="button-submit-phase"
            >
              {createPhaseMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Create Phase
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified Edit Phase Dialog with Tabs */}
      {(editingPhase || editingPhaseId) && (
        <UnifiedPhaseEditor 
          phase={editingPhase}
          phaseId={editingPhaseId || editingPhase?.id}
          onClose={() => { setEditingPhase(null); setEditingPhaseId(null); }}
          onSave={(data) => {
            if (editingPhase) {
              updatePhaseMutation.mutate({ phaseId: editingPhase.id, data });
            }
          }}
          isPending={updatePhaseMutation.isPending}
        />
      )}
    </div>
  );
}

function UnifiedPhaseEditor({ 
  phase,
  phaseId,
  onClose,
  onSave,
  isPending 
}: { 
  phase: TrainingPhase | null;
  phaseId: number | undefined;
  onClose: () => void;
  onSave: (data: Partial<TrainingPhase>) => void;
  isPending: boolean;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"details" | "exercises">("details");
  
  // Phase details state
  const [name, setName] = useState(phase?.name || "");
  const [goalType, setGoalType] = useState(phase?.goalType || "general");
  const [startDate, setStartDate] = useState(phase?.startDate || "");
  const [endDate, setEndDate] = useState(phase?.endDate || "");
  const [notes, setNotes] = useState(phase?.notes || "");
  
  // Exercise editor state
  const [localDayCount, setLocalDayCount] = useState<number | null>(null);
  const [restDays, setRestDays] = useState<number[]>(phase?.restDays || []);
  const [newExercise, setNewExercise] = useState({
    dayIndex: 0,
    muscleType: "Chest",
    bodyPart: "Upper Body",
    exerciseName: "",
    sets: 3,
    reps: 10,
    weight: ""
  });

  const actualPhaseId = phaseId || phase?.id;

  // Fetch phase data if we only have phaseId
  const { data: fetchedPhase } = useQuery<TrainingPhase>({
    queryKey: ["/api/training-phases", actualPhaseId],
    queryFn: async () => {
      const res = await fetch(`/api/training-phases/${actualPhaseId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch phase");
      return res.json();
    },
    enabled: !!actualPhaseId
  });

  const currentPhase = phase || fetchedPhase;

  // Sync state when phase data loads
  useEffect(() => {
    if (currentPhase) {
      setName(currentPhase.name);
      setGoalType(currentPhase.goalType);
      setStartDate(currentPhase.startDate);
      setEndDate(currentPhase.endDate);
      setNotes(currentPhase.notes || "");
      setRestDays(currentPhase.restDays || []);
      if (localDayCount === null) {
        setLocalDayCount(currentPhase.cycleLength || 3);
      }
    }
  }, [currentPhase, localDayCount]);

  // Mutation to update rest days
  const updateRestDaysMutation = useMutation({
    mutationFn: async (newRestDays: number[]) => {
      const res = await apiRequest("PATCH", `/api/training-phases/${actualPhaseId}`, { restDays: newRestDays });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases", actualPhaseId] });
    }
  });

  const toggleRestDay = (dayIndex: number) => {
    const newRestDays = restDays.includes(dayIndex)
      ? restDays.filter(d => d !== dayIndex)
      : [...restDays, dayIndex];
    setRestDays(newRestDays);
    updateRestDaysMutation.mutate(newRestDays);
  };

  // Fetch exercises
  const { data: exercises = [], isLoading: exercisesLoading } = useQuery<PhaseExercise[]>({
    queryKey: ["/api/training-phases", actualPhaseId, "exercises"],
    queryFn: async () => {
      const res = await fetch(`/api/training-phases/${actualPhaseId}/exercises`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch exercises");
      return res.json();
    },
    enabled: !!actualPhaseId
  });

  // Mutations
  const updatePhaseMutation = useMutation({
    mutationFn: async (data: Partial<TrainingPhase>) => {
      const res = await apiRequest("PATCH", `/api/training-phases/${actualPhaseId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases", actualPhaseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases/member"] });
      toast({ title: "Phase updated" });
    }
  });

  const addExerciseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/training-phases/${actualPhaseId}/exercises`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases", actualPhaseId, "exercises"] });
      setNewExercise({
        dayIndex: 0,
        muscleType: "Chest",
        bodyPart: "Upper Body",
        exerciseName: "",
        sets: 3,
        reps: 10,
        weight: ""
      });
      toast({ title: "Exercise added" });
    }
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (exerciseId: number) => {
      await apiRequest("DELETE", `/api/training-phases/exercises/${exerciseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases", actualPhaseId, "exercises"] });
      toast({ title: "Exercise removed" });
    }
  });

  const exercisesByDay = exercises.reduce((acc, ex) => {
    if (!acc[ex.dayIndex]) acc[ex.dayIndex] = [];
    acc[ex.dayIndex].push(ex);
    return acc;
  }, {} as Record<number, PhaseExercise[]>);

  const dayCount = localDayCount || currentPhase?.cycleLength || 3;

  const handleAddDay = () => {
    const newCount = dayCount + 1;
    setLocalDayCount(newCount);
    updatePhaseMutation.mutate({ cycleLength: newCount });
  };

  const handleRemoveDay = () => {
    if (dayCount <= 1) return;
    const newCount = dayCount - 1;
    setLocalDayCount(newCount);
    updatePhaseMutation.mutate({ cycleLength: newCount });
  };

  const handleSaveDetails = () => {
    updatePhaseMutation.mutate({ name, goalType, startDate, endDate, notes: notes || null });
  };

  const handleAddExercise = () => {
    if (!newExercise.exerciseName.trim()) {
      toast({ title: "Please enter an exercise name", variant: "destructive" });
      return;
    }
    addExerciseMutation.mutate(newExercise);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-unified-editor">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <DialogTitle>Edit Phase: {currentPhase?.name || "Loading..."}</DialogTitle>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "details" | "exercises")}>
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1" data-testid="tab-phase-details">Details</TabsTrigger>
            <TabsTrigger value="exercises" className="flex-1" data-testid="tab-phase-exercises">
              Exercises ({dayCount} days)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-phase-name">Phase Name</Label>
              <input
                id="edit-phase-name"
                type="text"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-edit-phase-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-goal-type">Goal Type</Label>
              <select
                id="edit-goal-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                value={goalType}
                onChange={(e) => setGoalType(e.target.value)}
                data-testid="select-edit-goal-type"
              >
                <option value="general">General Fitness</option>
                <option value="cut">Cut (Fat Loss)</option>
                <option value="bulk">Bulk (Muscle Gain)</option>
                <option value="strength">Strength</option>
                <option value="endurance">Endurance</option>
                <option value="rehab">Rehabilitation</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start-date">Start Date</Label>
                <input
                  id="edit-start-date"
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-edit-start-date"
                />
              </div>
              <div>
                <Label htmlFor="edit-end-date">End Date</Label>
                <input
                  id="edit-end-date"
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-edit-end-date"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-phase-notes">Notes (Optional)</Label>
              <Textarea
                id="edit-phase-notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                data-testid="input-edit-phase-notes"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveDetails} 
                disabled={updatePhaseMutation.isPending}
                data-testid="button-save-phase-details"
              >
                {updatePhaseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Details
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="exercises" className="space-y-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{dayCount} workout days</span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRemoveDay}
                  disabled={dayCount <= 1}
                  data-testid="button-remove-phase-day"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddDay}
                  data-testid="button-add-phase-day"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {exercisesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from({ length: dayCount }).map((_, dayIdx) => {
                  const isRestDay = restDays.includes(dayIdx);
                  return (
                    <div key={dayIdx} className="border rounded-md p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">Day {dayIdx + 1}</h4>
                          {isRestDay && <Badge variant="secondary"><Moon className="w-3 h-3 mr-1" />Rest Day</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Rest Day</span>
                          <Switch
                            checked={isRestDay}
                            onCheckedChange={() => toggleRestDay(dayIdx)}
                            data-testid={`switch-rest-day-${dayIdx}`}
                          />
                        </div>
                      </div>
                      {!isRestDay && (
                        <div className="space-y-2">
                          {(exercisesByDay[dayIdx] || []).map((ex) => (
                            <div key={ex.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2">
                              <div>
                                <span className="font-medium">{ex.exerciseName}</span>
                                <span className="text-muted-foreground text-sm ml-2">
                                  {ex.sets}x{ex.reps} {ex.weight ? `@ ${ex.weight}` : ""}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteExerciseMutation.mutate(ex.id)}
                                data-testid={`button-delete-exercise-${ex.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          {(!exercisesByDay[dayIdx] || exercisesByDay[dayIdx].length === 0) && (
                            <p className="text-muted-foreground text-sm">No exercises for this day</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Add Exercise</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Day</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                        value={newExercise.dayIndex}
                        onChange={(e) => setNewExercise({ ...newExercise, dayIndex: parseInt(e.target.value) })}
                      >
                        {Array.from({ length: dayCount }).map((_, i) => (
                          <option key={i} value={i}>Day {i + 1}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Exercise Name</Label>
                      <input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                        placeholder="e.g. Bench Press"
                        value={newExercise.exerciseName}
                        onChange={(e) => setNewExercise({ ...newExercise, exerciseName: e.target.value })}
                        data-testid="input-new-exercise-name"
                      />
                    </div>
                    <div>
                      <Label>Body Part</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                        value={newExercise.bodyPart}
                        onChange={(e) => setNewExercise({ ...newExercise, bodyPart: e.target.value })}
                        data-testid="select-body-part"
                      >
                        {["Upper Body", "Lower Body", "Core", "Full Body"].map(bp => (
                          <option key={bp} value={bp}>{bp}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Muscle Group</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                        value={newExercise.muscleType}
                        onChange={(e) => setNewExercise({ ...newExercise, muscleType: e.target.value })}
                        data-testid="select-muscle-type"
                      >
                        {["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Cardio"].map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Sets</Label>
                      <input
                        type="number"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                        value={newExercise.sets}
                        onChange={(e) => setNewExercise({ ...newExercise, sets: parseInt(e.target.value) || 3 })}
                      />
                    </div>
                    <div>
                      <Label>Reps</Label>
                      <input
                        type="number"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                        value={newExercise.reps}
                        onChange={(e) => setNewExercise({ ...newExercise, reps: parseInt(e.target.value) || 10 })}
                      />
                    </div>
                  </div>
                  <Button 
                    className="mt-3 w-full" 
                    onClick={handleAddExercise}
                    disabled={addExerciseMutation.isPending}
                    data-testid="button-add-exercise"
                  >
                    {addExerciseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add Exercise
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

type PhaseExercise = {
  id: number;
  phaseId: number;
  dayIndex: number;
  muscleType: string;
  bodyPart: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: string | null;
  orderIndex: number | null;
};

function PhaseExerciseEditor({ phaseId, onClose }: { phaseId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [localDayCount, setLocalDayCount] = useState<number | null>(null);
  const [restDays, setRestDays] = useState<number[]>([]);
  const [newExercise, setNewExercise] = useState({
    dayIndex: 0,
    muscleType: "Chest",
    bodyPart: "Upper Body",
    exerciseName: "",
    sets: 3,
    reps: 10,
    weight: ""
  });

  // Fetch the phase to get its cycleLength
  const { data: phase } = useQuery<TrainingPhase>({
    queryKey: ["/api/training-phases", phaseId],
    queryFn: async () => {
      const res = await fetch(`/api/training-phases/${phaseId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch phase");
      return res.json();
    }
  });

  const { data: exercises = [], isLoading } = useQuery<PhaseExercise[]>({
    queryKey: ["/api/training-phases", phaseId, "exercises"],
    queryFn: async () => {
      const res = await fetch(`/api/training-phases/${phaseId}/exercises`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch exercises");
      return res.json();
    }
  });

  // Initialize local day count and rest days from phase data
  useEffect(() => {
    if (phase) {
      if (localDayCount === null) {
        setLocalDayCount(phase.cycleLength || 3);
      }
      setRestDays(phase.restDays || []);
    }
  }, [phase, localDayCount]);

  // Mutation to update rest days
  const updateRestDaysMutation = useMutation({
    mutationFn: async (newRestDays: number[]) => {
      const res = await apiRequest("PATCH", `/api/training-phases/${phaseId}`, { restDays: newRestDays });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases", phaseId] });
    }
  });

  const toggleRestDay = (dayIndex: number) => {
    const newRestDays = restDays.includes(dayIndex)
      ? restDays.filter(d => d !== dayIndex)
      : [...restDays, dayIndex];
    setRestDays(newRestDays);
    updateRestDaysMutation.mutate(newRestDays);
  };

  const addExerciseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/training-phases/${phaseId}/exercises`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases", phaseId, "exercises"] });
      setNewExercise({
        dayIndex: 0,
        muscleType: "Chest",
        bodyPart: "Upper Body",
        exerciseName: "",
        sets: 3,
        reps: 10,
        weight: ""
      });
      toast({ title: "Exercise added" });
    }
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (exerciseId: number) => {
      await apiRequest("DELETE", `/api/training-phases/exercises/${exerciseId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases", phaseId, "exercises"] });
      toast({ title: "Exercise removed" });
    }
  });

  const updatePhaseCycleLengthMutation = useMutation({
    mutationFn: async (newLength: number) => {
      const res = await apiRequest("PATCH", `/api/training-phases/${phaseId}`, { cycleLength: newLength });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-phases", phaseId] });
    }
  });

  const exercisesByDay = exercises.reduce((acc, ex) => {
    if (!acc[ex.dayIndex]) acc[ex.dayIndex] = [];
    acc[ex.dayIndex].push(ex);
    return acc;
  }, {} as Record<number, PhaseExercise[]>);

  const dayCount = localDayCount || phase?.cycleLength || 3;

  const handleAddDay = () => {
    const newCount = dayCount + 1;
    setLocalDayCount(newCount);
    updatePhaseCycleLengthMutation.mutate(newCount);
  };

  const handleRemoveDay = () => {
    if (dayCount <= 1) return;
    const newCount = dayCount - 1;
    setLocalDayCount(newCount);
    updatePhaseCycleLengthMutation.mutate(newCount);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-go-back-exercises">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <DialogTitle>Edit Phase Exercises</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{dayCount} days</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRemoveDay}
                disabled={dayCount <= 1}
                data-testid="button-remove-phase-day"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleAddDay}
                data-testid="button-add-phase-day"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from({ length: dayCount }).map((_, dayIdx) => {
              const isRestDay = restDays.includes(dayIdx);
              return (
                <div key={dayIdx} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Day {dayIdx + 1}</h4>
                      {isRestDay && <Badge variant="secondary"><Moon className="w-3 h-3 mr-1" />Rest Day</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Rest Day</span>
                      <Switch
                        checked={isRestDay}
                        onCheckedChange={() => toggleRestDay(dayIdx)}
                        data-testid={`switch-rest-day-${dayIdx}`}
                      />
                    </div>
                  </div>
                  {!isRestDay && (
                    <div className="space-y-2">
                      {(exercisesByDay[dayIdx] || []).map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-2">
                          <div>
                            <span className="font-medium">{ex.exerciseName}</span>
                            <span className="text-muted-foreground text-sm ml-2">
                              {ex.sets}x{ex.reps} {ex.weight ? `@ ${ex.weight}` : ""}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteExerciseMutation.mutate(ex.id)}
                            data-testid={`button-delete-exercise-${ex.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      {(!exercisesByDay[dayIdx] || exercisesByDay[dayIdx].length === 0) && (
                        <p className="text-muted-foreground text-sm">No exercises for this day</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Add Exercise</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Day</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={newExercise.dayIndex}
                    onChange={(e) => setNewExercise({ ...newExercise, dayIndex: parseInt(e.target.value) })}
                  >
                    {Array.from({ length: dayCount }).map((_, i) => (
                      <option key={i} value={i}>Day {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Exercise Name</Label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    placeholder="e.g., Bench Press"
                    value={newExercise.exerciseName}
                    onChange={(e) => setNewExercise({ ...newExercise, exerciseName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Body Part</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={newExercise.bodyPart}
                    onChange={(e) => setNewExercise({ ...newExercise, bodyPart: e.target.value })}
                  >
                    {["Upper Body", "Lower Body", "Core", "Full Body"].map(bp => (
                      <option key={bp} value={bp}>{bp}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Muscle Group</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={newExercise.muscleType}
                    onChange={(e) => setNewExercise({ ...newExercise, muscleType: e.target.value })}
                  >
                    {["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Cardio"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Sets</Label>
                  <input
                    type="number"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={newExercise.sets}
                    onChange={(e) => setNewExercise({ ...newExercise, sets: parseInt(e.target.value) || 3 })}
                  />
                </div>
                <div>
                  <Label>Reps</Label>
                  <input
                    type="number"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    value={newExercise.reps}
                    onChange={(e) => setNewExercise({ ...newExercise, reps: parseInt(e.target.value) || 10 })}
                  />
                </div>
                <div>
                  <Label>Weight (optional)</Label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm mt-1"
                    placeholder="e.g., 60kg"
                    value={newExercise.weight}
                    onChange={(e) => setNewExercise({ ...newExercise, weight: e.target.value })}
                  />
                </div>
              </div>
              <Button 
                className="mt-3"
                onClick={() => {
                  if (!newExercise.exerciseName) {
                    toast({ title: "Please enter exercise name", variant: "destructive" });
                    return;
                  }
                  addExerciseMutation.mutate(newExercise);
                }}
                disabled={addExerciseMutation.isPending}
              >
                {addExerciseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add Exercise
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
