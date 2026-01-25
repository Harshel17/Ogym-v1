import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTodayWorkout, useCompleteWorkout, useMemberCycle, useDailyPoints, useShareWorkout, useSwapRestDay, useUndoRestDaySwap, useLogWorkoutSets } from "@/hooks/use-workouts";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, CheckCircle2, Flame, Target, Calendar, ChevronDown, ChevronUp, Trophy, Share2, Moon, Sparkles, ArrowRight, Undo2, RotateCcw, Loader2, Plus, Dumbbell, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CycleBuilderWizard } from "@/components/cycle-builder-wizard";

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

interface PerSetInputs {
  [id: number]: {
    sameForAll: boolean;
    setInputs: { reps: string; weight: string; targetReps: number; targetWeight: string }[];
  };
}

interface PlanSetCache {
  [id: number]: { reps: number; weight: string | null; setNumber: number }[];
}

export default function MemberWorkoutPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: todayData, isLoading: todayLoading } = useTodayWorkout();
  // Use the same session-based stats endpoint as Dashboard for consistency
  const { data: workoutSummary, isLoading: statsLoading } = useQuery<WorkoutSummary>({
    queryKey: ["/api/member/workout/summary"],
  });
  const { data: cycleData, isLoading: cycleLoading } = useMemberCycle();
  
  // Personal Mode - check if user has no gym
  const isPersonalMode = user?.role === 'member' && !user?.gymId;
  
  // Personal Mode - fetch personal cycles
  const { data: personalCycles, isLoading: personalCyclesLoading } = useQuery<any[]>({
    queryKey: ["/api/personal/cycles"],
    enabled: isPersonalMode,
  });
  
  // Get daily points for today
  const todayStr = new Date().toISOString().split("T")[0];
  const { data: dailyPoints } = useDailyPoints(todayStr, todayStr);
  const todayPoints = dailyPoints?.[0];
  
  // Create personal cycle state
  const [createCycleOpen, setCreateCycleOpen] = useState(false);
  const [newCycleName, setNewCycleName] = useState("");
  const [newCycleLength, setNewCycleLength] = useState(3);
  const [wizardOpen, setWizardOpen] = useState(false);
  
  // Create personal cycle mutation
  const createCycleMutation = useMutation({
    mutationFn: async (data: { name: string; cycleLength: number }) => {
      const today = new Date().toISOString().split("T")[0];
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 3);
      const res = await apiRequest("POST", "/api/personal/cycles", {
        ...data,
        startDate: today,
        endDate: endDate.toISOString().split("T")[0],
        progressionMode: "completion"
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/cycle"] });
      setCreateCycleOpen(false);
      setNewCycleName("");
      toast({ title: "Workout cycle created!" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to create cycle", variant: "destructive" });
    }
  });
  
  // Share workout dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [pendingShareLabel, setPendingShareLabel] = useState<string>("");
  const shareWorkoutMutation = useShareWorkout();
  
  // End cycle dialog state
  const [endCycleDialogOpen, setEndCycleDialogOpen] = useState(false);
  
  // End cycle mutation
  const endCycleMutation = useMutation({
    mutationFn: async (cycleId: number) => {
      const res = await apiRequest("PATCH", `/api/personal/cycles/${cycleId}`, {
        isActive: false
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/cycle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      setEndCycleDialogOpen(false);
      toast({ title: "Cycle ended successfully! You can start a new one." });
      setWizardOpen(true);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to end cycle", variant: "destructive" });
    }
  });
  
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
  
  // Rest Today / Train Anyway state
  const [restTodayDialogOpen, setRestTodayDialogOpen] = useState(false);
  const [trainAnywayDialogOpen, setTrainAnywayDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [pickDayDialogOpen, setPickDayDialogOpen] = useState(false);
  const [availableDays, setAvailableDays] = useState<any[]>([]);
  
  // Rest Today mutation
  const restTodayMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/workouts/rest-today", {});
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      setRestTodayDialogOpen(false);
      toast({ 
        title: "Rest day logged",
        description: data.note
      });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to log rest day", variant: "destructive" });
    }
  });
  
  // Train Anyway mutation (for rest days)
  const trainAnywayMutation = useMutation({
    mutationFn: async (data: { dayIndex?: number; asExtra?: boolean }) => {
      const res = await apiRequest("POST", "/api/workouts/train-anyway", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      setTrainAnywayDialogOpen(false);
      setPickDayDialogOpen(false);
      toast({ title: data.message });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to start workout", variant: "destructive" });
    }
  });
  
  // Reschedule mutation (calendar mode only)
  const rescheduleMutation = useMutation({
    mutationFn: async (data: { action: string }) => {
      const res = await apiRequest("POST", "/api/workouts/reschedule", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      setRescheduleDialogOpen(false);
      toast({ title: data.message });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to reschedule", variant: "destructive" });
    }
  });
  
  // Fetch available days for "Pick Different Day"
  const fetchAvailableDays = async () => {
    try {
      const res = await apiRequest("GET", "/api/workouts/available-days", undefined);
      const data = await res.json();
      setAvailableDays(data.days || []);
      setPickDayDialogOpen(true);
    } catch (error) {
      toast({ title: "Failed to fetch available days", variant: "destructive" });
    }
  };
  
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null);
  const [exerciseInputs, setExerciseInputs] = useState<ExerciseInputs>({});
  const [perSetInputs, setPerSetInputs] = useState<PerSetInputs>({});
  const [planSetCache, setPlanSetCache] = useState<PlanSetCache>({});
  const [loadingPlanSets, setLoadingPlanSets] = useState<number | null>(null);
  const logWorkoutSetsMutation = useLogWorkoutSets();
  const queryClient = useQueryClient();

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
    const perSet = perSetInputs[item.id];
    
    // If using per-set mode with individual inputs
    if (perSet && !perSet.sameForAll && perSet.setInputs.length > 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      const sets = perSet.setInputs.map((setInput, idx) => ({
        setNumber: idx + 1,
        targetReps: setInput.targetReps,
        targetWeight: setInput.targetWeight || null,
        actualReps: parseInt(setInput.reps) || setInput.targetReps || item.reps,
        actualWeight: setInput.weight || setInput.targetWeight || item.weight || null,
        completed: true
      }));
      
      logWorkoutSetsMutation.mutate({
        workoutItemId: item.id,
        date: todayStr,
        sets
      }, {
        onSuccess: () => setExpandedExercise(null)
      });
    } else {
      // Use uniform values (original behavior)
      const inputs = getInputs(item.id, item);
      completeWorkoutMutation.mutate({
        workoutItemId: item.id,
        actualSets: parseInt(inputs.sets) || item.sets,
        actualReps: parseInt(inputs.reps) || item.reps,
        actualWeight: inputs.weight || item.weight || undefined,
      });
      setExpandedExercise(null);
    }
  };

  const initializePerSetInputs = (
    itemId: number, 
    planSets: { reps: number; weight: string | null; setNumber: number }[],
    defaultReps: number, 
    defaultWeight: string,
    numSets: number
  ) => {
    if (!perSetInputs[itemId]) {
      // Sort plan sets by setNumber to ensure correct order
      const sortedPlanSets = [...planSets].sort((a, b) => a.setNumber - b.setNumber);
      
      const setInputs = sortedPlanSets.length > 0
        ? sortedPlanSets.map(ps => ({
            reps: String(ps.reps),
            weight: ps.weight || '',
            targetReps: ps.reps,
            targetWeight: ps.weight || ''
          }))
        : Array.from({ length: numSets }, () => ({
            reps: String(defaultReps),
            weight: defaultWeight || '',
            targetReps: defaultReps,
            targetWeight: defaultWeight || ''
          }));
      
      setPerSetInputs(prev => ({
        ...prev,
        [itemId]: {
          sameForAll: true,
          setInputs
        }
      }));
    }
  };

  const toggleSameForAll = (itemId: number, value: boolean, item: any) => {
    setPerSetInputs(prev => {
      const current = prev[itemId] || { sameForAll: true, setInputs: [] };
      const inputs = getInputs(itemId, item);
      
      // If toggling to same for all, sync all sets with uniform values
      if (value) {
        return {
          ...prev,
          [itemId]: {
            sameForAll: true,
            setInputs: current.setInputs.map(si => ({
              ...si,
              reps: inputs.reps || String(si.targetReps),
              weight: inputs.weight || si.targetWeight
            }))
          }
        };
      }
      
      // Toggling to per-set mode - populate with latest uniform values
      return {
        ...prev,
        [itemId]: {
          sameForAll: false,
          setInputs: current.setInputs.map(si => ({
            ...si,
            reps: inputs.reps || String(si.targetReps),
            weight: inputs.weight || si.targetWeight
          }))
        }
      };
    });
  };

  const updatePerSetInput = (itemId: number, setIndex: number, field: 'reps' | 'weight', value: string) => {
    setPerSetInputs(prev => {
      const current = prev[itemId];
      if (!current) return prev;
      
      const newSetInputs = [...current.setInputs];
      newSetInputs[setIndex] = { ...newSetInputs[setIndex], [field]: value };
      
      return {
        ...prev,
        [itemId]: {
          ...current,
          setInputs: newSetInputs
        }
      };
    });
  };

  const handleExpandExercise = async (item: any) => {
    if (expandedExercise === item.id) {
      setExpandedExercise(null);
      return;
    }
    
    setExpandedExercise(item.id);
    
    // Check if already initialized
    if (perSetInputs[item.id]) {
      return;
    }
    
    // Fetch plan sets from API
    setLoadingPlanSets(item.id);
    try {
      const planSets = await queryClient.fetchQuery({
        queryKey: ['/api/workouts/items', item.id, 'plan-sets'],
        queryFn: async () => {
          const res = await fetch(`/api/workouts/items/${item.id}/plan-sets`, { credentials: 'include' });
          if (!res.ok) return [];
          return res.json();
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      });
      
      setPlanSetCache(prev => ({ ...prev, [item.id]: planSets }));
      initializePerSetInputs(item.id, planSets, item.reps, item.weight || '', item.sets);
    } catch {
      // Fallback to item defaults if fetch fails
      initializePerSetInputs(item.id, [], item.reps, item.weight || '', item.sets);
    } finally {
      setLoadingPlanSets(null);
    }
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

      {today?.wasAutoReset && (
        <Alert data-testid="alert-auto-reset">
          <RotateCcw className="h-4 w-4" />
          <AlertTitle>Cycle Reset</AlertTitle>
          <AlertDescription>
            Your workout cycle has been reset to Day 1 because you missed more than 3 consecutive days. Welcome back!
          </AlertDescription>
        </Alert>
      )}

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
            {isPersonalMode ? (
              <Button 
                className="mt-4 gap-2" 
                onClick={() => setCreateCycleOpen(true)}
                data-testid="button-create-cycle"
              >
                <Plus className="w-4 h-4" />
                Create Workout Cycle
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Contact your trainer to get started.</p>
            )}
          </CardContent>
        </Card>
      ) : isPersonalMode && !today?.cycleId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Dumbbell className="w-16 h-16 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Start Your Fitness Journey</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Create your own workout cycle to track your exercises and progress. You're in control!
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                variant="default"
                className="gap-2" 
                onClick={() => setWizardOpen(true)}
                data-testid="button-help-build-cycle"
              >
                <Wand2 className="w-4 h-4" />
                Help me build a cycle
              </Button>
              <Button 
                variant="outline"
                className="gap-2" 
                onClick={() => setCreateCycleOpen(true)}
                data-testid="button-create-cycle"
              >
                <Plus className="w-4 h-4" />
                Create from scratch
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-row items-center justify-between gap-2">
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
            </div>
            {!today?.isRestDay && today?.items?.length > 0 && !today?.dayManuallyCompleted && (
              <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setRestTodayDialogOpen(true)}
                  data-testid="button-rest-today"
                >
                  <Moon className="w-4 h-4 mr-1" />
                  Rest Today
                </Button>
                {today?.progressionMode === 'calendar' && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setRescheduleDialogOpen(true)}
                    data-testid="button-reschedule"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reschedule
                  </Button>
                )}
                <p className="text-xs text-muted-foreground ml-auto">
                  {today?.progressionMode === 'completion' 
                    ? "Flex schedule - complete when ready" 
                    : "Calendar schedule"}
                </p>
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
                  <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20" data-testid="rest-day-banner">
                    <div className="flex items-center gap-3 mb-3">
                      <Moon className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Scheduled Rest Day</p>
                        <p className="text-xs text-muted-foreground">
                          {today?.progressionMode === 'completion' 
                            ? "Take a break! Your next workout awaits when you're ready."
                            : "Rest and recover. You can reschedule if needed."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => setTrainAnywayDialogOpen(true)}
                        data-testid="button-train-anyway"
                      >
                        <Dumbbell className="w-4 h-4 mr-1" />
                        Train Anyway
                      </Button>
                      {today?.progressionMode === 'calendar' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setRescheduleDialogOpen(true)}
                          data-testid="button-swap-workout"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Swap with Workout Day
                        </Button>
                      )}
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
                              onClick={() => !item.completed && handleExpandExercise(item)}
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
                                {loadingPlanSets === item.id ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-sm text-muted-foreground mb-3">
                                      Log your actual performance:
                                    </p>
                                    
                                    <div className="flex items-center justify-between mb-4 py-2">
                                      <span className="text-sm font-medium">Same for all sets</span>
                                      <Switch 
                                        checked={perSetInputs[item.id]?.sameForAll ?? true}
                                        onCheckedChange={(value) => toggleSameForAll(item.id, value, item)}
                                        data-testid={`switch-same-for-all-${item.id}`}
                                      />
                                    </div>

                                    {(perSetInputs[item.id]?.sameForAll ?? true) ? (
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
                                    ) : (
                                      <div className="space-y-3 mb-4">
                                        <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium">
                                          <div className="col-span-2">Set</div>
                                          <div className="col-span-3">Target</div>
                                          <div className="col-span-3">Reps</div>
                                          <div className="col-span-4">Weight</div>
                                        </div>
                                        {(perSetInputs[item.id]?.setInputs || []).map((setInput, idx) => (
                                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-2 text-sm font-medium text-center">
                                              {idx + 1}
                                            </div>
                                            <div className="col-span-3 text-xs text-muted-foreground">
                                              {setInput.targetReps}r {setInput.targetWeight && `@ ${setInput.targetWeight}`}
                                            </div>
                                            <div className="col-span-3">
                                              <Input 
                                                type="number" 
                                                min={1} 
                                                value={setInput.reps}
                                                onChange={(e) => updatePerSetInput(item.id, idx, 'reps', e.target.value)}
                                                data-testid={`input-set-${idx + 1}-reps-${item.id}`}
                                              />
                                            </div>
                                            <div className="col-span-4">
                                              <Input 
                                                placeholder="e.g., 50kg"
                                                value={setInput.weight}
                                                onChange={(e) => updatePerSetInput(item.id, idx, 'weight', e.target.value)}
                                                data-testid={`input-set-${idx + 1}-weight-${item.id}`}
                                              />
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <Button
                                      className="w-full"
                                      onClick={() => handleCompleteExercise(item)}
                                      disabled={completeWorkoutMutation.isPending || logWorkoutSetsMutation.isPending}
                                      data-testid={`button-complete-${item.id}`}
                                    >
                                      {(completeWorkoutMutation.isPending || logWorkoutSetsMutation.isPending) ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                      )}
                                      Mark as Done
                                    </Button>
                                  </>
                                )}
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
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Full Cycle Schedule</CardTitle>
              {isPersonalMode && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEndCycleDialogOpen(true)}
                  data-testid="button-end-cycle"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Start New Cycle
                </Button>
              )}
            </div>
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

      {/* End Cycle Confirmation Dialog */}
      <Dialog open={endCycleDialogOpen} onOpenChange={setEndCycleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Start a New Cycle?
            </DialogTitle>
            <DialogDescription>
              This will end your current workout cycle "{cycle?.name}". Your workout history and progress will be saved, but you'll start fresh with a new cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Current cycle:</p>
              <p className="font-medium">{cycle?.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {cycle?.cycleLength} days • Started {cycle?.startDate}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEndCycleDialogOpen(false)} data-testid="button-cancel-end-cycle">
              Keep Current Cycle
            </Button>
            <Button 
              onClick={() => cycle?.id && endCycleMutation.mutate(cycle.id)} 
              disabled={endCycleMutation.isPending}
              data-testid="button-confirm-end-cycle"
            >
              {endCycleMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              End & Start New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createCycleOpen} onOpenChange={setCreateCycleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              Create Workout Cycle
            </DialogTitle>
            <DialogDescription>
              Create your own workout cycle to track your exercises. You can add exercises after creating the cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cycle-name">Cycle Name</Label>
              <Input
                id="cycle-name"
                placeholder="e.g., Push/Pull/Legs"
                value={newCycleName}
                onChange={(e) => setNewCycleName(e.target.value)}
                data-testid="input-cycle-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cycle-length">Days in Cycle</Label>
              <div className="flex gap-2">
                {[3, 4, 5, 6, 7].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    variant={newCycleLength === days ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNewCycleLength(days)}
                    data-testid={`button-days-${days}`}
                  >
                    {days}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                A {newCycleLength}-day cycle means you'll repeat your workout every {newCycleLength} days
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateCycleOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createCycleMutation.mutate({ name: newCycleName, cycleLength: newCycleLength })}
              disabled={!newCycleName.trim() || createCycleMutation.isPending}
              data-testid="button-submit-cycle"
            >
              {createCycleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Cycle"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rest Today Dialog */}
      <Dialog open={restTodayDialogOpen} onOpenChange={setRestTodayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-indigo-500" />
              Rest Today?
            </DialogTitle>
            <DialogDescription>
              {today?.progressionMode === 'completion' 
                ? "Take a rest! Your next workout will still be the same planned workout when you're ready to continue."
                : "Mark today as a rest day. Your schedule will continue normally tomorrow."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRestTodayDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => restTodayMutation.mutate()}
              disabled={restTodayMutation.isPending}
              data-testid="button-confirm-rest-today"
            >
              {restTodayMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Moon className="w-4 h-4 mr-2" />
              )}
              Rest Today
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Train Anyway Dialog */}
      <Dialog open={trainAnywayDialogOpen} onOpenChange={setTrainAnywayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              Train on Rest Day
            </DialogTitle>
            <DialogDescription>
              {today?.progressionMode === 'completion' 
                ? "Choose which workout to do today."
                : "Log an extra workout without changing your schedule."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {today?.progressionMode === 'completion' ? (
              <>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => trainAnywayMutation.mutate({})}
                  disabled={trainAnywayMutation.isPending}
                  data-testid="button-do-next-workout"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Do Next Planned Workout (Recommended)
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={fetchAvailableDays}
                  data-testid="button-pick-different-day"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Pick a Different Day
                </Button>
              </>
            ) : (
              <Button 
                className="w-full justify-start" 
                onClick={() => trainAnywayMutation.mutate({ asExtra: true })}
                disabled={trainAnywayMutation.isPending}
                data-testid="button-train-extra"
              >
                <Dumbbell className="w-4 h-4 mr-2" />
                {trainAnywayMutation.isPending ? "Starting..." : "Start Extra Workout"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pick Day Dialog (for completion mode) */}
      <Dialog open={pickDayDialogOpen} onOpenChange={setPickDayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick a Workout Day</DialogTitle>
            <DialogDescription>
              Choose which day's workout you want to do today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4 max-h-64 overflow-y-auto">
            {availableDays.filter(d => !d.isRestDay).map((day) => (
              <Button
                key={day.dayIndex}
                className="w-full justify-start"
                variant="outline"
                onClick={() => trainAnywayMutation.mutate({ dayIndex: day.dayIndex })}
                disabled={trainAnywayMutation.isPending}
                data-testid={`button-pick-day-${day.dayIndex}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{day.label}</span>
                  <span className="text-xs text-muted-foreground">{day.exerciseCount} exercises</span>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog (for calendar mode) */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Reschedule Workout
            </DialogTitle>
            <DialogDescription>
              {today?.isRestDay 
                ? "Want to workout today? Choose an option to swap your schedule."
                : "Can't workout today? Choose how to adjust your schedule."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {today?.isRestDay ? (
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => rescheduleMutation.mutate({ action: 'swap_next_workout' })}
                disabled={rescheduleMutation.isPending}
                data-testid="button-swap-with-workout"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Swap with Next Workout Day
              </Button>
            ) : (
              <>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => rescheduleMutation.mutate({ action: 'swap_rest' })}
                  disabled={rescheduleMutation.isPending}
                  data-testid="button-swap-with-rest"
                >
                  <Moon className="w-4 h-4 mr-2" />
                  Swap with Next Rest Day (Recommended)
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => rescheduleMutation.mutate({ action: 'move_tomorrow' })}
                  disabled={rescheduleMutation.isPending}
                  data-testid="button-move-tomorrow"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Move to Tomorrow
                </Button>
                <Button 
                  className="w-full justify-start text-muted-foreground" 
                  variant="ghost"
                  onClick={() => rescheduleMutation.mutate({ action: 'skip' })}
                  disabled={rescheduleMutation.isPending}
                  data-testid="button-skip-workout"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Skip (Mark as Missed)
                </Button>
              </>
            )}
          </div>
          {rescheduleMutation.isPending && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm">Rescheduling...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CycleBuilderWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
