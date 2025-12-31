import { useAuth } from "@/hooks/use-auth";
import { useTodayWorkout, useCompleteWorkout, useMemberStats, useMemberCycle } from "@/hooks/use-workouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Flame, Target, Calendar } from "lucide-react";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function MemberWorkoutPage() {
  const { user } = useAuth();
  const { data: todayData, isLoading: todayLoading } = useTodayWorkout();
  const { data: statsData, isLoading: statsLoading } = useMemberStats();
  const { data: cycleData, isLoading: cycleLoading } = useMemberCycle();
  const completeWorkoutMutation = useCompleteWorkout();

  if (user?.role !== 'member') return null;

  const today = todayData as any;
  const stats = statsData as any;
  const cycle = cycleData as any;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">My Workout</h2>
        <p className="text-muted-foreground mt-1">Your personalized training program.</p>
      </div>

      {!statsLoading && stats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Flame className="w-8 h-8 text-orange-500 mb-2" />
              <p className="text-2xl font-bold">{stats.streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Target className="w-8 h-8 text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{stats.totalWorkouts}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Calendar className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-2xl font-bold">{stats.last7Days}</p>
              <p className="text-xs text-muted-foreground">Last 7 Days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {todayLoading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Loading today's workout...</p>
          </CardContent>
        </Card>
      ) : today?.message ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{today.message}</p>
            <p className="text-sm text-muted-foreground mt-2">Contact your trainer to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Today - {days[today?.dayOfWeek || 0]}</CardTitle>
              {today?.cycleName && (
                <p className="text-sm text-muted-foreground">{today.cycleName}</p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!today?.items || today.items.length === 0 ? (
              <p className="text-muted-foreground">Rest day! No workout scheduled.</p>
            ) : (
              <div className="space-y-3">
                {today.items.map((item: any) => (
                  <div 
                    key={item.id} 
                    className={`flex items-start gap-4 p-3 border rounded-md ${item.completed ? 'bg-green-500/10 border-green-500/30' : 'hover:bg-muted/50'}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.exerciseName}</h3>
                        {item.completed && <Badge variant="outline" className="text-green-600">Done</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.sets} sets x {item.reps} reps
                        {item.weight && ` @ ${item.weight}`}
                      </p>
                    </div>
                    {!item.completed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          completeWorkoutMutation.mutate({
                            workoutItemId: item.id,
                          });
                        }}
                        disabled={completeWorkoutMutation.isPending}
                        data-testid={`button-complete-${item.id}`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!cycleLoading && cycle && cycle.items && (
        <Card>
          <CardHeader>
            <CardTitle>Full Week Schedule</CardTitle>
            <p className="text-sm text-muted-foreground">{cycle.name} - {cycle.startDate} to {cycle.endDate}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {days.map((day, dayIndex) => {
                const dayItems = cycle.items.filter((w: any) => w.dayOfWeek === dayIndex);
                return (
                  <div key={dayIndex}>
                    <h3 className="font-semibold text-sm mb-2">{day}</h3>
                    {dayItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Rest day</p>
                    ) : (
                      <div className="space-y-1 text-sm">
                        {dayItems.map((w: any) => (
                          <p key={w.id} className="text-muted-foreground">
                            {w.exerciseName} - {w.sets}x{w.reps} {w.weight && `@ ${w.weight}`}
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
      )}
    </div>
  );
}
