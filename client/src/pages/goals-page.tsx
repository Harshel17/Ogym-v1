import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { Target, Dumbbell, Flame, Beef, Calendar, ArrowLeft, Loader2, Check, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import type { UserGoal } from "@shared/schema";

const PRIMARY_GOALS = [
  { value: "lose_fat", label: "Lose Fat", description: "Reduce body fat percentage" },
  { value: "build_muscle", label: "Build Muscle", description: "Increase lean muscle mass" },
  { value: "maintain", label: "Maintain", description: "Keep current fitness level" },
  { value: "improve_endurance", label: "Improve Endurance", description: "Build stamina and cardio" },
  { value: "general_health", label: "General Health", description: "Overall wellness and longevity" },
] as const;

export default function GoalsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [targetWeight, setTargetWeight] = useState("");
  const [targetWeightUnit, setTargetWeightUnit] = useState<"kg" | "lbs">("kg");
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState("");
  const [dailyProteinTarget, setDailyProteinTarget] = useState("");
  const [weeklyWorkoutDays, setWeeklyWorkoutDays] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [customGoalText, setCustomGoalText] = useState("");

  const { data: goals, isLoading } = useQuery<UserGoal | null>({
    queryKey: ["/api/user/goals"],
  });

  useEffect(() => {
    if (goals) {
      setTargetWeight(goals.targetWeight || "");
      setTargetWeightUnit((goals.targetWeightUnit as "kg" | "lbs") || "kg");
      setDailyCalorieTarget(goals.dailyCalorieTarget?.toString() || "");
      setDailyProteinTarget(goals.dailyProteinTarget?.toString() || "");
      setWeeklyWorkoutDays(goals.weeklyWorkoutDays?.toString() || "");
      setPrimaryGoal(goals.primaryGoal || "");
      setCustomGoalText(goals.customGoalText || "");
    }
  }, [goals]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PUT", "/api/user/goals", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/goals"] });
      toast({ title: "Goals saved", description: "Your fitness goals have been updated." });
    },
    onError: () => {
      toast({ title: "Failed to save goals", variant: "destructive" });
    },
  });

  const handleSave = () => {
    const payload: Record<string, unknown> = {};

    if (targetWeight.trim()) {
      payload.targetWeight = targetWeight.trim();
      payload.targetWeightUnit = targetWeightUnit;
    } else {
      payload.targetWeight = null;
    }

    if (dailyCalorieTarget.trim()) {
      const val = parseInt(dailyCalorieTarget);
      if (!isNaN(val) && val >= 500 && val <= 10000) payload.dailyCalorieTarget = val;
    } else {
      payload.dailyCalorieTarget = null;
    }

    if (dailyProteinTarget.trim()) {
      const val = parseInt(dailyProteinTarget);
      if (!isNaN(val) && val >= 10 && val <= 500) payload.dailyProteinTarget = val;
    } else {
      payload.dailyProteinTarget = null;
    }

    if (weeklyWorkoutDays.trim()) {
      const val = parseInt(weeklyWorkoutDays);
      if (!isNaN(val) && val >= 1 && val <= 7) payload.weeklyWorkoutDays = val;
    } else {
      payload.weeklyWorkoutDays = null;
    }

    payload.primaryGoal = primaryGoal || null;
    payload.customGoalText = customGoalText.trim() || null;

    saveMutation.mutate(payload);
  };

  const hasAnyGoal = targetWeight.trim() || dailyCalorieTarget.trim() || dailyProteinTarget.trim() || weeklyWorkoutDays.trim() || primaryGoal || customGoalText.trim();

  const goalCount = [
    targetWeight.trim(),
    dailyCalorieTarget.trim(),
    dailyProteinTarget.trim(),
    weeklyWorkoutDays.trim(),
    primaryGoal,
    customGoalText.trim(),
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-goals-title">
            <Target className="h-6 w-6" />
            My Fitness Goals
          </h1>
          <p className="text-sm text-muted-foreground">
            Set any goals you want. All fields are optional.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5" />
            Primary Goal
          </CardTitle>
          <CardDescription>What's your main fitness focus right now?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRIMARY_GOALS.map((goal) => (
              <button
                key={goal.value}
                onClick={() => setPrimaryGoal(primaryGoal === goal.value ? "" : goal.value)}
                className={`text-left p-3 rounded-md border transition-colors ${
                  primaryGoal === goal.value
                    ? "border-primary bg-primary/10"
                    : "border-border hover-elevate"
                }`}
                data-testid={`button-goal-${goal.value}`}
              >
                <div className="font-medium text-sm">{goal.label}</div>
                <div className="text-xs text-muted-foreground">{goal.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Dumbbell className="h-5 w-5" />
            Workout Frequency
          </CardTitle>
          <CardDescription>How many days per week do you want to train?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <button
                key={day}
                onClick={() => setWeeklyWorkoutDays(weeklyWorkoutDays === day.toString() ? "" : day.toString())}
                className={`h-10 w-10 rounded-md border font-medium text-sm transition-colors ${
                  weeklyWorkoutDays === day.toString()
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover-elevate"
                }`}
                data-testid={`button-workout-day-${day}`}
              >
                {day}
              </button>
            ))}
            <span className="text-sm text-muted-foreground ml-1">days/week</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5" />
            Nutrition Targets
          </CardTitle>
          <CardDescription>Set daily calorie and protein goals</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="calories">Daily Calorie Target</Label>
            <div className="flex items-center gap-2">
              <Input
                id="calories"
                type="number"
                placeholder="e.g. 2000"
                value={dailyCalorieTarget}
                onChange={(e) => setDailyCalorieTarget(e.target.value)}
                min={500}
                max={10000}
                data-testid="input-calorie-target"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">kcal</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="protein">Daily Protein Target</Label>
            <div className="flex items-center gap-2">
              <Input
                id="protein"
                type="number"
                placeholder="e.g. 150"
                value={dailyProteinTarget}
                onChange={(e) => setDailyProteinTarget(e.target.value)}
                min={10}
                max={500}
                data-testid="input-protein-target"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">grams</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Weight Goal
          </CardTitle>
          <CardDescription>Set your target weight</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="e.g. 75"
              value={targetWeight}
              onChange={(e) => setTargetWeight(e.target.value)}
              className="max-w-[120px]"
              data-testid="input-target-weight"
            />
            <Select value={targetWeightUnit} onValueChange={(v) => setTargetWeightUnit(v as "kg" | "lbs")}>
              <SelectTrigger className="w-[80px]" data-testid="select-weight-unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">kg</SelectItem>
                <SelectItem value="lbs">lbs</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Beef className="h-5 w-5" />
            Custom Goal
          </CardTitle>
          <CardDescription>Anything else you're working toward?</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g. Run a 5K in under 25 minutes, do 20 pull-ups..."
            value={customGoalText}
            onChange={(e) => setCustomGoalText(e.target.value)}
            maxLength={500}
            className="resize-none"
            data-testid="input-custom-goal"
          />
          <p className="text-xs text-muted-foreground mt-1">{customGoalText.length}/500</p>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full"
          size="lg"
          data-testid="button-save-goals"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          {hasAnyGoal ? `Save ${goalCount} Goal${goalCount !== 1 ? "s" : ""}` : "Save Goals"}
        </Button>
      </div>
    </div>
  );
}
