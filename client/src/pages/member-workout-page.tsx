import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTodayWorkout, useCompleteWorkout, useMemberCycle, useDailyPoints, useShareWorkout, useSwapRestDay, useUndoRestDaySwap } from "@/hooks/use-workouts";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Flame, Target, Calendar, ChevronDown, ChevronUp, Trophy, Share2, Moon, Sparkles, ArrowRight, Undo2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

interface WorkoutSummary {
  streak: number;
  totalWorkouts: number;
  last7DaysCount: number;
  thisMonthCount: number;
  calendarDays: { date: string; focusLabel: string }[];
}


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
  // Use the same session-based stats endpoint as Dashboard for consistency
  const { data: workoutSummary, isLoading: statsLoading } = useQuery<WorkoutSummary>({
    queryKey: ["/api/member/workout/summary"],
  });
  const { data: cycleData, isLoading: cycleLoading } = useMemberCycle();
  
  // Get daily points for today
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: dailyPoints } = useDailyPoints(todayStr, todayStr);
  const todayPoints = dailyPoints?.[0];
  
  // Share workout dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [pendingShareLabel, setPendingShareLabel] = useState<string>("");
  const shareWorkoutMutation = useShareWorkout();
  
  const handleAskToShare = (focusLabel: string) => {
    setPendingShareLabel(focusLabel);
    setShareDialogOpen(true);
  };
  
  const handleShareConfirm = () => {
    shareWorkoutMutation.mutate({
      type: "workout_completed",
      label: pendingShareLabel,
      metadata: {}
    });
    setShareDialogOpen(false);
  };
  
  const handleShareSkip = () => {
    setShareDialogOpen(false);
  };
  
  const completeWorkoutMutation = useCompleteWorkout(handleAskToShare);
  const swapRestDayMutation = useSwapRestDay();
  const undoSwapMutation = useUndoRestDaySwap();
  
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseInputs, setExerciseInputs] = useState<ExerciseInputs>({});

  if (user?.role !== 'member') return null;

  const today = todayData as any;
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

      {!statsLoading && workoutSummary && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Flame className="w-8 h-8 text-orange-500 mb-2" />
              <p className="text-2xl font-bold">{workoutSummary.streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Target className="w-8 h-8 text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{workoutSummary.totalWorkouts}</p>
              <p className="text-xs text-muted-foreground">Total Sessions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Calendar className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-2xl font-bold">{workoutSummary.last7DaysCount}</p>
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
              <CardTitle>Today - {today?.dayLabel || `Day ${(today?.dayIndex ?? 0) + 1}`}</CardTitle>
              {today?.cycleName && (
                <p className="text-sm text-muted-foreground">{today.cycleName}</p>
              )}
            </div>
            {todayPoints && todayPoints.plannedPoints > 0 && (
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <div className="text-right" data-testid="points-today">
                  <p className="text-lg font-bold">
                    {todayPoints.earnedPoints}/{todayPoints.plannedPoints}
                  </p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!today?.items || today.items.length === 0 ? (
              <div className="text-center py-8 space-y-4" data-testid="rest-day-card">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mx-auto">
                  <Moon className="w-10 h-10 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    Recovery Day
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                  </h3>
                  <p className="text-muted-foreground mt-2">
                    No workout scheduled today. Rest is essential for muscle growth and recovery.
                  </p>
                </div>
                
                {today?.canSwapRestDay && (
                  <div className="pt-4">
                    <Button 
                      onClick={() => swapRestDayMutation.mutate()}
                      disabled={swapRestDayMutation.isPending}
                      className="gap-2"
                      data-testid="button-swap-rest-day"
                    >
                      <ArrowRight className="w-4 h-4" />
                      {swapRestDayMutation.isPending ? "Swapping..." : "Do Tomorrow's Workout Today"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Tomorrow will become your rest day instead
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto pt-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Stay Hydrated</p>
                    <p className="text-xs text-muted-foreground">Drink plenty of water</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">Get Rest</p>
                    <p className="text-xs text-muted-foreground">7-9 hours of sleep</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Your streak is safe on rest days!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {today?.swap && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20" data-testid="swap-active-banner">
                    <ArrowRight className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Workout Swapped</p>
                      <p className="text-xs text-muted-foreground">
                        You moved tomorrow's workout to today. Tomorrow ({today.swap.targetDate}) will be your rest day.
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => undoSwapMutation.mutate(today.swap.id)}
                      disabled={undoSwapMutation.isPending}
                      data-testid="button-undo-swap"
                    >
                      <Undo2 className="w-4 h-4 mr-1" />
                      Undo
                    </Button>
                  </div>
                )}
                {today?.isRestDay && !today?.swap && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20" data-testid="rest-day-banner">
                    <Moon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Scheduled Rest Day</p>
                      <p className="text-xs text-muted-foreground">Feel free to take it easy, or complete the exercises below if you prefer.</p>
                    </div>
                  </div>
                )}
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
            <CardTitle>Full Cycle Schedule</CardTitle>
            <p className="text-sm text-muted-foreground">{cycle.name} - {cycle.startDate} to {cycle.endDate}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: cycle.cycleLength || 3 }, (_, idx) => {
                const dayLabel = cycle.dayLabels?.[idx] || `Day ${idx + 1}`;
                const dayItems = cycle.items.filter((w: any) => w.dayIndex === idx);
                const muscleTypes = Array.from(new Set(dayItems.map((w: any) => w.muscleType).filter(Boolean)));
                return (
                  <div key={idx}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-sm">{dayLabel}</h3>
                      {muscleTypes.length > 0 && (
                        <span className="text-xs text-muted-foreground">({muscleTypes.join(" + ")})</span>
                      )}
                    </div>
                    {dayItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No exercises assigned</p>
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

      {/* Share Workout Confirmation Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5" />
              Share Your Workout?
            </DialogTitle>
            <DialogDescription>
              Would you like to share your workout progress on the gym feed? Your gym mates will be able to see and react to your achievement.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Today's focus:</p>
              <p className="font-medium">{pendingShareLabel || "Workout"}</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleShareSkip} data-testid="button-skip-share">
              Skip
            </Button>
            <Button onClick={handleShareConfirm} disabled={shareWorkoutMutation.isPending} data-testid="button-confirm-share">
              <Share2 className="w-4 h-4 mr-2" />
              Share on Feed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
