import { useAuth } from "@/hooks/use-auth";
import { useMemberProgress } from "@/hooks/use-workouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Trophy, Dumbbell, Shield } from "lucide-react";

type ProgressEntry = {
  exerciseName: string;
  muscleType: string;
  history: { date: string; weight: string | null; reps: number | null }[];
  personalRecord: { weight: string | null; reps: number | null; date: string } | null;
};

export default function ProgressPage() {
  const { user } = useAuth();
  const { data: progress = [], isLoading } = useMemberProgress();

  if (user?.role !== "member") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Members Only</h2>
        <p className="text-muted-foreground">This page is only for gym members.</p>
      </div>
    );
  }

  const progressList = progress as ProgressEntry[];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Progress Tracking</h2>
        <p className="text-muted-foreground mt-1">Track your workout history and personal records.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading your progress...</p>
        </div>
      ) : progressList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No workout history yet</h3>
            <p className="text-muted-foreground mt-2">Complete some exercises to start tracking your progress!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {progressList.map((exercise, index) => (
            <Card key={index} className="overflow-hidden" data-testid={`card-exercise-${index}`}>
              <CardHeader className="pb-2 bg-muted/30">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold">{exercise.exerciseName}</CardTitle>
                    <Badge variant="outline" className="mt-1">{exercise.muscleType}</Badge>
                  </div>
                  {exercise.personalRecord && parseFloat(exercise.personalRecord.weight || '0') > 0 && (
                    <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
                      <Trophy className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {exercise.personalRecord && (
                  <div className="mb-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Trophy className="w-4 h-4 text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-600 uppercase tracking-wider">Personal Record</span>
                    </div>
                    <p className="font-bold text-lg text-foreground">
                      {exercise.personalRecord.weight ? `${exercise.personalRecord.weight}` : '-'}
                      {exercise.personalRecord.reps && ` x ${exercise.personalRecord.reps} reps`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Achieved on {exercise.personalRecord.date}
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Recent History ({exercise.history.length} sessions)
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {exercise.history.slice(0, 5).map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 px-2 rounded bg-muted/50">
                        <span className="text-muted-foreground">{h.date}</span>
                        <span className="font-medium">
                          {h.weight || '-'} {h.reps && `x ${h.reps}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
