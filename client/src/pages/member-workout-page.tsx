import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTodayWorkout, useCompleteWorkout, useMemberStats, useMemberCycle } from "@/hooks/use-workouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Flame, Target, Calendar, ChevronDown, ChevronUp } from "lucide-react";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ExerciseInputs {
  [id: number]: {
    sets: string;
    reps: string;
    weight: string;
  };
}

export default function MemberWorkoutPage() {
  const { user } = useAuth();
  const { data: todayData, isLoading: todayLoading } = useTodayWorkout();
  const { data: statsData, isLoading: statsLoading } = useMemberStats();
  const { data: cycleData, isLoading: cycleLoading } = useMemberCycle();
  const completeWorkoutMutation = useCompleteWorkout();
  
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseInputs, setExerciseInputs] = useState<ExerciseInputs>({});

  if (user?.role !== 'member') return null;

  const today = todayData as any;
  const stats = statsData as any;
  const cycle = cycleData as any;

  const getInputs = (itemId: number, item: any) => {
    return exerciseInputs[itemId] || {
      sets: String(item.sets),
      reps: String(item.reps),
      weight: item.weight || '',
    };
  };

  const updateInput = (itemId: number, field: string, value: string) => {
    setExerciseInputs(prev => ({
      ...prev,
      [itemId]: {
        ...getInputs(itemId, { sets: '', reps: '', weight: '' }),
        ...prev[itemId],
        [field]: value,
      }
    }));
  };

  const handleCompleteExercise = (item: any) => {
    const inputs = getInputs(item.id, item);
    completeWorkoutMutation.mutate({
      workoutItemId: item.id,
      actualSets: parseInt(inputs.sets) || item.sets,
      actualReps: parseInt(inputs.reps) || item.reps,
      actualWeight: inputs.weight || item.weight || undefined,
    });
    setExpandedExercise(null);
  };

  const groupedByBodyPart = (today?.items || []).reduce((acc: any, item: any) => {
    const part = item.bodyPart || 'Other';
    if (!acc[part]) acc[part] = [];
    acc[part].push(item);
    return acc;
  }, {});

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
              <div className="space-y-6">
                {Object.entries(groupedByBodyPart).map(([bodyPart, items]: [string, any]) => (
                  <div key={bodyPart}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary">{bodyPart}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {items.filter((i: any) => i.completed).length}/{items.length} completed
                      </span>
                    </div>
                    <div className="space-y-3">
                      {items.map((item: any) => {
                        const isExpanded = expandedExercise === item.id;
                        const inputs = getInputs(item.id, item);
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`border rounded-lg overflow-hidden ${
                              item.completed 
                                ? 'bg-green-500/10 border-green-500/30' 
                                : 'border-border'
                            }`}
                            data-testid={`exercise-card-${item.id}`}
                          >
                            <div 
                              className="flex items-center justify-between p-3 cursor-pointer"
                              onClick={() => !item.completed && setExpandedExercise(isExpanded ? null : item.id)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  item.completed 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-primary/10 text-primary'
                                }`}>
                                  {item.completed ? <CheckCircle2 className="w-4 h-4" /> : item.orderIndex + 1}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className={`font-semibold ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                                      {item.exerciseName}
                                    </h3>
                                    {item.muscleType && (
                                      <Badge variant="outline" className="text-xs">{item.muscleType}</Badge>
                                    )}
                                    {item.completed && (
                                      <Badge className="bg-green-500 text-white text-xs">Done</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Target: {item.sets} sets x {item.reps} reps
                                    {item.weight && ` @ ${item.weight}`}
                                  </p>
                                </div>
                              </div>
                              {!item.completed && (
                                <Button size="icon" variant="ghost">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              )}
                            </div>
                            
                            {isExpanded && !item.completed && (
                              <div className="p-4 pt-0 border-t bg-muted/30">
                                <p className="text-sm text-muted-foreground mb-3">
                                  Enter your actual performance:
                                </p>
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                  <div>
                                    <Label htmlFor={`sets-${item.id}`} className="text-xs">Sets</Label>
                                    <Input
                                      id={`sets-${item.id}`}
                                      type="number"
                                      min="1"
                                      value={inputs.sets}
                                      onChange={(e) => updateInput(item.id, 'sets', e.target.value)}
                                      className="mt-1"
                                      data-testid={`input-sets-${item.id}`}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`reps-${item.id}`} className="text-xs">Reps</Label>
                                    <Input
                                      id={`reps-${item.id}`}
                                      type="number"
                                      min="1"
                                      value={inputs.reps}
                                      onChange={(e) => updateInput(item.id, 'reps', e.target.value)}
                                      className="mt-1"
                                      data-testid={`input-reps-${item.id}`}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`weight-${item.id}`} className="text-xs">Weight</Label>
                                    <Input
                                      id={`weight-${item.id}`}
                                      type="text"
                                      placeholder="e.g. 50kg"
                                      value={inputs.weight}
                                      onChange={(e) => updateInput(item.id, 'weight', e.target.value)}
                                      className="mt-1"
                                      data-testid={`input-weight-${item.id}`}
                                    />
                                  </div>
                                </div>
                                <Button
                                  className="w-full"
                                  onClick={() => handleCompleteExercise(item)}
                                  disabled={completeWorkoutMutation.isPending}
                                  data-testid={`button-complete-${item.id}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Mark as Done
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                          <div key={w.id} className="flex items-center gap-2 text-muted-foreground">
                            <span>{w.exerciseName}</span>
                            <span>-</span>
                            <span>{w.sets}x{w.reps}</span>
                            {w.weight && <span>@ {w.weight}</span>}
                            {w.muscleType && (
                              <Badge variant="outline" className="text-xs ml-auto">{w.muscleType}</Badge>
                            )}
                          </div>
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
