import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar, ChevronDown, ChevronUp, Dumbbell, Flame, Target, CalendarDays, Filter, X, Pencil, Save, XCircle, CheckCircle2, Clock, AlertCircle, Moon } from "lucide-react";
import { format, subDays, startOfMonth, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type WorkoutSummary = {
  streak: number;
  totalWorkouts: number;
  last7DaysCount: number;
  thisMonthCount: number;
  calendarDays: { date: string; focusLabel: string }[];
};

type ScheduleDay = {
  date: string;
  dayIndex: number;
  dayLabel: string;
  status: "done" | "in_progress" | "not_started" | "rest_day";
  isManuallyCompleted: boolean;
  completedExercises: number;
  totalExercises: number;
  sessionId: number | null;
};

type CycleSchedule = {
  cycleId: number | null;
  cycleName: string | null;
  cycleLength: number;
  startDate: string | null;
  endDate: string | null;
  schedule: ScheduleDay[];
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<number, SessionDetail>>({});
  
  const [editingSession, setEditingSession] = useState<number | null>(null);
  const [editedExercises, setEditedExercises] = useState<Record<number, EditedExercise>>({});
  
  const [markDoneDialog, setMarkDoneDialog] = useState<ScheduleDay | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const { data: summary } = useQuery<WorkoutSummary>({
    queryKey: ["/api/member/workout/summary"],
  });

  const { data: scheduleData, isLoading } = useQuery<CycleSchedule>({
    queryKey: ["/api/member/workout/schedule"],
  });

  // Filter schedule based on date filter
  const getFilteredSchedule = () => {
    if (!scheduleData?.schedule) return [];
    
    let filtered = scheduleData.schedule;
    const todayDate = new Date();
    
    switch (dateFilter) {
      case "7d":
        const sevenDaysAgo = subDays(todayDate, 7).toISOString().split('T')[0];
        filtered = filtered.filter(d => d.date >= sevenDaysAgo);
        break;
      case "30d":
        const thirtyDaysAgo = subDays(todayDate, 30).toISOString().split('T')[0];
        filtered = filtered.filter(d => d.date >= thirtyDaysAgo);
        break;
      case "month":
        const monthStart = startOfMonth(todayDate).toISOString().split('T')[0];
        filtered = filtered.filter(d => d.date >= monthStart);
        break;
    }
    
    return filtered;
  };

  const filteredSchedule = getFilteredSchedule();

  const handleExpandDay = async (day: ScheduleDay) => {
    if (expandedDate === day.date) {
      setExpandedDate(null);
      setEditingSession(null);
      return;
    }
    
    setExpandedDate(day.date);
    setEditingSession(null);
    
    if (day.sessionId && !sessionDetails[day.sessionId]) {
      try {
        const res = await fetch(`/api/member/workout/session/${day.sessionId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSessionDetails(prev => ({ ...prev, [day.sessionId!]: data }));
        }
      } catch (err) {
        console.error("Failed to fetch session details");
      }
    }
  };

  const markDoneMutation = useMutation({
    mutationFn: async (date: string) => {
      return apiRequest("POST", `/api/member/workout/day/${date}/mark-done`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/missed"] });
      setMarkDoneDialog(null);
      toast({
        title: "Day Marked as Done",
        description: "This workout day has been marked as completed.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not mark day as done. Please try again.",
      });
    },
  });

  const startEditing = (sessionId: number, exercises: SessionExercise[]) => {
    setEditingSession(sessionId);
    const edited: Record<number, EditedExercise> = {};
    exercises.forEach(ex => {
      edited[ex.id] = {
        sets: String(ex.sets ?? ""),
        reps: String(ex.reps ?? ""),
        weight: ex.weight ?? "",
        notes: ex.notes ?? "",
      };
    });
    setEditedExercises(edited);
  };

  const cancelEditing = () => {
    setEditingSession(null);
    setEditedExercises({});
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

  const getStatusBadge = (status: string, completedExercises: number, totalExercises: number, isManuallyCompleted: boolean) => {
    switch (status) {
      case "done":
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Done ({completedExercises}/{totalExercises})
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            In Progress ({completedExercises}/{totalExercises})
          </Badge>
        );
      case "not_started":
        return (
          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Not Started (0/{totalExercises})
          </Badge>
        );
      case "rest_day":
        return (
          <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
            <Moon className="w-3 h-3 mr-1" />
            Rest Day
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "in_progress":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "not_started":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "rest_day":
        return <Moon className="w-5 h-5 text-blue-500" />;
      default:
        return <Dumbbell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">Workout Schedule</h2>
          <p className="text-muted-foreground text-sm">
            {scheduleData?.cycleName ? `Cycle: ${scheduleData.cycleName}` : "View your workout schedule and progress"}
          </p>
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
              <p className="text-xs text-muted-foreground">Total Days</p>
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
              <CalendarDays className="w-5 h-5" />
              Cycle Schedule
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
                  variant={dateFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("all")}
                  data-testid="filter-all"
                >
                  All
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading schedule...</p>
          ) : !scheduleData?.cycleId ? (
            <div className="text-center py-12">
              <Dumbbell className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No active workout cycle found.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ask your trainer to assign a workout cycle to you.
              </p>
            </div>
          ) : filteredSchedule.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">No workouts in this date range.</p>
            </div>
          ) : (
            filteredSchedule.map((day) => {
              const isExpanded = expandedDate === day.date;
              const detail = day.sessionId ? sessionDetails[day.sessionId] : null;
              const isEditing = detail && editingSession === day.sessionId;
              const isToday = day.date === today;
              
              return (
                <Collapsible
                  key={day.date}
                  open={isExpanded}
                  onOpenChange={() => handleExpandDay(day)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className={`flex items-center justify-between p-4 rounded-lg border bg-card cursor-pointer hover-elevate ${isToday ? "ring-2 ring-primary/50" : ""}`}
                      data-testid={`schedule-day-${day.date}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          day.status === "done" ? "bg-green-500/10" :
                          day.status === "in_progress" ? "bg-yellow-500/10" :
                          day.status === "rest_day" ? "bg-blue-500/10" :
                          "bg-red-500/10"
                        }`}>
                          {getStatusIcon(day.status)}
                        </div>
                        <div>
                          <p className="font-medium flex items-center gap-2">
                            {format(parseISO(day.date), "EEEE, MMM d")}
                            {isToday && (
                              <Badge variant="secondary" className="text-xs">Today</Badge>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {day.dayLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(day.status, day.completedExercises, day.totalExercises, day.isManuallyCompleted)}
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
                      {day.status === "rest_day" ? (
                        <div className="text-center py-4">
                          <Moon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                          <p className="text-muted-foreground">Rest and recover today!</p>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium text-sm flex items-center gap-2">
                              <Dumbbell className="w-4 h-4" />
                              Exercises
                              <span className="text-muted-foreground font-normal">
                                ({day.completedExercises}/{day.totalExercises})
                              </span>
                            </h4>
                            <div className="flex items-center gap-2">
                              {day.status !== "done" && day.date <= today && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMarkDoneDialog(day);
                                  }}
                                  data-testid={`button-mark-done-${day.date}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Mark Day Done
                                </Button>
                              )}
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
                                      onClick={() => handleSaveEdits(day.sessionId!)}
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
                                      startEditing(day.sessionId!, detail.exercises);
                                    }}
                                    data-testid="button-edit-workout"
                                  >
                                    <Pencil className="w-4 h-4 mr-1" />
                                    Edit
                                  </Button>
                                )
                              )}
                            </div>
                          </div>
                          
                          {!day.sessionId ? (
                            <p className="text-sm text-muted-foreground py-2">
                              No exercises completed yet. Go to Today's Workout to start!
                            </p>
                          ) : !detail ? (
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
                                    data-testid={`exercise-${day.date}-${idx}`}
                                  >
                                    <div className="flex items-start justify-between mb-2">
                                      <h5 className="font-medium">{exercise.exerciseName}</h5>
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    </div>
                                    
                                    {isEditing ? (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-3 gap-3">
                                          <div>
                                            <Label className="text-xs text-muted-foreground">Sets</Label>
                                            <Input
                                              type="number"
                                              min="0"
                                              value={edited?.sets ?? ""}
                                              onChange={(e) => updateExerciseField(exercise.id, "sets", e.target.value)}
                                              className="mt-1"
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-xs text-muted-foreground">Reps</Label>
                                            <Input
                                              type="number"
                                              min="0"
                                              value={edited?.reps ?? ""}
                                              onChange={(e) => updateExerciseField(exercise.id, "reps", e.target.value)}
                                              className="mt-1"
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-xs text-muted-foreground">Weight</Label>
                                            <Input
                                              type="text"
                                              placeholder="e.g. 50kg"
                                              value={edited?.weight ?? ""}
                                              onChange={(e) => updateExerciseField(exercise.id, "weight", e.target.value)}
                                              className="mt-1"
                                            />
                                          </div>
                                        </div>
                                        <div>
                                          <Label className="text-xs text-muted-foreground">Notes</Label>
                                          <Textarea
                                            placeholder="Optional notes..."
                                            value={edited?.notes ?? ""}
                                            onChange={(e) => updateExerciseField(exercise.id, "notes", e.target.value)}
                                            className="mt-1 min-h-[60px]"
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-3 gap-3 text-sm">
                                        <div>
                                          <span className="text-muted-foreground">Sets:</span>{" "}
                                          <span className="font-medium">{exercise.sets ?? "-"}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Reps:</span>{" "}
                                          <span className="font-medium">{exercise.reps ?? "-"}</span>
                                        </div>
                                        <div>
                                          <span className="text-muted-foreground">Weight:</span>{" "}
                                          <span className="font-medium">{exercise.weight ?? "-"}</span>
                                        </div>
                                        {exercise.notes && (
                                          <div className="col-span-3 mt-1">
                                            <span className="text-muted-foreground">Notes:</span>{" "}
                                            <span>{exercise.notes}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!markDoneDialog} onOpenChange={() => setMarkDoneDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Day as Done?</DialogTitle>
            <DialogDescription>
              {markDoneDialog && (
                <>
                  You completed {markDoneDialog.completedExercises} of {markDoneDialog.totalExercises} exercises on {format(parseISO(markDoneDialog.date), "MMMM d, yyyy")}.
                  <br /><br />
                  Marking this day as done means you're finished with this workout, even if some exercises were skipped.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkDoneDialog(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => markDoneDialog && markDoneMutation.mutate(markDoneDialog.date)}
              disabled={markDoneMutation.isPending}
            >
              {markDoneMutation.isPending ? "Marking..." : "Mark as Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
