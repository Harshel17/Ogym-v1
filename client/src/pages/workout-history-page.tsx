import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useBackNavigation } from "@/hooks/use-back-navigation";
import { ArrowLeft, Calendar, Dumbbell, Shield, ChevronRight, ChevronDown, ChevronUp, Save, Loader2, CheckCircle2, XCircle, Target } from "lucide-react";
import { format } from "date-fns";

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

type LoggedSet = {
  id: number;
  setNumber: number;
  targetReps: number | null;
  targetWeight: string | null;
  actualReps: number | null;
  actualWeight: string | null;
  completed: boolean;
};

type WorkoutLogExercise = {
  id: number;
  exerciseName: string;
  muscleType: string | null;
  bodyPart: string | null;
  sets: LoggedSet[];
};

type DetailedWorkoutLog = {
  log: {
    id: number;
    completedDate: string;
  };
  exercises: WorkoutLogExercise[];
} | null;

export default function WorkoutHistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { goBack } = useBackNavigation();
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [editInputs, setEditInputs] = useState<Record<number, { sets: string; reps: string; weight: string; notes: string }>>({});
  const [detailedLog, setDetailedLog] = useState<DetailedWorkoutLog>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);

  const { data: sessions = [], isLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/me/workouts"],
  });

  const updateExerciseMutation = useMutation({
    mutationFn: async (data: { completionId: number; actualSets?: number; actualReps?: number; actualWeight?: string; notes?: string }) => {
      const res = await apiRequest("PUT", `/api/me/workouts/exercise/${data.completionId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/workouts"] });
      toast({ title: "Exercise updated" });
    },
    onError: () => {
      toast({ title: "Failed to update", variant: "destructive" });
    }
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

  const handleOpenSession = async (session: WorkoutSession) => {
    setSelectedSession(session);
    setExpandedExercise(null);
    setDetailedLog(null);
    const inputs: Record<number, { sets: string; reps: string; weight: string; notes: string }> = {};
    session.exercises.forEach(ex => {
      if (ex.completionId) {
        inputs[ex.completionId] = {
          sets: ex.actualSets?.toString() || ex.sets.toString(),
          reps: ex.actualReps?.toString() || ex.reps.toString(),
          weight: ex.actualWeight || ex.weight || "",
          notes: ex.notes || ""
        };
      }
    });
    setEditInputs(inputs);
    
    // Fetch detailed log with per-set data
    setLoadingLog(true);
    try {
      const res = await fetch(`/api/workouts/log/${session.date}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDetailedLog(data);
      }
    } catch (err) {
      console.error("Failed to fetch detailed log:", err);
    } finally {
      setLoadingLog(false);
    }
  };

  const handleInputChange = (completionId: number, field: 'sets' | 'reps' | 'weight' | 'notes', value: string) => {
    setEditInputs(prev => ({
      ...prev,
      [completionId]: {
        ...prev[completionId],
        [field]: value
      }
    }));
  };

  const handleSaveExercise = (completionId: number) => {
    const inputs = editInputs[completionId];
    updateExerciseMutation.mutate({
      completionId,
      actualSets: inputs.sets ? parseInt(inputs.sets) : undefined,
      actualReps: inputs.reps ? parseInt(inputs.reps) : undefined,
      actualWeight: inputs.weight || undefined,
      notes: inputs.notes || undefined
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" data-testid="button-back" onClick={goBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">My Workouts</h2>
          <p className="text-muted-foreground text-sm">Your workout history by date</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground mt-2">Loading workouts...</p>
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No workout history yet</h3>
            <p className="text-muted-foreground mt-2">Complete some workouts to see them here!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, index) => (
            <Card 
              key={index} 
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
              onClick={() => handleOpenSession(session)}
              data-testid={`card-session-${index}`}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {format(new Date(session.date), "MMM dd, yyyy")}
                      </p>
                      <p className="text-sm text-primary font-medium">{session.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {session.exercises.filter(e => e.completed).length}/{session.exercises.length} done
                    </Badge>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              {selectedSession?.title}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedSession && format(new Date(selectedSession.date), "EEEE, MMMM dd, yyyy")}
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {selectedSession?.exercises.map((exercise, idx) => {
              const inputs = exercise.completionId ? editInputs[exercise.completionId] || {} : {};
              // Find logged sets for this exercise from detailed log
              const logExercise = detailedLog?.exercises.find(e => 
                e.exerciseName.toLowerCase() === exercise.exerciseName.toLowerCase()
              );
              const loggedSets = logExercise?.sets || [];
              const isExpanded = expandedExercise === idx;
              
              return (
                <Card 
                  key={exercise.completionId ?? `skipped-${idx}`} 
                  className={`border ${
                    exercise.completed 
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}
                >
                  <CardHeader 
                    className="py-3 pb-2 cursor-pointer"
                    onClick={() => setExpandedExercise(isExpanded ? null : idx)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {exercise.exerciseName}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </CardTitle>
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
                  
                  {isExpanded && (
                    <CardContent className="py-3 space-y-3 border-t border-border/50">
                      {loadingLog ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          <span className="ml-2 text-sm text-muted-foreground">Loading sets...</span>
                        </div>
                      ) : loggedSets.length > 0 ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground px-1">
                            <span>Set</span>
                            <span>Target Reps</span>
                            <span>Actual Reps</span>
                            <span>Target Weight</span>
                            <span>Actual Weight</span>
                          </div>
                          {loggedSets.map((set) => (
                            <div 
                              key={set.id} 
                              className={`grid grid-cols-5 gap-2 text-sm p-2 rounded-md ${
                                set.completed 
                                  ? 'bg-green-100 dark:bg-green-900/30' 
                                  : 'bg-muted/50'
                              }`}
                              data-testid={`set-row-${set.setNumber}`}
                            >
                              <span className="font-medium">Set {set.setNumber}</span>
                              <span className="text-muted-foreground">{set.targetReps ?? '-'}</span>
                              <span className="font-medium">{set.actualReps ?? '-'}</span>
                              <span className="text-muted-foreground">{set.targetWeight || '-'}</span>
                              <span className="font-medium">{set.actualWeight || '-'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <Target className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {exercise.completed 
                              ? `Actual: ${exercise.actualSets || exercise.sets}x${exercise.actualReps || exercise.reps}${exercise.actualWeight ? ` @ ${exercise.actualWeight}` : ''}`
                              : 'No set data recorded'
                            }
                          </p>
                          {exercise.notes && (
                            <p className="text-xs text-muted-foreground mt-1">Notes: {exercise.notes}</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
