import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, ChevronUp, Dumbbell, Flame, Target, CalendarDays, Filter, X, Pencil, Save, XCircle, CheckCircle2 } from "lucide-react";
import { format, subDays, startOfMonth, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WorkoutSummary = {
  streak: number;
  totalWorkouts: number;
  last7DaysCount: number;
  thisMonthCount: number;
  calendarDays: { date: string; focusLabel: string }[];
};

type WorkoutHistoryItem = {
  sessionId: number;
  date: string;
  focusLabel: string;
};

type SessionExercise = {
  id: number;
  exerciseName: string;
  sets: number | null;
  reps: number | null;
  weight: string | null;
  notes: string | null;
};

type SessionDetail = {
  id: number;
  date: string;
  focusLabel: string;
  exercises: SessionExercise[];
};

type EditedExercise = {
  sets: string;
  reps: string;
  weight: string;
  notes: string;
};

export default function MyWorkoutsPage() {
  const { toast } = useToast();
  
  const [dateFilter, setDateFilter] = useState<"7d" | "30d" | "month" | "all">("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<number, SessionDetail>>({});
  
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [editedExercises, setEditedExercises] = useState<Record<number, EditedExercise>>({});
  const [originalExercises, setOriginalExercises] = useState<Record<number, SessionExercise>>({});

  const today = new Date().toISOString().split('T')[0];

  const getDateRange = () => {
    switch (dateFilter) {
      case "7d":
        return { from: subDays(new Date(), 7).toISOString().split('T')[0], to: today };
      case "30d":
        return { from: subDays(new Date(), 30).toISOString().split('T')[0], to: today };
      case "month":
        return { from: startOfMonth(new Date()).toISOString().split('T')[0], to: today };
      case "all":
      default:
        if (customFrom && customTo) {
          return { 
            from: customFrom.toISOString().split('T')[0], 
            to: customTo.toISOString().split('T')[0] 
          };
        }
        return { from: undefined, to: undefined };
    }
  };

  const { from, to } = getDateRange();

  const { data: summary } = useQuery<WorkoutSummary>({
    queryKey: ["/api/member/workout/summary"],
  });

  const { data: history = [], isLoading } = useQuery<WorkoutHistoryItem[]>({
    queryKey: ["/api/member/workout/history", from, to],
    queryFn: async () => {
      let url = "/api/member/workout/history";
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleExpandSession = async (sessionId: number) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      setEditingSession(null);
      return;
    }
    
    setExpandedSession(sessionId);
    setEditingSession(null);
    
    if (!sessionDetails[sessionId]) {
      try {
        const res = await fetch(`/api/member/workout/session/${sessionId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSessionDetails(prev => ({ ...prev, [sessionId]: data }));
        }
      } catch (err) {
        console.error("Failed to fetch session details");
      }
    }
  };

  const startEditing = (sessionId: number, exercises: SessionExercise[]) => {
    setEditingSession(sessionId);
    const edited: Record<number, EditedExercise> = {};
    const original: Record<number, SessionExercise> = {};
    exercises.forEach(ex => {
      edited[ex.id] = {
        sets: String(ex.sets ?? ""),
        reps: String(ex.reps ?? ""),
        weight: ex.weight ?? "",
        notes: ex.notes ?? "",
      };
      original[ex.id] = { ...ex };
    });
    setEditedExercises(edited);
    setOriginalExercises(original);
  };

  const cancelEditing = () => {
    setEditingSession(null);
    setEditedExercises({});
    setOriginalExercises({});
  };

  const updateExerciseField = (exerciseId: number, field: keyof EditedExercise, value: string) => {
    setEditedExercises(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: value,
      },
    }));
  };

  const saveEditsMutation = useMutation({
    mutationFn: async ({ sessionId, exercises }: { sessionId: number; exercises: SessionExercise[] }) => {
      const updates = exercises
        .filter(ex => editedExercises[ex.id])
        .map(ex => {
          const edited = editedExercises[ex.id];
          const sets = edited.sets !== "" ? parseInt(edited.sets) : null;
          const reps = edited.reps !== "" ? parseInt(edited.reps) : null;
          return apiRequest("PUT", `/api/member/workout/session/exercise/${ex.id}`, {
            sets: sets !== null && !isNaN(sets) ? sets : null,
            reps: reps !== null && !isNaN(reps) ? reps : null,
            weight: edited.weight !== "" ? edited.weight : null,
            notes: edited.notes !== "" ? edited.notes : null,
          });
        });
      await Promise.all(updates);
    },
    onSuccess: (_, { sessionId }) => {
      const detail = sessionDetails[sessionId];
      if (detail) {
        const updatedExercises = detail.exercises.map(ex => {
          const edited = editedExercises[ex.id];
          if (!edited) return ex;
          const sets = edited.sets !== "" ? parseInt(edited.sets) : null;
          const reps = edited.reps !== "" ? parseInt(edited.reps) : null;
          return {
            ...ex,
            sets: sets !== null && !isNaN(sets) ? sets : null,
            reps: reps !== null && !isNaN(reps) ? reps : null,
            weight: edited.weight !== "" ? edited.weight : null,
            notes: edited.notes !== "" ? edited.notes : null,
          };
        });
        setSessionDetails(prev => ({
          ...prev,
          [sessionId]: { ...detail, exercises: updatedExercises },
        }));
      }
      
      setEditingSession(null);
      setEditedExercises({});
      setOriginalExercises({});
      
      toast({
        title: "Workout Updated",
        description: "Your workout details have been saved.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save your changes. Please try again.",
      });
    },
  });

  const handleSaveEdits = (sessionId: number) => {
    const detail = sessionDetails[sessionId];
    if (!detail) return;
    saveEditsMutation.mutate({ sessionId, exercises: detail.exercises });
  };

  const clearFilters = () => {
    setDateFilter("all");
    setCustomFrom(undefined);
    setCustomTo(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">Workout History</h2>
          <p className="text-muted-foreground text-sm">View and edit your completed workouts</p>
        </div>
        <Link href="/progress/stats">
          <Button variant="outline" size="sm" data-testid="button-view-stats">
            View Stats
          </Button>
        </Link>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover-elevate" onClick={() => setDateFilter("all")} data-testid="stat-streak">
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Flame className="w-6 h-6 text-orange-500 mb-1" />
              <p className="text-xl font-bold">{summary.streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setDateFilter("all")} data-testid="stat-total">
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Target className="w-6 h-6 text-blue-500 mb-1" />
              <p className="text-xl font-bold">{summary.totalWorkouts}</p>
              <p className="text-xs text-muted-foreground">Total Sessions</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setDateFilter("7d")} data-testid="stat-7d">
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Calendar className="w-6 h-6 text-green-500 mb-1" />
              <p className="text-xl font-bold">{summary.last7DaysCount}</p>
              <p className="text-xs text-muted-foreground">Last 7 Days</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setDateFilter("month")} data-testid="stat-month">
            <CardContent className="flex flex-col items-center justify-center py-4">
              <CalendarDays className="w-6 h-6 text-purple-500 mb-1" />
              <p className="text-xl font-bold">{summary.thisMonthCount}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              Completed Workouts
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1">
                <Button
                  variant={dateFilter === "7d" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("7d")}
                  data-testid="filter-7d"
                >
                  7d
                </Button>
                <Button
                  variant={dateFilter === "30d" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("30d")}
                  data-testid="filter-30d"
                >
                  30d
                </Button>
                <Button
                  variant={dateFilter === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("month")}
                  data-testid="filter-month"
                >
                  This Month
                </Button>
                <Button
                  variant={dateFilter === "all" && !customFrom ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateFilter("all"); setCustomFrom(undefined); setCustomTo(undefined); }}
                  data-testid="filter-all"
                >
                  All
                </Button>
              </div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-date-picker">
                    <Filter className="w-4 h-4 mr-1" />
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="range"
                    selected={{ from: customFrom, to: customTo }}
                    onSelect={(range) => {
                      setCustomFrom(range?.from);
                      setCustomTo(range?.to);
                      if (range?.from && range?.to) {
                        setDateFilter("all");
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {(dateFilter !== "all" || customFrom) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filter">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          {(from || to) && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing: {from ? format(parseISO(from), "MMM d, yyyy") : "Start"} - {to ? format(parseISO(to), "MMM d, yyyy") : "Now"}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Dumbbell className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No completed workouts found.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete exercises from your dashboard to see them here.
              </p>
            </div>
          ) : (
            history.map((session) => {
              const isExpanded = expandedSession === session.sessionId;
              const isEditing = editingSession === session.sessionId;
              const detail = sessionDetails[session.sessionId];
              const exerciseCount = detail?.exercises?.length ?? 0;
              
              return (
                <Collapsible
                  key={session.sessionId}
                  open={isExpanded}
                  onOpenChange={() => handleExpandSession(session.sessionId)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className="flex items-center justify-between p-4 rounded-lg border bg-card cursor-pointer hover-elevate"
                      data-testid={`session-row-${session.sessionId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {format(parseISO(session.date), "EEEE, MMM d, yyyy")}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm text-muted-foreground">
                              {session.focusLabel}
                            </span>
                            {isExpanded && exerciseCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                          Completed
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 border rounded-lg bg-muted/30 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-sm flex items-center gap-2">
                          <Dumbbell className="w-4 h-4" />
                          Exercises
                          {exerciseCount > 0 && (
                            <span className="text-muted-foreground font-normal">
                              ({exerciseCount})
                            </span>
                          )}
                        </h4>
                        {detail && detail.exercises.length > 0 && (
                          isEditing ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={cancelEditing}
                                disabled={saveEditsMutation.isPending}
                                data-testid="button-cancel-edit"
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdits(session.sessionId)}
                                disabled={saveEditsMutation.isPending}
                                data-testid="button-save-edit"
                              >
                                <Save className="w-4 h-4 mr-1" />
                                {saveEditsMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(session.sessionId, detail.exercises);
                              }}
                              data-testid="button-edit-workout"
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit Workout
                            </Button>
                          )
                        )}
                      </div>
                      
                      {!detail ? (
                        <p className="text-sm text-muted-foreground py-2">Loading exercises...</p>
                      ) : detail.exercises.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No exercises recorded for this session.</p>
                      ) : (
                        <div className="space-y-3">
                          {detail.exercises.map((exercise, idx) => {
                            const edited = editedExercises[exercise.id];
                            
                            return (
                              <div
                                key={exercise.id || idx}
                                className={`p-3 rounded-lg border ${isEditing ? "bg-background" : "bg-background/50"}`}
                                data-testid={`exercise-${session.sessionId}-${idx}`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="font-medium">{exercise.exerciseName}</h5>
                                </div>
                                
                                {isEditing ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-3">
                                      <div>
                                        <Label htmlFor={`edit-sets-${exercise.id}`} className="text-xs text-muted-foreground">
                                          Sets
                                        </Label>
                                        <Input
                                          id={`edit-sets-${exercise.id}`}
                                          type="number"
                                          min="0"
                                          value={edited?.sets ?? ""}
                                          onChange={(e) => updateExerciseField(exercise.id, "sets", e.target.value)}
                                          className="mt-1"
                                          data-testid={`input-edit-sets-${exercise.id}`}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor={`edit-reps-${exercise.id}`} className="text-xs text-muted-foreground">
                                          Reps
                                        </Label>
                                        <Input
                                          id={`edit-reps-${exercise.id}`}
                                          type="number"
                                          min="0"
                                          value={edited?.reps ?? ""}
                                          onChange={(e) => updateExerciseField(exercise.id, "reps", e.target.value)}
                                          className="mt-1"
                                          data-testid={`input-edit-reps-${exercise.id}`}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor={`edit-weight-${exercise.id}`} className="text-xs text-muted-foreground">
                                          Weight
                                        </Label>
                                        <Input
                                          id={`edit-weight-${exercise.id}`}
                                          type="text"
                                          placeholder="e.g. 50kg"
                                          value={edited?.weight ?? ""}
                                          onChange={(e) => updateExerciseField(exercise.id, "weight", e.target.value)}
                                          className="mt-1"
                                          data-testid={`input-edit-weight-${exercise.id}`}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <Label htmlFor={`edit-notes-${exercise.id}`} className="text-xs text-muted-foreground">
                                        Notes
                                      </Label>
                                      <Textarea
                                        id={`edit-notes-${exercise.id}`}
                                        placeholder="Add notes about this exercise..."
                                        value={edited?.notes ?? ""}
                                        onChange={(e) => updateExerciseField(exercise.id, "notes", e.target.value)}
                                        className="mt-1 resize-none"
                                        rows={2}
                                        data-testid={`input-edit-notes-${exercise.id}`}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-4 text-muted-foreground">
                                      <span>
                                        <span className="font-medium text-foreground">{exercise.sets ?? "-"}</span> sets
                                      </span>
                                      <span>
                                        <span className="font-medium text-foreground">{exercise.reps ?? "-"}</span> reps
                                      </span>
                                      {exercise.weight && (
                                        <span>
                                          @ <span className="font-medium text-foreground">{exercise.weight}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {!isEditing && exercise.notes && (
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    {exercise.notes}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
