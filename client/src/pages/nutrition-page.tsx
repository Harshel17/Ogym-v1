import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { 
  Flame, Apple, Beef, Wheat, Droplet, Plus, Search, Loader2, 
  ChevronLeft, ChevronRight, Trash2, ScanLine, Target, X, TrendingUp, Calendar, BarChart3, Watch,
  Droplets, Clock, Sparkles, Undo2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, subDays, isToday } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { FindMyFood } from "@/components/find-my-food";
import { useHealthStatus, useHealthDataToday } from "@/hooks/use-health-data";

type CalorieGoal = {
  id: number;
  userId: number;
  dailyCalorieTarget: number;
  dailyProteinTarget: number | null;
  dailyCarbsTarget: number | null;
  dailyFatTarget: number | null;
  goalType: string;
  isActive: boolean;
  createdAt: string;
  setBy?: string | null;
  setByUserId?: number | null;
};

type FoodLog = {
  id: number;
  userId: number;
  date: string;
  mealType: string;
  mealLabel: string | null;
  foodName: string;
  brandName: string | null;
  servingSize: string | null;
  quantity: number;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  barcode: string | null;
  createdAt: string;
};

type FoodProduct = {
  barcode: string;
  name: string;
  brandName: string | null;
  servingSize: string | null;
  nutrients: {
    calories: number;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
  };
  imageUrl: string | null;
};

type NutritionSummary = {
  summary: { calories: number; protein: number; carbs: number; fat: number };
  goal: CalorieGoal | null;
};

type AnalyticsData = {
  period: string;
  startDate: string;
  endDate: string;
  dailyData: { date: string; target: number; actual: number; protein: number; carbs: number; fat: number; proteinTarget?: number }[];
  summary: {
    avgProtein: number;
    totalProtein: number;
    proteinTarget: number;
    proteinAdherencePercent: number;
    daysWithProtein: number;
    avgCalories: number;
    totalCalories: number;
    targetTotal: number;
    adherencePercent: number;
    daysLogged: number;
    dailyTarget: number;
  };
  goal: CalorieGoal | null;
};

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const ALL_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "protein", "extra"] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch", 
  dinner: "Dinner",
  snack: "Snack",
  protein: "Protein",
  extra: "Extra Meal"
};

export default function NutritionPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [addFoodStep, setAddFoodStep] = useState<"category" | "food">("category");
  const [selectedMealType, setSelectedMealType] = useState<string>("breakfast");
  const [extraMealLabel, setExtraMealLabel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [manualEntry, setManualEntry] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const [showScanner, setShowScanner] = useState(false);
  const [isScanLookup, setIsScanLookup] = useState(false);
  const [foodMode, setFoodMode] = useState<"search" | "recent">("search");

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: summaryData, isLoading: summaryLoading } = useQuery<NutritionSummary>({
    queryKey: ["/api/nutrition/summary", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/summary?date=${dateStr}`);
      return res.json();
    }
  });

  const { data: foodLogs = [], isLoading: logsLoading } = useQuery<FoodLog[]>({
    queryKey: ["/api/nutrition/logs", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/logs?date=${dateStr}`);
      return res.json();
    }
  });

  const { data: goal } = useQuery<CalorieGoal | null>({
    queryKey: ["/api/nutrition/goal"]
  });

  const { data: healthStatus } = useHealthStatus();
  const { data: healthData } = useHealthDataToday();

  const { data: waterData, isLoading: waterLoading } = useQuery<{ logs: any[], totalOz: number, totalCups: number }>({
    queryKey: ["/api/nutrition/water", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/water?date=${dateStr}`);
      return res.json();
    }
  });

  const { data: recentFoods = [] } = useQuery<any[]>({
    queryKey: ["/api/nutrition/recent"],
    queryFn: async () => {
      const res = await fetch("/api/nutrition/recent");
      return res.json();
    }
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/nutrition/goal", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/goal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/summary", dateStr] });
      toast({ title: "Goal saved!" });
      setIsGoalDialogOpen(false);
    }
  });

  const logFoodMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/nutrition/logs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/logs", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/summary", dateStr] });
      toast({ title: "Food logged!" });
      setIsAddFoodOpen(false);
      resetAddFood();
    }
  });

  const deleteFoodMutation = useMutation({
    mutationFn: async (logId: number) => {
      await apiRequest("DELETE", `/api/nutrition/logs/${logId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/logs", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/summary", dateStr] });
      toast({ title: "Food removed" });
    }
  });

  const addWaterMutation = useMutation({
    mutationFn: async (amountOz: number) => {
      const res = await apiRequest("POST", "/api/nutrition/water", { date: dateStr, amountOz });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/water", dateStr] });
      toast({ title: "Water logged!" });
    }
  });

  const deleteWaterMutation = useMutation({
    mutationFn: async (logId: number) => {
      await apiRequest("DELETE", `/api/nutrition/water/${logId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/water", dateStr] });
      toast({ title: "Water entry removed" });
    }
  });

  const resetAddFood = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedFood(null);
    setQuantity("1");
    setManualEntry({ name: "", calories: "", protein: "", carbs: "", fat: "" });
    setAddFoodStep("category");
    setExtraMealLabel("");
    setFoodMode("search");
  };

  const openAddFoodForMeal = (mealType: string) => {
    setSelectedMealType(mealType);
    setAddFoodStep("food");
    setIsAddFoodOpen(true);
  };

  const openGlobalAddFood = () => {
    setAddFoodStep("category");
    setIsAddFoodOpen(true);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedMealType(category);
    if (category !== "extra") {
      setAddFoodStep("food");
    }
  };

  const handleExtraMealConfirm = () => {
    if (!extraMealLabel.trim()) {
      toast({ title: "Please enter a meal name", variant: "destructive" });
      return;
    }
    setAddFoodStep("food");
  };

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/nutrition/food/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.products || []);
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    }
    setIsSearching(false);
  };

  const handleLogSelectedFood = () => {
    if (!selectedFood) return;
    const qty = parseFloat(quantity) || 1;
    logFoodMutation.mutate({
      date: dateStr,
      mealType: selectedMealType,
      mealLabel: selectedMealType === "extra" ? extraMealLabel.trim() : null,
      foodName: selectedFood.name,
      brandName: selectedFood.brandName,
      servingSize: selectedFood.servingSize,
      quantity: qty,
      calories: Math.round(selectedFood.nutrients.calories * qty),
      protein: selectedFood.nutrients.protein ? Math.round(selectedFood.nutrients.protein * qty) : null,
      carbs: selectedFood.nutrients.carbs ? Math.round(selectedFood.nutrients.carbs * qty) : null,
      fat: selectedFood.nutrients.fat ? Math.round(selectedFood.nutrients.fat * qty) : null,
      barcode: selectedFood.barcode || null
    });
  };

  const handleLogManual = () => {
    if (selectedMealType === "protein") {
      if (!manualEntry.name || !manualEntry.protein) {
        toast({ title: "Name and protein grams are required", variant: "destructive" });
        return;
      }
    } else {
      if (!manualEntry.name || !manualEntry.calories) {
        toast({ title: "Name and calories are required", variant: "destructive" });
        return;
      }
    }
    logFoodMutation.mutate({
      date: dateStr,
      mealType: selectedMealType,
      mealLabel: selectedMealType === "extra" ? extraMealLabel.trim() : null,
      foodName: manualEntry.name,
      quantity: 1,
      calories: parseInt(manualEntry.calories) || 0,
      protein: manualEntry.protein ? parseInt(manualEntry.protein) : null,
      carbs: manualEntry.carbs ? parseInt(manualEntry.carbs) : null,
      fat: manualEntry.fat ? parseInt(manualEntry.fat) : null
    });
  };

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    setIsScanLookup(true);
    try {
      const res = await fetch(`/api/nutrition/food/barcode/${barcode}`);
      if (res.ok) {
        const product = await res.json();
        setSelectedFood(product);
        setIsAddFoodOpen(true);
      } else {
        toast({ title: "Product not found", description: "Try searching manually instead", variant: "destructive" });
        setIsAddFoodOpen(true);
      }
    } catch {
      toast({ title: "Lookup failed", variant: "destructive" });
    }
    setIsScanLookup(false);
  };

  const summary = summaryData?.summary || { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const goalData = summaryData?.goal || goal;

  const calorieGoal = goalData?.dailyCalorieTarget || 2000;
  const proteinGoal = goalData?.dailyProteinTarget || 120;
  const carbsGoal = goalData?.dailyCarbsTarget || 250;
  const fatGoal = goalData?.dailyFatTarget || 65;

  const caloriePercent = Math.min((summary.calories / calorieGoal) * 100, 100);
  const proteinPercent = Math.min((summary.protein / proteinGoal) * 100, 100);
  const carbsPercent = Math.min((summary.carbs / carbsGoal) * 100, 100);
  const fatPercent = Math.min((summary.fat / fatGoal) * 100, 100);

  const remaining = calorieGoal - summary.calories;

  const groupedLogs = MEAL_TYPES.reduce((acc, meal) => {
    acc[meal] = foodLogs.filter(log => log.mealType === meal);
    return acc;
  }, {} as Record<string, FoodLog[]>);

  const proteinLogs = foodLogs.filter(log => log.mealType === "protein");
  const extraLogs = foodLogs.filter(log => log.mealType === "extra");
  
  const extraMealsByLabel = extraLogs.reduce((acc, log) => {
    const label = log.mealLabel || "Extra";
    if (!acc[label]) acc[label] = [];
    acc[label].push(log);
    return acc;
  }, {} as Record<string, FoodLog[]>);

  const totalProteinToday = foodLogs.reduce((sum, log) => sum + (log.protein || 0), 0);

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 space-y-4 sm:space-y-6 pb-24">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Nutrition</h1>
        <div className="flex items-center gap-2">
          <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-set-goal">
                <Target className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Set Goal</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Set Daily Goals</DialogTitle>
            </DialogHeader>
            <GoalForm 
              currentGoal={goalData}
              onSubmit={(data) => createGoalMutation.mutate(data)}
              isPending={createGoalMutation.isPending}
            />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            data-testid="button-prev-day"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <span className="text-sm sm:text-lg font-medium min-w-[140px] sm:min-w-[160px] text-center">
            {format(selectedDate, "EEE, MMM d, yyyy")}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            data-testid="button-next-day"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const input = document.getElementById('nutrition-date-picker') as HTMLInputElement;
                input?.showPicker?.();
                input?.click();
              }}
              data-testid="button-calendar-picker"
            >
              <Calendar className="w-4 h-4" />
            </Button>
            <input
              id="nutrition-date-picker"
              type="date"
              value={dateStr}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => {
                if (e.target.value) {
                  const [year, month, day] = e.target.value.split('-').map(Number);
                  setSelectedDate(new Date(year, month - 1, day));
                }
              }}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              data-testid="input-date-picker"
            />
          </div>
        </div>
        {!isToday(selectedDate) && (
          <button
            onClick={() => setSelectedDate(new Date())}
            className="text-xs text-blue-500 dark:text-blue-400 font-medium hover:underline"
            data-testid="button-go-to-today"
          >
            Go to Today
          </button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex items-center justify-between mb-4 gap-2">
            <div className="text-center flex-1">
              <div className="text-2xl sm:text-3xl font-bold">{summary.calories}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Eaten</div>
            </div>
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48" cy="48" r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted"
                />
                <circle
                  cx="48" cy="48" r="42"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(caloriePercent / 100) * 264} 264`}
                  className={remaining >= 0 ? "text-primary" : "text-destructive"}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              </div>
            </div>
            <div className="text-center flex-1">
              <div className={`text-2xl sm:text-3xl font-bold ${remaining < 0 ? "text-destructive" : ""}`}>
                {Math.abs(remaining)}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                {remaining >= 0 ? "Remaining" : "Over"}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mt-3 py-2 px-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <Beef className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium">
              Protein: <span className="text-red-500">{totalProteinToday}g</span>
              {goalData?.dailyProteinTarget && (
                <span className="text-muted-foreground"> / {proteinGoal}g</span>
              )}
            </span>
          </div>

          {healthStatus?.connected && healthData?.caloriesBurned && (
            <div className="flex items-center justify-center gap-2 mt-2 py-2 px-3 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 rounded-lg">
              <Watch className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">
                Burned: <span className="text-orange-500">{healthData.caloriesBurned.toLocaleString()} cal</span>
                <span className="text-muted-foreground ml-1">
                  (Net: {(summary.calories - healthData.caloriesBurned).toLocaleString()} cal)
                </span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6">
            <MacroProgress label="Protein" value={summary.protein} goal={proteinGoal} percent={proteinPercent} icon={Beef} color="text-red-500" />
            <MacroProgress label="Carbs" value={summary.carbs} goal={carbsGoal} percent={carbsPercent} icon={Wheat} color="text-amber-500" />
            <MacroProgress label="Fat" value={summary.fat} goal={fatGoal} percent={fatPercent} icon={Droplet} color="text-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={openGlobalAddFood}
        className="w-full"
        size="lg"
        data-testid="button-global-add-food"
      >
        <Plus className="w-5 h-5 mr-2" />
        Add Food
      </Button>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-blue-500" />
              <span className="font-semibold">Water</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {waterData?.totalOz || 0}oz / 64oz
            </span>
          </div>
          <Progress value={Math.min(((waterData?.totalOz || 0) / 64) * 100, 100)} className="h-2 mb-3" />
          <div className="flex items-center gap-2 flex-wrap">
            {[{ oz: 8, label: "8oz" }, { oz: 12, label: "12oz" }, { oz: 16, label: "16oz" }, { oz: 24, label: "24oz" }].map(({ oz, label }) => (
              <Button
                key={oz}
                variant="outline"
                size="sm"
                onClick={() => addWaterMutation.mutate(oz)}
                disabled={addWaterMutation.isPending}
                data-testid={`button-add-water-${oz}`}
              >
                <Plus className="w-3 h-3 mr-1" />
                {label}
              </Button>
            ))}
            {waterData?.logs && waterData.logs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground"
                onClick={() => {
                  const lastLog = waterData.logs[waterData.logs.length - 1];
                  if (lastLog) deleteWaterMutation.mutate(lastLog.id);
                }}
                disabled={deleteWaterMutation.isPending}
                data-testid="button-undo-water"
              >
                <Undo2 className="w-3 h-3 mr-1" />
                Undo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <FindMyFood 
        remainingCalories={remaining}
        goalType={(goalData?.goalType as 'lose' | 'maintain' | 'gain') || 'maintain'}
        onLogFood={(foodName, calories) => {
          setSearchQuery(foodName);
          setSelectedMealType('lunch');
          setIsAddFoodOpen(true);
        }}
      />

      {MEAL_TYPES.map((meal) => (
        <Card key={meal}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{MEAL_LABELS[meal]}</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => openAddFoodForMeal(meal)}
                data-testid={`button-add-${meal}`}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {groupedLogs[meal].length === 0 ? (
              <p className="text-sm text-muted-foreground">No food logged</p>
            ) : (
              <div className="space-y-2">
                {groupedLogs[meal].map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{log.foodName}</p>
                      <p className="text-sm text-muted-foreground">
                        {log.quantity > 1 && `${log.quantity}x `}
                        {log.servingSize || "1 serving"}
                        {log.brandName && ` · ${log.brandName}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{log.calories} cal</span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => deleteFoodMutation.mutate(log.id)}
                        data-testid={`button-delete-food-${log.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Beef className="w-5 h-5 text-red-500" />
              Protein
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => openAddFoodForMeal("protein")}
              data-testid="button-add-protein"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Track shakes, bars & supplements</p>
        </CardHeader>
        <CardContent>
          {proteinLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No protein logged</p>
          ) : (
            <div className="space-y-2">
              {proteinLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{log.foodName}</p>
                    <p className="text-sm text-muted-foreground">
                      {log.protein}g protein
                      {log.calories ? ` · ${log.calories} cal` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-red-500">{log.protein}g</span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteFoodMutation.mutate(log.id)}
                      data-testid={`button-delete-protein-${log.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(extraMealsByLabel).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Extra Meals</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(extraMealsByLabel).map(([label, logs]) => (
              <div key={label} className="mb-4 last:mb-0">
                <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{log.foodName}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.quantity > 1 && `${log.quantity}x `}
                          {log.servingSize || "1 serving"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{log.calories} cal</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => deleteFoodMutation.mutate(log.id)}
                          data-testid={`button-delete-extra-${log.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={isAddFoodOpen} onOpenChange={(open) => { setIsAddFoodOpen(open); if (!open) resetAddFood(); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {addFoodStep === "category" ? "Add Food" : `Add to ${selectedMealType === "extra" ? extraMealLabel || "Extra Meal" : MEAL_LABELS[selectedMealType]}`}
            </DialogTitle>
          </DialogHeader>
          
          {addFoodStep === "category" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose a category:</p>
              <div className="grid grid-cols-2 gap-2">
                {["breakfast", "lunch", "dinner", "snack"].map((cat) => (
                  <Button
                    key={cat}
                    variant="outline"
                    size="lg"
                    className="justify-start"
                    onClick={() => handleCategorySelect(cat)}
                    data-testid={`button-category-${cat}`}
                  >
                    {MEAL_LABELS[cat]}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start border-red-200 dark:border-red-900"
                  onClick={() => handleCategorySelect("protein")}
                  data-testid="button-category-protein"
                >
                  <Beef className="w-4 h-4 mr-2 text-red-500" />
                  Protein
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start"
                  onClick={() => handleCategorySelect("extra")}
                  data-testid="button-category-extra"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Extra Meal
                </Button>
              </div>
              
              {selectedMealType === "extra" && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Meal Name</Label>
                  <Input
                    placeholder="e.g., Post Workout, Late Night..."
                    value={extraMealLabel}
                    onChange={(e) => setExtraMealLabel(e.target.value)}
                    data-testid="input-extra-meal-label"
                  />
                  <Button 
                    onClick={handleExtraMealConfirm} 
                    className="w-full"
                    data-testid="button-confirm-extra-meal"
                  >
                    Continue
                  </Button>
                </div>
              )}
            </div>
          ) : !selectedFood ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex gap-1 mb-3">
                <Button
                  variant={foodMode === "search" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFoodMode("search")}
                  data-testid="button-food-mode-search"
                >
                  <Search className="w-3 h-3 mr-1" />
                  Search
                </Button>
                <Button
                  variant={foodMode === "recent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFoodMode("recent")}
                  data-testid="button-food-mode-recent"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Recent
                </Button>
              </div>

              {foodMode === "recent" ? (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {recentFoods.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent foods yet</p>
                  ) : (
                    recentFoods.map((food: any, i: number) => (
                      <button
                        key={`recent-${i}`}
                        onClick={() => {
                          logFoodMutation.mutate({
                            date: dateStr,
                            mealType: selectedMealType,
                            mealLabel: selectedMealType === "extra" ? extraMealLabel.trim() : null,
                            foodName: food.foodName || food.food_name,
                            brandName: food.brandName || food.brand_name,
                            servingSize: food.servingSize || food.serving_size,
                            quantity: 1,
                            calories: food.calories,
                            protein: food.protein || null,
                            carbs: food.carbs || null,
                            fat: food.fat || null,
                            barcode: food.barcode || null,
                          });
                        }}
                        className="w-full px-3 py-2.5 text-left hover-elevate flex items-center justify-between gap-2 rounded-md border"
                        data-testid={`button-recent-food-${i}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{food.foodName || food.food_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {food.servingSize || food.serving_size || "1 serving"}
                            {(food.brandName || food.brand_name) && ` · ${food.brandName || food.brand_name}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-sm">{food.calories}</p>
                          <p className="text-xs text-muted-foreground">cal</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
              <>
              <div className="flex gap-2">
                <Input
                  placeholder="Search foods (e.g., chicken breast, Big Mac)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="text-base"
                  data-testid="input-food-search"
                />
                <Button onClick={handleSearch} disabled={isSearching} size="icon" data-testid="button-search-food">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="outline"
                  size="icon"
                  onClick={() => { setIsAddFoodOpen(false); setShowScanner(true); }}
                  disabled={isScanLookup}
                  data-testid="button-scan-barcode"
                >
                  {isScanLookup ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-[220px] sm:max-h-[300px] overflow-y-auto rounded-lg border bg-card">
                  {searchResults.map((product, index) => (
                    <button
                      key={product.barcode}
                      onClick={() => setSelectedFood(product)}
                      className={`w-full px-3 py-2.5 text-left hover-elevate flex items-center justify-between gap-2 ${index !== searchResults.length - 1 ? 'border-b' : ''}`}
                      data-testid={`button-select-food-${product.barcode}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm sm:text-base">{product.name}</p>
                          {product.barcode?.startsWith('local-') && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">MENU</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {product.servingSize || "1 serving"}
                          {product.brandName && ` · ${product.brandName}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">{product.nutrients.calories}</p>
                        <p className="text-xs text-muted-foreground">cal</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                <div className="text-center py-3">
                  <p className="text-sm text-muted-foreground mb-2">No results found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setIsSearching(true);
                      try {
                        const res = await fetch("/api/nutrition/food/estimate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ description: searchQuery }),
                        });
                        if (res.ok) {
                          const estimated = await res.json();
                          setSelectedFood(estimated);
                        } else {
                          toast({ title: "Could not estimate nutrition", variant: "destructive" });
                        }
                      } catch {
                        toast({ title: "Estimation failed", variant: "destructive" });
                      }
                      setIsSearching(false);
                    }}
                    data-testid="button-ai-estimate"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Estimate with AI
                  </Button>
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">
                  {selectedMealType === "protein" ? "Add protein item:" : "Or add manually:"}
                </p>
                <div className="space-y-3">
                  <Input
                    placeholder={selectedMealType === "protein" ? "Item name (e.g., Whey Protein)" : "Food name"}
                    value={manualEntry.name}
                    onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                    data-testid="input-manual-name"
                  />
                  {selectedMealType === "protein" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Protein (g) *"
                        type="number"
                        value={manualEntry.protein}
                        onChange={(e) => setManualEntry({ ...manualEntry, protein: e.target.value })}
                        data-testid="input-manual-protein"
                      />
                      <Input
                        placeholder="Calories (optional)"
                        type="number"
                        value={manualEntry.calories}
                        onChange={(e) => setManualEntry({ ...manualEntry, calories: e.target.value })}
                        data-testid="input-manual-calories"
                      />
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Calories *"
                      type="number"
                      value={manualEntry.calories}
                      onChange={(e) => setManualEntry({ ...manualEntry, calories: e.target.value })}
                      data-testid="input-manual-calories"
                    />
                    <Input
                      placeholder="Protein (g)"
                      type="number"
                      value={manualEntry.protein}
                      onChange={(e) => setManualEntry({ ...manualEntry, protein: e.target.value })}
                      data-testid="input-manual-protein"
                    />
                    <Input
                      placeholder="Carbs (g)"
                      type="number"
                      value={manualEntry.carbs}
                      onChange={(e) => setManualEntry({ ...manualEntry, carbs: e.target.value })}
                      data-testid="input-manual-carbs"
                    />
                    <Input
                      placeholder="Fat (g)"
                      type="number"
                      value={manualEntry.fat}
                      onChange={(e) => setManualEntry({ ...manualEntry, fat: e.target.value })}
                      data-testid="input-manual-fat"
                    />
                  </div>
                  )}
                  <Button 
                    onClick={handleLogManual} 
                    disabled={logFoodMutation.isPending}
                    className="w-full"
                    data-testid="button-log-manual"
                  >
                    {logFoodMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedMealType === "protein" ? "Add Protein" : "Add Food"}
                  </Button>
                </div>
              </div>
              </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                {selectedFood.imageUrl && (
                  <img src={selectedFood.imageUrl} alt="" className="w-16 h-16 object-contain rounded" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {selectedFood.name}
                    {(selectedFood as any).isEstimate && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium ml-2">AI Estimate</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{selectedFood.brandName}</p>
                  <p className="text-sm mt-1">
                    Per {selectedFood.servingSize || "100g"}: {selectedFood.nutrients.calories} cal
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedFood(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div>
                <Label>Quantity (servings)</Label>
                <Input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-quantity"
                />
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round(selectedFood.nutrients.calories * (parseFloat(quantity) || 1))}</div>
                  <div className="text-muted-foreground">Cal</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.protein || 0) * (parseFloat(quantity) || 1))}g</div>
                  <div className="text-muted-foreground">Protein</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.carbs || 0) * (parseFloat(quantity) || 1))}g</div>
                  <div className="text-muted-foreground">Carbs</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.fat || 0) * (parseFloat(quantity) || 1))}g</div>
                  <div className="text-muted-foreground">Fat</div>
                </div>
              </div>

              <Button 
                onClick={handleLogSelectedFood} 
                disabled={logFoodMutation.isPending}
                className="w-full"
                data-testid="button-log-food"
              >
                {logFoodMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log Food"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      <CalorieAnalytics />
      
      <ProteinAnalytics />
    </div>
  );
}

function CalorieAnalytics() {
  const [period, setPeriod] = useState<"week" | "month">("week");

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/nutrition/analytics", period],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/analytics?period=${period}`);
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || !analytics.dailyData) return null;

  const chartData = analytics.dailyData.map(d => ({
    date: format(new Date(d.date), period === "week" ? "EEE" : "MMM d"),
    actual: d.actual,
    target: d.target,
  }));

  const adherenceColor = analytics.summary.adherencePercent >= 90 ? "text-green-500" : 
                         analytics.summary.adherencePercent >= 70 ? "text-yellow-500" : "text-red-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Calorie Analytics
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              variant={period === "week" ? "default" : "outline"} 
              size="sm"
              onClick={() => setPeriod("week")}
              data-testid="button-analytics-week"
            >
              Week
            </Button>
            <Button 
              variant={period === "month" ? "default" : "outline"} 
              size="sm"
              onClick={() => setPeriod("month")}
              data-testid="button-analytics-month"
            >
              Month
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="text-center p-2 sm:p-3 bg-muted rounded-lg">
            <div className="text-lg sm:text-xl font-bold">{analytics.summary.avgCalories}</div>
            <div className="text-xs text-muted-foreground">Avg Daily</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-muted rounded-lg">
            <div className={`text-lg sm:text-xl font-bold ${adherenceColor}`}>
              {analytics.summary.adherencePercent}%
            </div>
            <div className="text-xs text-muted-foreground">Adherence</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-muted rounded-lg">
            <div className="text-lg sm:text-xl font-bold">{analytics.summary.daysLogged}</div>
            <div className="text-xs text-muted-foreground">Days Logged</div>
          </div>
        </div>

        {analytics.goal && (
          <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Daily Target: <span className="font-medium text-foreground">{analytics.summary.dailyTarget} cal</span>
            {analytics.goal.setBy === "trainer" && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Set by Trainer</span>
            )}
          </div>
        )}

        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="15%">
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                interval={period === "month" ? 4 : 0}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                width={40}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [`${value} cal`, name === "target" ? "Target" : "Actual"]}
                labelFormatter={(label) => `${label}`}
              />
              <Legend 
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => value === "target" ? "Target" : "Actual"}
              />
              <Bar 
                dataKey="target" 
                fill="hsl(var(--muted-foreground))" 
                radius={[4, 4, 0, 0]}
                name="target"
                opacity={0.4}
              />
              <Bar 
                dataKey="actual" 
                fill="hsl(var(--chart-1))" 
                radius={[4, 4, 0, 0]}
                name="actual"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 text-xs text-muted-foreground text-center">
          {period === "week" ? "Last 7 days" : "Last 30 days"} • Total: {analytics.summary.totalCalories.toLocaleString()} cal
        </div>
      </CardContent>
    </Card>
  );
}

function ProteinAnalytics() {
  const [period, setPeriod] = useState<"week" | "month">("week");

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/nutrition/analytics", period],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/analytics?period=${period}`);
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || !analytics.dailyData) return null;

  const chartData = analytics.dailyData.map(d => ({
    date: format(new Date(d.date), period === "week" ? "EEE" : "MMM d"),
    actual: d.protein,
    target: analytics.summary.proteinTarget,
  }));

  const adherenceColor = analytics.summary.proteinAdherencePercent >= 90 ? "text-green-500" : 
                         analytics.summary.proteinAdherencePercent >= 70 ? "text-yellow-500" : "text-red-500";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Beef className="w-5 h-5 text-red-500" />
            Protein Analytics
          </CardTitle>
          <div className="flex gap-1">
            <Button 
              variant={period === "week" ? "default" : "outline"} 
              size="sm"
              onClick={() => setPeriod("week")}
              data-testid="button-protein-analytics-week"
            >
              Week
            </Button>
            <Button 
              variant={period === "month" ? "default" : "outline"} 
              size="sm"
              onClick={() => setPeriod("month")}
              data-testid="button-protein-analytics-month"
            >
              Month
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="text-center p-2 sm:p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <div className="text-lg sm:text-xl font-bold text-red-600 dark:text-red-400">{analytics.summary.avgProtein}g</div>
            <div className="text-xs text-muted-foreground">Avg Daily</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-muted rounded-lg">
            <div className={`text-lg sm:text-xl font-bold ${adherenceColor}`}>
              {analytics.summary.proteinAdherencePercent}%
            </div>
            <div className="text-xs text-muted-foreground">Adherence</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-muted rounded-lg">
            <div className="text-lg sm:text-xl font-bold">{analytics.summary.daysWithProtein}</div>
            <div className="text-xs text-muted-foreground">Days Logged</div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Daily Target: <span className="font-medium text-red-600 dark:text-red-400">{analytics.summary.proteinTarget}g</span>
        </div>

        <div className="h-48 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="15%">
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                interval={period === "month" ? 4 : 0}
              />
              <YAxis 
                tick={{ fontSize: 11 }}
                width={40}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [`${value}g`, name === "target" ? "Target" : "Actual"]}
                labelFormatter={(label) => `${label}`}
              />
              <Legend 
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => value === "target" ? "Target" : "Actual"}
              />
              <Bar 
                dataKey="target" 
                fill="hsl(var(--muted-foreground))" 
                radius={[4, 4, 0, 0]}
                name="target"
                opacity={0.4}
              />
              <Bar 
                dataKey="actual" 
                fill="#ef4444" 
                radius={[4, 4, 0, 0]}
                name="actual"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 text-xs text-muted-foreground text-center">
          {period === "week" ? "Last 7 days" : "Last 30 days"} • Total: {analytics.summary.totalProtein.toLocaleString()}g protein
        </div>
      </CardContent>
    </Card>
  );
}

function MacroProgress({ label, value, goal, percent, icon: Icon, color }: { 
  label: string; 
  value: number; 
  goal: number; 
  percent: number; 
  icon: any; 
  color: string;
}) {
  return (
    <div className="text-center">
      <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 ${color}`} />
      <Progress value={percent} className="h-1.5 sm:h-2 mb-1" />
      <div className="text-xs sm:text-sm font-medium">{value}g</div>
      <div className="text-xs text-muted-foreground">/ {goal}g</div>
    </div>
  );
}

function GoalForm({ currentGoal, onSubmit, isPending }: { 
  currentGoal: CalorieGoal | null | undefined; 
  onSubmit: (data: any) => void; 
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    dailyCalories: currentGoal?.dailyCalorieTarget?.toString() || "2000",
    dailyProtein: currentGoal?.dailyProteinTarget?.toString() || "120",
    dailyCarbs: currentGoal?.dailyCarbsTarget?.toString() || "250",
    dailyFat: currentGoal?.dailyFatTarget?.toString() || "65",
    goalType: currentGoal?.goalType || "maintain"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      dailyCalorieTarget: parseInt(formData.dailyCalories),
      dailyProteinTarget: formData.dailyProtein ? parseInt(formData.dailyProtein) : null,
      dailyCarbsTarget: formData.dailyCarbs ? parseInt(formData.dailyCarbs) : null,
      dailyFatTarget: formData.dailyFat ? parseInt(formData.dailyFat) : null,
      goalType: formData.goalType
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Goal Type</Label>
        <Select value={formData.goalType} onValueChange={(v) => setFormData({ ...formData, goalType: v })}>
          <SelectTrigger data-testid="select-goal-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lose">Lose Weight</SelectItem>
            <SelectItem value="maintain">Maintain Weight</SelectItem>
            <SelectItem value="gain">Gain Weight</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Daily Calories</Label>
        <Input
          type="number"
          value={formData.dailyCalories}
          onChange={(e) => setFormData({ ...formData, dailyCalories: e.target.value })}
          data-testid="input-goal-calories"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Protein (g)</Label>
          <Input
            type="number"
            value={formData.dailyProtein}
            onChange={(e) => setFormData({ ...formData, dailyProtein: e.target.value })}
            data-testid="input-goal-protein"
          />
        </div>
        <div>
          <Label>Carbs (g)</Label>
          <Input
            type="number"
            value={formData.dailyCarbs}
            onChange={(e) => setFormData({ ...formData, dailyCarbs: e.target.value })}
            data-testid="input-goal-carbs"
          />
        </div>
        <div>
          <Label>Fat (g)</Label>
          <Input
            type="number"
            value={formData.dailyFat}
            onChange={(e) => setFormData({ ...formData, dailyFat: e.target.value })}
            data-testid="input-goal-fat"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending} data-testid="button-save-goal">
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Goals"}
      </Button>
    </form>
  );
}
