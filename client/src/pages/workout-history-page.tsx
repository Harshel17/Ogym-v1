import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar, Dumbbell, Shield, ChevronRight, Save, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

type WorkoutSession = {
  date: string;
  title: string;
  exercises: {
    completionId: number;
    exerciseName: string;
    muscleType: string;
    sets: number;
    reps: number;
    weight: string | null;
    actualSets: number | null;
    actualReps: number | null;
    actualWeight: string | null;
    notes: string | null;
  }[];
};

export default function WorkoutHistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(null);
  const [editInputs, setEditInputs] = useState<Record<number, { sets: string; reps: string; weight: string; notes: string }>>({});

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

  const handleOpenSession = (session: WorkoutSession) => {
    setSelectedSession(session);
    const inputs: Record<number, { sets: string; reps: string; weight: string; notes: string }> = {};
    session.exercises.forEach(ex => {
      inputs[ex.completionId] = {
        sets: ex.actualSets?.toString() || ex.sets.toString(),
        reps: ex.actualReps?.toString() || ex.reps.toString(),
        weight: ex.actualWeight || ex.weight || "",
        notes: ex.notes || ""
      };
    });
    setEditInputs(inputs);
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
        <Link href="/progress">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
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
                    <Badge variant="secondary">{session.exercises.length} exercises</Badge>
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
            {selectedSession?.exercises.map((exercise) => {
              const inputs = editInputs[exercise.completionId] || {};
              return (
                <Card key={exercise.completionId} className="border bg-muted/30">
                  <CardHeader className="py-3 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{exercise.exerciseName}</CardTitle>
                      <Badge variant="outline">{exercise.muscleType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Prescribed: {exercise.sets}x{exercise.reps} {exercise.weight ? `@ ${exercise.weight}` : ''}
                    </p>
                  </CardHeader>
                  <CardContent className="py-3 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Sets</label>
                        <Input
                          type="number"
                          value={inputs.sets || ''}
                          onChange={(e) => handleInputChange(exercise.completionId, 'sets', e.target.value)}
                          className="h-9"
                          data-testid={`input-sets-${exercise.completionId}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Reps</label>
                        <Input
                          type="number"
                          value={inputs.reps || ''}
                          onChange={(e) => handleInputChange(exercise.completionId, 'reps', e.target.value)}
                          className="h-9"
                          data-testid={`input-reps-${exercise.completionId}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Weight</label>
                        <Input
                          type="text"
                          value={inputs.weight || ''}
                          onChange={(e) => handleInputChange(exercise.completionId, 'weight', e.target.value)}
                          className="h-9"
                          data-testid={`input-weight-${exercise.completionId}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                      <Input
                        type="text"
                        placeholder="Add notes..."
                        value={inputs.notes || ''}
                        onChange={(e) => handleInputChange(exercise.completionId, 'notes', e.target.value)}
                        className="h-9"
                        data-testid={`input-notes-${exercise.completionId}`}
                      />
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => handleSaveExercise(exercise.completionId)}
                      disabled={updateExerciseMutation.isPending}
                      data-testid={`button-save-${exercise.completionId}`}
                    >
                      {updateExerciseMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
