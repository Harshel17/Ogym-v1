import { useAuth } from "@/hooks/use-auth";
import { useMemberCycle, useCompleteWorkout } from "@/hooks/use-workouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MemberWorkoutPage() {
  const { user } = useAuth();
  const { data: cycleData, isLoading } = useMemberCycle();
  const completeWorkoutMutation = useCompleteWorkout();

  if (user?.role !== 'member') return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading your workout cycle...</p>
      </div>
    );
  }

  if (!cycleData) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">My Workout Cycle</h2>
          <p className="text-muted-foreground mt-1">Your personalized training program.</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No workout cycle assigned yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Contact your trainer to get started.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { cycle, workouts } = cycleData;
  const today = new Date();
  const todayDay = today.getDay();
  const todayWorkouts = workouts.filter((w: any) => w.dayOfWeek === todayDay);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">My Workout Cycle</h2>
        <p className="text-muted-foreground mt-1">Your personalized training program.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{cycle.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {cycle.startDate} to {cycle.endDate}
          </p>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today's Workout - {days[todayDay]}</CardTitle>
        </CardHeader>
        <CardContent>
          {todayWorkouts.length === 0 ? (
            <p className="text-muted-foreground">Rest day! No workout scheduled.</p>
          ) : (
            <div className="space-y-3">
              {todayWorkouts.map((workout: any) => (
                <div key={workout.id} className="flex items-start gap-4 p-3 border rounded-md hover:bg-muted/50">
                  <div className="flex-1">
                    <h3 className="font-semibold">{workout.exercise}</h3>
                    <p className="text-sm text-muted-foreground">
                      {workout.sets} sets x {workout.reps} reps
                      {workout.weight && ` @ ${workout.weight}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      completeWorkoutMutation.mutate({
                        workoutId: workout.id,
                        date: format(today, 'yyyy-MM-dd'),
                        completed: true,
                      });
                    }}
                    disabled={completeWorkoutMutation.isPending}
                    data-testid={`button-complete-${workout.id}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Full Week Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {days.map((day, dayIndex) => {
              const dayWorkouts = workouts.filter((w: any) => w.dayOfWeek === dayIndex);
              return (
                <div key={dayIndex}>
                  <h3 className="font-semibold text-sm mb-2">{day}</h3>
                  {dayWorkouts.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Rest day</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      {dayWorkouts.map((w: any) => (
                        <p key={w.id} className="text-muted-foreground">
                          {w.exercise} - {w.sets}x{w.reps} {w.weight && `@ ${w.weight}`}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
