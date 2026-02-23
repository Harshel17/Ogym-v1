import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTodayWorkout, useCompleteWorkout, useMemberCycle, useDailyPoints, useShareWorkout, useSwapRestDay, useUndoRestDaySwap, useLogWorkoutSets } from "@/hooks/use-workouts";
import { useTrainingMode } from "@/hooks/use-gym";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, CheckCircle2, Flame, Target, Calendar, ChevronDown, ChevronUp, Trophy, Share2, Moon, Sparkles, ArrowRight, Undo2, RotateCcw, Loader2, Plus, Swords, Wand2, Shuffle, ArrowLeftRight, History, Clock, Heart, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CycleBuilderWizard } from "@/components/cycle-builder-wizard";
import { AIImportWizard } from "@/components/ai-import-wizard";
import { PersonalModeOnboarding, MemberOnboarding } from "@/components/onboarding-carousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VisualWorkoutMap } from "@/components/visual-workout-map";
import { WeeklyProgress } from "@/components/premium-stats";
import { User } from "lucide-react";

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
    durationMinutes?: string;
    distanceKm?: string;
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
  
  // Self-Guided Mode - check if gym member is in self-guided training mode
  const { data: trainingModeData } = useTrainingMode();
  const isTrainerLed = user?.gymId && trainingModeData?.trainingMode === 'trainer_led';
  
  // Personal Mode - check if user has no gym
  const isPersonalMode = user?.role === 'member' && !user?.gymId;
  const isSelfGuided = user?.gymId && !isTrainerLed;
  const canManageOwnWorkouts = !isTrainerLed;
  
  // Onboarding state
  const onboardingKey = isPersonalMode ? 'ogym_personal_onboarding_seen' : 'ogym_member_onboarding_seen';
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(onboardingKey);
  });
  
  const completeOnboarding = () => {
    localStorage.setItem(onboardingKey, 'true');
    setShowOnboarding(false);
  };
  
  // Personal Mode / Self-Guided - fetch personal cycles 
  const { data: personalCycles, isLoading: personalCyclesLoading } = useQuery<any[]>({
    queryKey: ["/api/personal/cycles"],
    enabled: !!canManageOwnWorkouts,
  });
  
  // Cycle history - fetch all cycles (including inactive)
  const { data: cycleHistory, isLoading: cycleHistoryLoading } = useQuery<any[]>({
    queryKey: ["/api/personal/cycles/history"],
    enabled: !!canManageOwnWorkouts,
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
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [newCycleOptionsOpen, setNewCycleOptionsOpen] = useState(false);
  
  // Cycle history state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedHistoryCycle, setExpandedHistoryCycle] = useState<number | null>(null);
  
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
      queryClient.invalidateQueries({ queryKey: ["/api/personal/cycles/history"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/personal/cycles/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/cycle"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      setEndCycleDialogOpen(false);
      toast({ title: "Cycle ended successfully! Choose how to create your new cycle." });
      setNewCycleOptionsOpen(true);
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
  
  // Do Another Workout state
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [reorderDays, setReorderDays] = useState<any[]>([]);
  const [selectedReorderDay, setSelectedReorderDay] = useState<number | null>(null);
  const [reorderAction, setReorderAction] = useState<"swap" | "push">("swap");
  const [isRestDayReorder, setIsRestDayReorder] = useState(false);
  
  // Rest Today adjust plan state
  const [restAdjustPlan, setRestAdjustPlan] = useState<"none" | "swap_next_rest" | "push_workout">("none");

  // Rest Today mutation (with optional adjustPlan)
  const restTodayMutation = useMutation({
    mutationFn: async (adjustPlan: "none" | "swap_next_rest" | "push_workout" = "none") => {
      const res = await apiRequest("POST", "/api/workouts/rest-today", { adjustPlan });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      setRestTodayDialogOpen(false);
      setRestAdjustPlan("none");
      toast({ 
        title: data.message || "Rest day logged",
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
  
  // Reorder workout mutation ("Do Another Workout" or "Workout Today" from rest day)
  const reorderMutation = useMutation({
    mutationFn: async (data: { cycleId: number; targetDayIndex: number; action: "swap" | "push"; isRestDayReorder?: boolean }) => {
      const res = await apiRequest("POST", "/api/workouts/reorder", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      setReorderDialogOpen(false);
      setSelectedReorderDay(null);
      setIsRestDayReorder(false);
      toast({ title: data.message });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to change workout", variant: "destructive" });
    }
  });
  
  // Fetch available days for reordering
  const openReorderDialog = async (forRestDay = false) => {
    try {
      setIsRestDayReorder(forRestDay);
      const url = forRestDay 
        ? "/api/workouts/available-days?forRestDay=true" 
        : "/api/workouts/available-days";
      const res = await apiRequest("GET", url, undefined);
      const data = await res.json();
      // Filter out current day; for rest day reorder, backend already filters to workout days only
      const currentDayIndex = today?.currentDayIndex ?? today?.dayIndex ?? 0;
      const availableForReorder = (data.days || []).filter((d: any) => 
        d.dayIndex !== currentDayIndex && (forRestDay || !d.isRestDay)
      );
      setReorderDays(availableForReorder);
      setSelectedReorderDay(null);
      setReorderAction("swap");
      setReorderDialogOpen(true);
    } catch (error) {
      toast({ title: "Failed to fetch workout days", variant: "destructive" });
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
      sets: String(item.sets || ''),
      reps: String(item.reps || ''),
      weight: item.weight || '',
      durationMinutes: item.durationMinutes ? String(item.durationMinutes) : '',
      distanceKm: item.distanceKm || '',
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

  // Helper to get local date in YYYY-MM-DD format (same as hooks use)
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleCompleteExercise = (item: any) => {
    const perSet = perSetInputs[item.id];
    
    // Cardio exercises use duration/distance instead of sets/reps/weight
    if (item.exerciseType === 'cardio') {
      const inputs = getInputs(item.id, item);
      completeWorkoutMutation.mutate({
        workoutItemId: item.id,
        actualDurationMinutes: inputs.durationMinutes ? parseInt(inputs.durationMinutes) : item.durationMinutes,
        actualDistanceKm: inputs.distanceKm || item.distanceKm || undefined,
      });
      setExpandedExercise(null);
      return;
    }
    
    // Strength exercises: If using per-set mode with individual inputs
    if (perSet && !perSet.sameForAll && perSet.setInputs.length > 0) {
      const todayStr = getLocalDate();
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
      });
      setExpandedExercise(null);
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

  const handleQuickComplete = (item: any) => {
    if (item.exerciseType === 'cardio') {
      completeWorkoutMutation.mutate({
        workoutItemId: item.id,
        actualDurationMinutes: item.durationMinutes,
        actualDistanceKm: item.distanceKm || undefined
      });
    } else {
      completeWorkoutMutation.mutate({
        workoutItemId: item.id,
        actualSets: item.sets,
        actualReps: item.reps,
        actualWeight: item.weight || undefined
      });
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

  if (showOnboarding) {
    return isPersonalMode 
      ? <PersonalModeOnboarding onComplete={completeOnboarding} />
      : <MemberOnboarding onComplete={completeOnboarding} />;
  }

  return (
    <div className="space-y-3">
      <div className="page-header-gradient">
        <div className="flex items-center gap-3">
          <div className="icon-badge icon-badge-blue">
            <Swords className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-display">My Workout</h2>
            <p className="text-sm text-muted-foreground">Your personalized training program</p>
          </div>
        </div>
      </div>

      {today?.wasAutoReset && (
        <Alert data-testid="alert-auto-reset" className="border-0 bg-amber-500/10">
          <RotateCcw className="h-4 w-4 text-amber-500" />
          <AlertTitle className="text-sm">Cycle Reset</AlertTitle>
          <AlertDescription className="text-xs">
            Your workout cycle has been reset to Day 1 because you missed more than 3 consecutive days. Welcome back!
          </AlertDescription>
        </Alert>
      )}

      {!statsLoading && workoutSummary && (
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-gradient-to-br from-orange-500/5 to-orange-500/10 p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center mx-auto mb-1.5">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-xl font-bold">{workoutSummary.streak}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Day Streak</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-blue-500/5 to-blue-500/10 p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center mx-auto mb-1.5">
              <Target className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold">{workoutSummary.totalWorkouts}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Total Sessions</p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center mx-auto mb-1.5">
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold">{workoutSummary.last7DaysCount}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Last 7 Days</p>
          </div>
        </div>
      )}

      {!statsLoading && workoutSummary && (
        <WeeklyProgress calendarDays={workoutSummary.calendarDays} />
      )}

      {todayLoading ? (
        <Card className="bg-card/60">
          <CardContent className="py-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading today's workout...</p>
          </CardContent>
        </Card>
      ) : today?.message ? (
        <Card className="bg-card/60">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{today.message}</p>
            {canManageOwnWorkouts ? (
              <Button 
                className="mt-4 gap-2" 
                onClick={() => setCreateCycleOpen(true)}
                data-testid="button-create-cycle"
              >
                <Plus className="w-4 h-4" />
                Create Workout Cycle
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">Contact your trainer to get started.</p>
            )}
          </CardContent>
        </Card>
      ) : canManageOwnWorkouts && !today?.cycleId ? (
        <Card className="bg-card/60">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Swords className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">Start Your Fitness Journey</h3>
            <p className="text-xs text-muted-foreground text-center mb-5 max-w-xs">
              {isSelfGuided 
                ? "You're in self-guided mode! Create your own workout cycle to track progress."
                : "Create your own workout cycle to track exercises and progress."}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button 
                variant="default"
                className="gap-2 w-full" 
                onClick={() => setWizardOpen(true)}
                data-testid="button-help-build-cycle"
              >
                <Wand2 className="w-4 h-4" />
                Help me build a cycle
              </Button>
              <Button 
                variant="outline"
                className="gap-2 w-full" 
                onClick={() => setAiImportOpen(true)}
                data-testid="button-import-ai"
              >
                <Sparkles className="w-4 h-4" />
                Import from AI/Chat
              </Button>
              <Button 
                variant="outline"
                className="gap-2 w-full" 
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
        <Card className="bg-card/60 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-primary to-primary/80 p-2.5 rounded-xl shadow-lg shadow-primary/20">
                  <Swords className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {today?.dayLabel || `Day ${(today?.dayIndex ?? 0) + 1}`}
                  </CardTitle>
                  {today?.cycleName && (
                    <p className="text-xs text-muted-foreground mt-0.5">{today.cycleName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {todayPoints && todayPoints.plannedPoints > 0 && (
                  <Badge variant="secondary" className="border-0 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 gap-1" data-testid="points-today">
                    <Trophy className="w-3 h-3" />
                    {todayPoints.earnedPoints}/{todayPoints.plannedPoints}
                  </Badge>
                )}
                {today?.items?.length > 0 && (
                  <Badge 
                    variant="secondary"
                    className={`border-0 ${
                      today.items.every((i: any) => i.completed) 
                        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white" 
                        : "bg-muted/60"
                    }`}
                  >
                    {today.items.every((i: any) => i.completed) && <Sparkles className="w-3 h-3 mr-0.5" />}
                    {today.items.filter((i: any) => i.completed).length}/{today.items.length}
                  </Badge>
                )}
              </div>
            </div>
            {today?.items?.length > 0 && (
              <div className="mt-2">
                <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                    style={{ width: `${(today.items.filter((i: any) => i.completed).length / today.items.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {!today?.isRestDay && today?.items?.length > 0 && !today?.dayManuallyCompleted && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="h-7 text-xs px-2"
                  onClick={() => setRestTodayDialogOpen(true)}
                  data-testid="button-rest-today"
                >
                  <Moon className="w-3.5 h-3.5 mr-1" />
                  Rest
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="h-7 text-xs px-2"
                  onClick={() => openReorderDialog(false)}
                  data-testid="button-do-another-workout"
                >
                  <Shuffle className="w-3.5 h-3.5 mr-1" />
                  Switch
                </Button>
                {today?.progressionMode === 'calendar' && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => setRescheduleDialogOpen(true)}
                    data-testid="button-reschedule"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reschedule
                  </Button>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {today?.progressionMode === 'completion' ? "Flex" : "Calendar"}
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!today?.items || today.items.length === 0 ? (
              <div className="text-center py-6 space-y-3" data-testid="rest-day-card">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mx-auto">
                  <Moon className="w-7 h-7 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Recovery Day</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rest is essential for muscle growth and recovery.
                  </p>
                </div>
                
                {today?.canSwapRestDay && (
                  <div className="pt-2">
                    <Button 
                      size="sm"
                      onClick={() => swapRestDayMutation.mutate()}
                      disabled={swapRestDayMutation.isPending}
                      className="gap-2"
                      data-testid="button-swap-rest-day"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {swapRestDayMutation.isPending ? "Swapping..." : "Do Tomorrow's Workout Today"}
                    </Button>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      Tomorrow will become your rest day instead
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2.5 max-w-xs mx-auto pt-2">
                  <div className="p-2.5 rounded-xl bg-muted/30">
                    <p className="text-xs font-medium">Stay Hydrated</p>
                    <p className="text-[10px] text-muted-foreground">Drink plenty of water</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-muted/30">
                    <p className="text-xs font-medium">Get Rest</p>
                    <p className="text-[10px] text-muted-foreground">7-9 hours of sleep</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1">
                  Your streak is safe on rest days!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {today?.swap && (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-green-500/10" data-testid="swap-active-banner">
                    <div className="p-1.5 rounded-lg bg-green-500/15">
                      <ArrowRight className="w-3.5 h-3.5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">Workout Swapped</p>
                      <p className="text-[10px] text-muted-foreground">
                        Tomorrow ({today.swap.targetDate}) will be rest day.
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7 text-xs px-2"
                      onClick={() => undoSwapMutation.mutate(today.swap.id)}
                      disabled={undoSwapMutation.isPending}
                      data-testid="button-undo-swap"
                    >
                      <Undo2 className="w-3.5 h-3.5 mr-1" />
                      Undo
                    </Button>
                  </div>
                )}
                {today?.isRestDay && !today?.swap && (
                  <div className="p-3 rounded-xl bg-indigo-500/10" data-testid="rest-day-banner">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="p-1.5 rounded-lg bg-indigo-500/15">
                        <Moon className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium">Scheduled Rest Day</p>
                        <p className="text-[10px] text-muted-foreground">
                          {today?.progressionMode === 'completion' 
                            ? "Your next workout awaits when you're ready."
                            : "Rest and recover. Reschedule if needed."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button 
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openReorderDialog(true)}
                        data-testid="button-workout-today"
                      >
                        <Swords className="w-3.5 h-3.5 mr-1" />
                        Workout Today
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setTrainAnywayDialogOpen(true)}
                        data-testid="button-train-anyway"
                      >
                        Train Anyway
                      </Button>
                      {today?.progressionMode === 'calendar' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setRescheduleDialogOpen(true)}
                          data-testid="button-swap-workout"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Swap
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {Object.entries(groupedByBodyPart).map(([bodyPart, items]: [string, any]) => (
                  <div key={bodyPart}>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-[10px] border-0 bg-muted/60">{bodyPart}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {items.filter((i: any) => i.completed).length}/{items.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {items.map((item: any) => {
                        const isExpanded = expandedExercise === item.id;
                        const inputs = getInputs(item.id, item);
                        
                        return (
                          <div 
                            key={item.id} 
                            className={`rounded-lg transition-colors ${
                              item.completed 
                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                                : 'bg-muted/30 border border-transparent'
                            }`}
                            data-testid={`exercise-card-${item.id}`}
                          >
                            <div 
                              className="flex items-center gap-3 p-3 cursor-pointer"
                              onClick={() => !item.completed && handleExpandExercise(item)}
                            >
                              <button
                                onClick={(e) => { e.stopPropagation(); !item.completed && handleQuickComplete(item); }}
                                disabled={item.completed || completeWorkoutMutation.isPending}
                                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                                  item.completed 
                                    ? 'bg-green-500 text-white cursor-default' 
                                    : 'bg-primary/10 text-primary'
                                }`}
                                data-testid={`button-quick-complete-${item.id}`}
                              >
                                {item.completed ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <span className="text-xs font-semibold">{item.orderIndex + 1}</span>
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {(() => {
                                    if (item.exerciseType === 'cardio') return <Heart className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />;
                                    if (item.muscleType === 'Core' || item.muscleType === 'Abs') return <Target className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
                                    return <Swords className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />;
                                  })()}
                                  <p className={`font-medium text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                                    {item.exerciseName}
                                  </p>
                                  {item.sportProgramId && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 flex-shrink-0" data-testid={`sport-badge-${item.id}`}>
                                      <Zap className="w-2.5 h-2.5 mr-0.5" />Sport
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground ml-5">
                                  {item.exerciseType === 'cardio' ? (
                                    <>
                                      {item.durationMinutes ? `${item.durationMinutes} min` : ''}
                                      {item.distanceKm ? ` · ${item.distanceKm}` : ''}
                                    </>
                                  ) : (
                                    <>
                                      {item.sets}x{item.reps} {item.weight ? `@ ${item.weight}` : ''}
                                    </>
                                  )}
                                </p>
                              </div>
                              {!item.completed && (
                                <Button size="icon" variant="ghost">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              )}
                            </div>
                            
                            {isExpanded && !item.completed && (
                              <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/50 mt-1">
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
                                    
                                    {item.exerciseType === 'cardio' ? (
                                      <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div>
                                          <Label htmlFor={`duration-${item.id}`} className="text-xs">Duration (min)</Label>
                                          <Input
                                            id={`duration-${item.id}`}
                                            type="number"
                                            min="1"
                                            placeholder={item.durationMinutes ? String(item.durationMinutes) : '30'}
                                            value={inputs.durationMinutes || ''}
                                            onChange={(e) => updateInput(item.id, 'durationMinutes', e.target.value)}
                                            className="mt-1"
                                            data-testid={`input-duration-${item.id}`}
                                          />
                                        </div>
                                        <div>
                                          <Label htmlFor={`distance-${item.id}`} className="text-xs">Distance</Label>
                                          <Input
                                            id={`distance-${item.id}`}
                                            type="text"
                                            placeholder={item.distanceKm || 'e.g., 5km'}
                                            value={inputs.distanceKm || ''}
                                            onChange={(e) => updateInput(item.id, 'distanceKm', e.target.value)}
                                            className="mt-1"
                                            data-testid={`input-distance-${item.id}`}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <>
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
                                      </>
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
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/15">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Workout Cycle</CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{cycle.name}</p>
                </div>
              </div>
              {canManageOwnWorkouts && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => setEndCycleDialogOpen(true)}
                  data-testid="button-end-cycle"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  New Cycle
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs defaultValue="schedule" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-3 h-8">
                <TabsTrigger value="schedule" className="text-xs" data-testid="tab-schedule">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Schedule
                </TabsTrigger>
                <TabsTrigger value="visual" className="text-xs" data-testid="tab-visual">
                  <User className="w-3.5 h-3.5 mr-1.5" />
                  Visual
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="schedule">
                <div className="space-y-3">
                  {Array.from({ length: cycle.cycleLength || 3 }, (_, idx) => {
                    const dayLabel = cycle.dayLabels?.[idx] || `Day ${idx + 1}`;
                    const dayItems = cycle.items.filter((w: any) => w.dayIndex === idx);
                    const muscleTypes = Array.from(new Set(dayItems.map((w: any) => w.muscleType).filter(Boolean)));
                    return (
                      <div key={idx} className="rounded-lg bg-muted/20 p-2.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="font-medium text-xs">{dayLabel}</h3>
                          {muscleTypes.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">({muscleTypes.join(" + ")})</span>
                          )}
                        </div>
                        {dayItems.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground italic">Rest Day</p>
                        ) : (
                          <div className="space-y-0.5">
                            {dayItems.map((w: any) => (
                              <div key={w.id} className="flex items-center gap-1.5 text-xs text-muted-foreground py-0.5">
                                {w.exerciseType === 'cardio' ? (
                                  <Heart className="w-3 h-3 text-rose-500 flex-shrink-0" />
                                ) : (w.muscleType === 'Core' || w.muscleType === 'Abs') ? (
                                  <Target className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                ) : (
                                  <Swords className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                )}
                                <span className="flex-1 min-w-0 truncate">{w.exerciseName}</span>
                                {w.sportProgramId && (
                                  <span className="inline-flex items-center text-[9px] px-1 py-0 rounded border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex-shrink-0" data-testid={`sport-tag-cycle-${w.id}`}>
                                    <Zap className="w-2 h-2 mr-0.5" />Sport
                                  </span>
                                )}
                                <span className="text-[10px] flex-shrink-0">
                                  {w.exerciseType === 'cardio' ? (
                                    <>
                                      {w.durationMinutes ? `${w.durationMinutes}m` : ''}
                                      {w.distanceKm ? ` ${w.distanceKm}` : ''}
                                    </>
                                  ) : (
                                    <>
                                      {w.sets}x{w.reps}{w.weight ? ` @ ${w.weight}` : ''}
                                    </>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
              
              <TabsContent value="visual">
                <VisualWorkoutMap
                  workoutItems={cycle.items}
                  cycleLength={cycle.cycleLength || 3}
                  dayLabels={cycle.dayLabels}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {canManageOwnWorkouts && cycleHistory && cycleHistory.length > 1 && (
        <Card className="bg-card/60">
          <CardHeader 
            className="cursor-pointer pb-2"
            onClick={() => setHistoryOpen(!historyOpen)}
            data-testid="button-toggle-history"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-muted/50">
                  <History className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Workout History</CardTitle>
                  <CardDescription className="text-[10px] mt-0.5">
                    {cycleHistory.filter((c: any) => !c.isActive).length} past phases
                  </CardDescription>
                </div>
              </div>
              <div className="p-1.5 rounded-lg">
                {historyOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>
          </CardHeader>
          
          {historyOpen && (
            <CardContent className="pt-0 space-y-2.5">
              {cycleHistory
                .filter((c: any) => !c.isActive)
                .map((historyCycle: any) => (
                  <div 
                    key={historyCycle.id} 
                    className="rounded-lg bg-muted/20 p-3"
                    data-testid={`cycle-history-${historyCycle.id}`}
                  >
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedHistoryCycle(expandedHistoryCycle === historyCycle.id ? null : historyCycle.id)}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm">{historyCycle.name}</h4>
                          <Badge variant="secondary" className="text-[10px] border-0 bg-muted/60">
                            Phase {historyCycle.phaseNumber || 1}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{historyCycle.startDate} - {historyCycle.endDate || "Ended"}</span>
                          <span>{historyCycle.cycleLength} days</span>
                        </div>
                      </div>
                      {expandedHistoryCycle === historyCycle.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                    
                    {expandedHistoryCycle === historyCycle.id && historyCycle.items && (
                      <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5">
                        {Array.from({ length: historyCycle.cycleLength || 3 }, (_, idx) => {
                          const dayLabel = historyCycle.dayLabels?.[idx] || `Day ${idx + 1}`;
                          const dayItems = historyCycle.items.filter((w: any) => w.dayIndex === idx);
                          const muscleTypes = Array.from(new Set(dayItems.map((w: any) => w.muscleType).filter(Boolean)));
                          return (
                            <div key={idx}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <h5 className="font-medium text-xs">{dayLabel}</h5>
                                {muscleTypes.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">({(muscleTypes as string[]).join(" + ")})</span>
                                )}
                              </div>
                              {dayItems.length === 0 ? (
                                <p className="text-[10px] text-muted-foreground italic">Rest Day</p>
                              ) : (
                                <div className="space-y-0.5">
                                  {dayItems.map((w: any) => (
                                    <div key={w.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <span className="flex-1 min-w-0 truncate">{w.exerciseName}</span>
                                      <span className="text-[10px] flex-shrink-0">{w.sets}x{w.reps}{w.weight ? ` @ ${w.weight}` : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
            </CardContent>
          )}
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

      {/* New Cycle Options Dialog - Choose creation method */}
      <Dialog open={newCycleOptionsOpen} onOpenChange={setNewCycleOptionsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Cycle
            </DialogTitle>
            <DialogDescription>
              Choose how you'd like to create your new workout cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button 
              variant="outline" 
              className="h-auto py-4 justify-start"
              onClick={() => {
                setNewCycleOptionsOpen(false);
                setWizardOpen(true);
              }}
              data-testid="button-build-from-scratch"
            >
              <div className="flex items-center gap-3">
                <Wand2 className="w-5 h-5 text-primary" />
                <div className="text-left">
                  <div className="font-medium">Build from Scratch</div>
                  <div className="text-sm text-muted-foreground">Create a custom cycle with the guided wizard</div>
                </div>
              </div>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-4 justify-start"
              onClick={() => {
                setNewCycleOptionsOpen(false);
                setAiImportOpen(true);
              }}
              data-testid="button-import-from-ai"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <div className="text-left">
                  <div className="font-medium">Import from AI/Chat</div>
                  <div className="text-sm text-muted-foreground">Paste or screenshot a workout from ChatGPT</div>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createCycleOpen} onOpenChange={setCreateCycleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5" />
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

      {/* Rest Today Dialog - With Plan Adjustment Options */}
      <Dialog open={restTodayDialogOpen} onOpenChange={(open) => {
        setRestTodayDialogOpen(open);
        if (!open) setRestAdjustPlan("none");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5 text-indigo-500" />
              Rest Today
            </DialogTitle>
            <DialogDescription>
              How should we adjust your plan for this cycle?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <button
              type="button"
              onClick={() => setRestAdjustPlan("none")}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                restAdjustPlan === "none"
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted/50'
              }`}
              data-testid="rest-option-none"
            >
              <div className="flex items-start gap-3">
                <Moon className="w-5 h-5 mt-0.5 text-indigo-500" />
                <div>
                  <p className="font-medium">Just Rest Today</p>
                  <p className="text-xs text-muted-foreground">
                    {today?.progressionMode === 'completion' 
                      ? "Your next workout will still be the same planned workout."
                      : "Your schedule remains unchanged for tomorrow."}
                  </p>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setRestAdjustPlan("swap_next_rest")}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                restAdjustPlan === "swap_next_rest"
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted/50'
              }`}
              data-testid="rest-option-swap"
            >
              <div className="flex items-start gap-3">
                <ArrowLeftRight className="w-5 h-5 mt-0.5 text-indigo-500" />
                <div>
                  <p className="font-medium">Swap with Next Rest Day</p>
                  <p className="text-xs text-muted-foreground">
                    Today's workout moves to the next rest day slot. Recommended for maintaining balance.
                  </p>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setRestAdjustPlan("push_workout")}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                restAdjustPlan === "push_workout"
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted/50'
              }`}
              data-testid="rest-option-push"
            >
              <div className="flex items-start gap-3">
                <ArrowRight className="w-5 h-5 mt-0.5 text-indigo-500" />
                <div>
                  <p className="font-medium">Push Today's Workout</p>
                  <p className="text-xs text-muted-foreground">
                    Today's workout shifts later, other workouts pull earlier.
                  </p>
                </div>
              </div>
            </button>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setRestTodayDialogOpen(false);
              setRestAdjustPlan("none");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => restTodayMutation.mutate(restAdjustPlan)}
              disabled={restTodayMutation.isPending}
              data-testid="button-confirm-rest-today"
            >
              {restTodayMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Moon className="w-4 h-4 mr-2" />
              )}
              Confirm Rest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Train Anyway Dialog */}
      <Dialog open={trainAnywayDialogOpen} onOpenChange={setTrainAnywayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5" />
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
                <Swords className="w-4 h-4 mr-2" />
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

      {/* Do Another Workout / Reorder Dialog */}
      <Dialog open={reorderDialogOpen} onOpenChange={setReorderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isRestDayReorder ? (
                <>
                  <Swords className="w-5 h-5" />
                  Workout Today
                </>
              ) : (
                <>
                  <Shuffle className="w-5 h-5" />
                  Do a Different Workout
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isRestDayReorder 
                ? "Choose which workout you'd like to do today instead of resting."
                : "Choose which workout day you'd like to do today instead."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {reorderDays.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No other workout days available to switch to.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Workout Day</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {reorderDays.map((day: any) => (
                      <button
                        key={day.dayIndex}
                        type="button"
                        onClick={() => setSelectedReorderDay(day.dayIndex)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          selectedReorderDay === day.dayIndex
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        data-testid={`reorder-day-${day.dayIndex}`}
                      >
                        <p className="font-medium">{day.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {day.exercises?.slice(0, 3).join(', ')}{day.exercises?.length > 3 ? '...' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                
                {selectedReorderDay !== null && (
                  <div className="space-y-2">
                    <Label>Choose Action</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReorderAction("swap")}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          reorderAction === "swap"
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        data-testid="reorder-action-swap"
                      >
                        <ArrowLeftRight className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-sm font-medium">{isRestDayReorder ? "Swap Rest" : "Swap"}</p>
                        <p className="text-xs text-muted-foreground">
                          {isRestDayReorder ? "Rest moves to workout's slot" : "Exchange positions"}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReorderAction("push")}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          reorderAction === "push"
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        data-testid="reorder-action-push"
                      >
                        <ArrowRight className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-sm font-medium">{isRestDayReorder ? "Push Rest" : "Do First"}</p>
                        <p className="text-xs text-muted-foreground">
                          {isRestDayReorder ? "Rest moves later in schedule" : "Shifts others forward"}
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setReorderDialogOpen(false);
                setSelectedReorderDay(null);
                setIsRestDayReorder(false);
              }}
              data-testid="button-cancel-reorder"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedReorderDay !== null && today?.cycleId) {
                  reorderMutation.mutate({
                    cycleId: today.cycleId,
                    targetDayIndex: selectedReorderDay,
                    action: reorderAction,
                    isRestDayReorder
                  });
                }
              }}
              disabled={selectedReorderDay === null || reorderMutation.isPending}
              data-testid="button-confirm-reorder"
            >
              {reorderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Applying...
                </>
              ) : (
                "Apply Change"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CycleBuilderWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      <AIImportWizard open={aiImportOpen} onOpenChange={setAiImportOpen} />
    </div>
  );
}
