import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { 
  Flame, Apple, Beef, Wheat, Droplet, Plus, Search, Loader2, 
  ChevronLeft, ChevronRight, Trash2, ScanLine, Target, X, TrendingUp, Calendar, BarChart3, Watch,
  Droplets, Clock, Sparkles, Undo2, Zap, CheckCircle2, AlertTriangle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, subDays, isToday } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend, Area, AreaChart, CartesianGrid } from "recharts";
import { FindMyFood } from "@/components/find-my-food";
import { useHealthStatus, useHealthDataToday } from "@/hooks/use-health-data";
import { fuzzyMatchRestaurants, getRecentRestaurants, addRecentRestaurant } from "@/lib/restaurant-data";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

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
  isEstimate: boolean | null;
  sourceType: string | null;
  createdAt: string;
};

type FoodModifier = {
  label: string;
  calorieDelta: number;
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
  isEstimate?: boolean;
  isRestaurantItem?: boolean;
  sourceType?: 'branded_database' | 'generic_database' | 'curated_database' | 'ai_estimated';
  commonModifiers?: FoodModifier[];
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
  const [manualEntry, setManualEntry] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", restaurant: "" });
  const [showScanner, setShowScanner] = useState(false);
  const [isScanLookup, setIsScanLookup] = useState(false);
  const [foodMode, setFoodMode] = useState<"search" | "recent">("search");
  const [restaurantName, setRestaurantName] = useState("");
  const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false);
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<Array<{ name: string; category: string }>>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<number>>(new Set());

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchQuery.length < 2) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      handleSearch();
    }, 500);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, restaurantName]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const { data: pageData, isLoading: pageDataLoading } = useQuery<{
    logs: FoodLog[];
    summary: { calories: number; protein: number; carbs: number; fat: number };
    goal: CalorieGoal | null;
    water: { logs: any[]; totalOz: number; totalCups: number };
    recent: any[];
  }>({
    queryKey: ["/api/nutrition/page-data", dateStr],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/page-data?date=${dateStr}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  const summaryData = pageData ? { summary: pageData.summary, goal: pageData.goal } as NutritionSummary : undefined;
  const summaryLoading = pageDataLoading;
  const foodLogs = pageData?.logs || [];
  const logsLoading = pageDataLoading;
  const goal = pageData?.goal || null;
  const waterData = pageData?.water;
  const waterLoading = pageDataLoading;
  const recentFoods = pageData?.recent || [];

  const { data: healthStatus } = useHealthStatus();
  const { data: healthData } = useHealthDataToday();

  const createGoalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/nutrition/goal", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/page-data", dateStr] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/page-data", dateStr] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/page-data", dateStr] });
      toast({ title: "Food removed" });
    }
  });

  const addWaterMutation = useMutation({
    mutationFn: async (amountOz: number) => {
      const res = await apiRequest("POST", "/api/nutrition/water", { date: dateStr, amountOz });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/page-data", dateStr] });
      toast({ title: "Water logged!" });
    }
  });

  const deleteWaterMutation = useMutation({
    mutationFn: async (logId: number) => {
      await apiRequest("DELETE", `/api/nutrition/water/${logId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/page-data", dateStr] });
      toast({ title: "Water entry removed" });
    }
  });

  const resetAddFood = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedFood(null);
    setQuantity("1");
    setScanNotFound(null);
    setManualEntry({ name: "", calories: "", protein: "", carbs: "", fat: "", restaurant: "" });
    setAddFoodStep("category");
    setExtraMealLabel("");
    setFoodMode("search");
    setRestaurantName("");
    setSelectedModifiers(new Set());
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
      if (restaurantName.trim()) {
        const res = await fetch("/api/nutrition/food/restaurant-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restaurant: restaurantName.trim(), query: searchQuery }),
        });
        const data = await res.json();
        setSearchResults(data.products || []);
      } else {
        const res = await fetch(`/api/nutrition/food/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.products || []);
      }
    } catch {
      toast({ title: "Search failed", variant: "destructive" });
    }
    setIsSearching(false);
  };

  const handleLogSelectedFood = () => {
    if (!selectedFood) return;
    const qty = parseFloat(quantity) || 1;
    if (restaurantName.trim()) {
      addRecentRestaurant(restaurantName.trim());
    }
    const modCalories = selectedFood.commonModifiers 
      ? Array.from(selectedModifiers).reduce((sum, idx) => sum + (selectedFood.commonModifiers![idx]?.calorieDelta || 0), 0)
      : 0;
    const modLabels = selectedFood.commonModifiers 
      ? Array.from(selectedModifiers).map(idx => selectedFood.commonModifiers![idx]?.label).filter(Boolean)
      : [];
    const foodNameWithMods = modLabels.length > 0 
      ? `${selectedFood.name} (${modLabels.join(', ')})`
      : selectedFood.name;
    const st = selectedFood.sourceType;
    const baseVerified = st === 'branded_database' || st === 'curated_database';
    const hasModifiers = selectedModifiers.size > 0;
    const finalIsEstimate = !baseVerified || hasModifiers;
    const finalSourceType = st || 'ai_estimated';

    logFoodMutation.mutate({
      date: dateStr,
      mealType: selectedMealType,
      mealLabel: selectedMealType === "extra" ? extraMealLabel.trim() : null,
      foodName: foodNameWithMods,
      brandName: selectedFood.brandName || restaurantName.trim() || undefined,
      servingSize: selectedFood.servingSize,
      quantity: qty,
      calories: Math.max(0, Math.round((selectedFood.nutrients.calories + modCalories) * qty)),
      protein: selectedFood.nutrients.protein ? Math.round(selectedFood.nutrients.protein * qty) : null,
      carbs: selectedFood.nutrients.carbs ? Math.round(selectedFood.nutrients.carbs * qty) : null,
      fat: selectedFood.nutrients.fat ? Math.round(selectedFood.nutrients.fat * qty) : null,
      barcode: selectedFood.barcode || null,
      isEstimate: finalIsEstimate,
      sourceType: finalSourceType,
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
      fat: manualEntry.fat ? parseInt(manualEntry.fat) : null,
      isEstimate: true,
      sourceType: 'manual',
    });
  };

  const [scanNotFound, setScanNotFound] = useState<string | null>(null);

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    setIsScanLookup(true);
    setScanNotFound(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`/api/nutrition/food/barcode/${barcode}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const product = await res.json();
        setSelectedFood(product);
        setIsAddFoodOpen(true);
      } else {
        setScanNotFound(barcode);
        setIsAddFoodOpen(true);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setScanNotFound(barcode);
        setIsAddFoodOpen(true);
      } else {
        toast({ title: "Lookup failed", description: "Check your connection and try again", variant: "destructive" });
      }
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

  const calorieStatus = useMemo(() => {
    if (summary.calories === 0) return { label: 'Start logging', color: 'text-muted-foreground', bg: 'bg-muted/40', icon: Zap, glow: false };
    if (remaining < 0) return { label: 'Over budget', color: 'text-destructive', bg: 'bg-destructive/10', icon: AlertTriangle, glow: false };
    if (caloriePercent >= 80) return { label: 'On track', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2, glow: true };
    if (caloriePercent >= 50) return { label: 'Halfway there', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Zap, glow: false };
    return { label: 'Keep going', color: 'text-foreground', bg: 'bg-muted/40', icon: Flame, glow: false };
  }, [summary.calories, remaining, caloriePercent]);

  const allMealsLogged = useMemo(() => {
    return MEAL_TYPES.every(meal => foodLogs.filter(log => log.mealType === meal).length > 0);
  }, [foodLogs]);

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
      <div className="space-y-3 pb-24">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
        <div className="flex items-center justify-between gap-1 rounded-lg bg-muted/30 px-1 py-1">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Card className="bg-card/60">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="text-center flex-1 space-y-1">
                <Skeleton className="h-7 w-12 mx-auto" />
                <Skeleton className="h-3 w-10 mx-auto" />
              </div>
              <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
              <div className="text-center flex-1 space-y-1">
                <Skeleton className="h-7 w-12 mx-auto" />
                <Skeleton className="h-3 w-10 mx-auto" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="text-center space-y-1">
                  <Skeleton className="h-4 w-8 mx-auto" />
                  <Skeleton className="h-1.5 w-full rounded-full" />
                  <Skeleton className="h-3 w-12 mx-auto" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/60">
          <CardContent className="pt-3 pb-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </CardContent>
        </Card>
        {["Breakfast", "Lunch", "Dinner", "Snack"].map(meal => (
          <Card key={meal} className="bg-card/60">
            <CardContent className="pt-3 pb-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Nutrition</h1>
        </div>
        <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-set-goal">
              <Target className="w-4 h-4" />
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

      <div className="flex items-center justify-between gap-1 rounded-lg bg-muted/30 px-1 py-1">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          data-testid="button-prev-day"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">
            {format(selectedDate, "EEE, MMM d, yyyy")}
          </span>
          {!isToday(selectedDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
              data-testid="button-go-to-today"
            >
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            data-testid="button-next-day"
          >
            <ChevronRight className="w-4 h-4" />
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
              <Calendar className="w-3.5 h-3.5" />
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
      </div>

      <Card className={`overflow-hidden shadow-lg shadow-primary/5 relative ${allMealsLogged ? 'card-shine' : ''}`} data-testid="card-calorie-summary">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.02] pointer-events-none" />
        <CardContent className="pt-4 pb-4 relative">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="text-center flex-1" style={{ animation: 'slideUp 0.5s ease-out' }}>
              <div className="text-2xl font-bold tracking-tight" data-testid="text-calories-eaten">{summary.calories}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Eaten</div>
            </div>
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                <circle
                  cx="48" cy="48" r="40"
                  stroke="currentColor"
                  strokeWidth="5"
                  fill="none"
                  className="text-muted/30"
                />
                <circle
                  cx="48" cy="48" r="40"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${(caloriePercent / 100) * 251} 251`}
                  strokeLinecap="round"
                  className="nutrition-ring-progress"
                  style={{
                    stroke: remaining >= 0 ? 'url(#calorieGradient)' : 'hsl(var(--destructive))',
                    filter: remaining >= 0 
                      ? `drop-shadow(0 0 ${caloriePercent > 60 ? 6 : 3}px hsl(var(--primary) / ${caloriePercent > 60 ? 0.5 : 0.3}))` 
                      : 'drop-shadow(0 0 6px hsl(var(--destructive) / 0.5))',
                    transition: 'stroke-dasharray 0.8s ease-out, filter 0.5s ease',
                  }}
                />
                <defs>
                  <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="50%" stopColor="hsl(var(--primary) / 0.8)" />
                    <stop offset="100%" stopColor="hsl(var(--primary) / 0.5)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-center">
                  <div className="text-sm font-bold leading-none" data-testid="text-calorie-percent">
                    {Math.round(caloriePercent)}%
                  </div>
                  <Flame 
                    className={`w-3.5 h-3.5 mx-auto mt-0.5 text-orange-500 ${caloriePercent > 0 ? 'streak-flame' : ''}`}
                  />
                </div>
              </div>
            </div>
            <div className="text-center flex-1" style={{ animation: 'slideUp 0.5s ease-out 0.15s both' }}>
              <div className={`text-2xl font-bold tracking-tight ${remaining < 0 ? "text-destructive" : ""}`} data-testid="text-calories-remaining">
                {Math.abs(remaining)}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                {remaining >= 0 ? "Remaining" : "Over"}
              </div>
            </div>
          </div>

          {(() => {
            const StatusIcon = calorieStatus.icon;
            return (
              <div 
                className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full ${calorieStatus.bg} mb-3`}
                style={{ animation: 'fadeIn 0.6s ease-out 0.3s both' }}
                data-testid="text-calorie-status"
              >
                <StatusIcon className={`w-3 h-3 ${calorieStatus.color}`} style={calorieStatus.glow ? { animation: 'breathe 2s ease-in-out infinite' } : undefined} />
                <span className={`text-[11px] font-semibold ${calorieStatus.color}`}>{calorieStatus.label}</span>
                {calorieStatus.glow && <span className="pulse-dot ml-1" />}
              </div>
            );
          })()}

          <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-red-500/8 via-red-500/12 to-red-500/8 rounded-lg border border-red-500/10" style={{ animation: 'slideUp 0.5s ease-out 0.4s both' }}>
            <div className="p-1 rounded-md bg-red-500/15">
              <Beef className="w-3 h-3 text-red-500" />
            </div>
            <span className="text-xs font-semibold">
              Protein: <span className="text-red-500">{totalProteinToday}g</span>
              {goalData?.dailyProteinTarget && (
                <span className="text-muted-foreground font-normal"> / {proteinGoal}g</span>
              )}
            </span>
            {goalData?.dailyProteinTarget && totalProteinToday >= proteinGoal && (
              <Badge variant="default" className="text-[9px] px-1.5 py-0 bg-emerald-600 dark:bg-emerald-700 no-default-hover-elevate no-default-active-elevate ml-auto" style={{ animation: 'checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>Hit</Badge>
            )}
          </div>

          {healthStatus?.connected && healthData?.caloriesBurned && (
            <div className="flex items-center justify-center gap-1.5 mt-2 py-2 px-3 bg-gradient-to-r from-orange-500/8 via-orange-500/12 to-orange-500/8 rounded-lg border border-orange-500/10">
              <div className="p-1 rounded-md bg-orange-500/15">
                <Watch className="w-3 h-3 text-orange-500" />
              </div>
              <span className="text-xs font-semibold">
                Burned: <span className="text-orange-500">{healthData.caloriesBurned.toLocaleString()} cal</span>
                <span className="text-muted-foreground font-normal ml-1">
                  (Net: {(summary.calories - healthData.caloriesBurned).toLocaleString()} cal)
                </span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-4" style={{ animation: 'slideUp 0.5s ease-out 0.5s both' }}>
            <MacroProgress label="Protein" value={summary.protein} goal={proteinGoal} percent={proteinPercent} icon={Beef} color="text-red-500" bgColor="bg-red-500" />
            <MacroProgress label="Carbs" value={summary.carbs} goal={carbsGoal} percent={carbsPercent} icon={Wheat} color="text-amber-500" bgColor="bg-amber-500" />
            <MacroProgress label="Fat" value={summary.fat} goal={fatGoal} percent={fatPercent} icon={Droplet} color="text-blue-500" bgColor="bg-blue-500" />
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={openGlobalAddFood}
        className={`w-full bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 ${summary.calories === 0 ? 'nutrition-cta-pulse' : ''}`}
        data-testid="button-global-add-food"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Add Food
      </Button>

      <Card className="overflow-hidden shadow-sm relative" data-testid="card-water-tracker" style={{ animation: 'slideUp 0.4s ease-out 0.5s both' }}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-transparent pointer-events-none" />
        <CardContent className="pt-3 pb-3 relative">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-400/10">
                <Droplets className="w-3.5 h-3.5 text-blue-500" style={{ animation: (waterData?.totalOz || 0) > 0 ? 'breathe 3s ease-in-out infinite' : undefined }} />
              </div>
              <span className="text-sm font-bold">Water</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold">
                {waterData?.totalOz || 0}<span className="text-muted-foreground font-normal">oz / 64oz</span>
              </span>
              {(waterData?.totalOz || 0) >= 64 && (
                <Badge variant="default" className="text-[9px] px-1.5 py-0 bg-blue-600 dark:bg-blue-700 no-default-hover-elevate no-default-active-elevate" style={{ animation: 'checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>Full</Badge>
              )}
            </div>
          </div>
          <div className="relative h-3 rounded-full bg-muted/30 overflow-hidden mb-2.5">
            <div 
              className="water-fill-bar absolute inset-y-0 left-0 rounded-full"
              style={{ 
                width: `${Math.min(((waterData?.totalOz || 0) / 64) * 100, 100)}%`,
                transition: 'width 0.6s ease-out',
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[{ oz: 8, label: "8oz" }, { oz: 12, label: "12oz" }, { oz: 16, label: "16oz" }, { oz: 24, label: "24oz" }].map(({ oz, label }) => (
              <Button
                key={oz}
                variant="outline"
                size="sm"
                onClick={() => addWaterMutation.mutate(oz)}
                disabled={addWaterMutation.isPending}
                data-testid={`button-add-water-${oz}`}
              >
                <Plus className="w-3 h-3 mr-0.5" />
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
                <Undo2 className="w-3 h-3 mr-0.5" />
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

      {MEAL_TYPES.map((meal, mealIndex) => {
        const mealCalories = groupedLogs[meal].reduce((sum, log) => sum + log.calories, 0);
        const mealIconConfig: Record<string, { icon: typeof Apple; color: string; bg: string }> = {
          breakfast: { icon: Apple, color: 'text-amber-500', bg: 'bg-amber-500/15' },
          lunch: { icon: Beef, color: 'text-green-500', bg: 'bg-green-500/15' },
          dinner: { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/15' },
          snack: { icon: Wheat, color: 'text-purple-500', bg: 'bg-purple-500/15' },
        };
        const config = mealIconConfig[meal] || mealIconConfig.snack;
        const MealIcon = config.icon;
        const hasFood = groupedLogs[meal].length > 0;
        return (
        <Card key={meal} className="overflow-hidden shadow-sm relative" style={{ animation: `slideUp 0.4s ease-out ${0.1 * mealIndex}s both` }}>
          {hasFood && <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${meal === 'breakfast' ? 'from-amber-500/60 to-amber-400/20' : meal === 'lunch' ? 'from-green-500/60 to-green-400/20' : meal === 'dinner' ? 'from-orange-500/60 to-orange-400/20' : 'from-purple-500/60 to-purple-400/20'}`} />}
          <CardHeader className="pb-1 pt-3 px-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`p-1 rounded-md ${config.bg}`}>
                  <MealIcon className={`w-3.5 h-3.5 ${config.color}`} />
                </div>
                <CardTitle className="text-sm font-bold">{MEAL_LABELS[meal]}</CardTitle>
                {hasFood && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 no-default-hover-elevate no-default-active-elevate" data-testid={`text-meal-cal-${meal}`}>{mealCalories} cal</Badge>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => openAddFoodForMeal(meal)}
                data-testid={`button-add-${meal}`}
              >
                <Plus className="w-3.5 h-3.5 mr-0.5" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {groupedLogs[meal].length === 0 ? (
              <Button 
                variant="ghost"
                onClick={() => openAddFoodForMeal(meal)}
                className="w-full py-3 border border-dashed border-border/60 text-xs text-muted-foreground"
                data-testid={`button-empty-${meal}`}
              >
                <Plus className="w-3 h-3 mr-1" />
                Tap to add {MEAL_LABELS[meal].toLowerCase()}
              </Button>
            ) : (
              <div className="space-y-0.5">
                {groupedLogs[meal].map((log) => (
                  <div key={log.id} className="flex items-center justify-between py-1.5 border-b last:border-0 border-border/50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium truncate">{log.foodName}</p>
                        {log.sourceType != null && (
                          log.isEstimate === false ? (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0 bg-emerald-600 dark:bg-emerald-700 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-verified-${log.id}`}>Verified</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-estimated-${log.id}`}>Estimated</Badge>
                          )
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {log.quantity > 1 && `${log.quantity}x `}
                        {log.servingSize || "1 serving"}
                        {log.brandName && ` · ${log.brandName}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{log.calories} cal</span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteFoodMutation.mutate(log.id)}
                        data-testid={`button-delete-food-${log.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        );
      })}

      <Card className="overflow-hidden shadow-sm relative">
        <CardHeader className="pb-1 pt-3 px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-md bg-red-500/15">
                <Beef className="w-3.5 h-3.5 text-red-500" />
              </div>
              <CardTitle className="text-sm font-bold">Protein</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => openAddFoodForMeal("protein")}
              data-testid="button-add-protein"
            >
              <Plus className="w-3.5 h-3.5 mr-0.5" />
              Add
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 ml-7">Shakes, bars & supplements</p>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {proteinLogs.length === 0 ? (
            <Button 
              variant="ghost"
              onClick={() => openAddFoodForMeal("protein")}
              className="w-full py-3 border border-dashed border-border/60 text-xs text-muted-foreground"
              data-testid="button-empty-protein"
            >
              <Plus className="w-3 h-3 mr-1" />
              Tap to add protein
            </Button>
          ) : (
            <div className="space-y-0.5">
              {proteinLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-1.5 border-b last:border-0 border-border/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium truncate">{log.foodName}</p>
                      {log.sourceType != null && (
                        log.isEstimate === false ? (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0 bg-emerald-600 dark:bg-emerald-700 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-verified-${log.id}`}>Verified</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-estimated-${log.id}`}>Estimated</Badge>
                        )
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {log.protein}g protein
                      {log.calories ? ` · ${log.calories} cal` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-red-500">{log.protein}g</span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => deleteFoodMutation.mutate(log.id)}
                      data-testid={`button-delete-protein-${log.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(extraMealsByLabel).length > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-1 pt-3 px-3">
            <CardTitle className="text-sm font-semibold">Extra Meals</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {Object.entries(extraMealsByLabel).map(([label, logs]) => (
              <div key={label} className="mb-3 last:mb-0">
                <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                <div className="space-y-0.5">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between py-1.5 border-b last:border-0 border-border/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium truncate">{log.foodName}</p>
                          {log.sourceType != null && (
                            log.isEstimate === false ? (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0 bg-emerald-600 dark:bg-emerald-700 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-verified-${log.id}`}>Verified</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 no-default-hover-elevate no-default-active-elevate" data-testid={`badge-estimated-${log.id}`}>Estimated</Badge>
                            )
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {log.quantity > 1 && `${log.quantity}x `}
                          {log.servingSize || "1 serving"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{log.calories} cal</span>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteFoodMutation.mutate(log.id)}
                          data-testid={`button-delete-extra-${log.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
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
            <div className="space-y-4">
              {scanNotFound && (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 px-3 py-2.5" data-testid="banner-scan-not-found">
                  <div className="flex items-start gap-2">
                    <ScanLine className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Product not found</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                        Barcode {scanNotFound} not in our database. Search by name or add manually below.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-amber-600 dark:text-amber-400"
                      onClick={() => setScanNotFound(null)}
                      data-testid="button-dismiss-scan-not-found"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-1 mb-1">
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
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Restaurant name (optional)"
                      value={restaurantName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRestaurantName(val);
                        if (val.trim().length >= 2) {
                          const matches = fuzzyMatchRestaurants(val);
                          setRestaurantSuggestions(matches.map(m => ({ name: m.name, category: m.category })));
                          setShowRestaurantDropdown(matches.length > 0);
                        } else if (val.trim().length === 0) {
                          const recents = getRecentRestaurants();
                          if (recents.length > 0) {
                            setRestaurantSuggestions(recents.slice(0, 5).map(r => ({ name: r, category: "Recent" })));
                            setShowRestaurantDropdown(true);
                          } else {
                            setShowRestaurantDropdown(false);
                          }
                        } else {
                          setShowRestaurantDropdown(false);
                        }
                      }}
                      onFocus={() => {
                        if (restaurantName.trim().length === 0) {
                          const recents = getRecentRestaurants();
                          if (recents.length > 0) {
                            setRestaurantSuggestions(recents.slice(0, 5).map(r => ({ name: r, category: "Recent" })));
                            setShowRestaurantDropdown(true);
                          }
                        } else if (restaurantName.trim().length >= 2) {
                          const matches = fuzzyMatchRestaurants(restaurantName);
                          if (matches.length > 0) {
                            setRestaurantSuggestions(matches.map(m => ({ name: m.name, category: m.category })));
                            setShowRestaurantDropdown(true);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        setTimeout(() => {
                          setShowRestaurantDropdown(false);
                        }, 200);
                      }}
                      className="text-sm"
                      data-testid="input-restaurant-name"
                    />
                    {showRestaurantDropdown && restaurantSuggestions.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border bg-popover shadow-md max-h-[180px] overflow-y-auto">
                        {restaurantSuggestions.map((s, i) => (
                          <button
                            key={`${s.name}-${i}`}
                            className={`w-full px-3 py-2 text-left text-sm hover-elevate flex items-center justify-between gap-2 ${i !== restaurantSuggestions.length - 1 ? 'border-b' : ''}`}
                            onClick={() => {
                              setRestaurantName(s.name);
                              setShowRestaurantDropdown(false);
                              addRecentRestaurant(s.name);
                            }}
                            data-testid={`button-restaurant-${i}`}
                          >
                            <span className="font-medium">{s.name}</span>
                            <Badge variant="secondary" className="text-xs shrink-0">{s.category}</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {restaurantName.trim() && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setRestaurantName("");
                        setShowRestaurantDropdown(false);
                        setSearchResults([]);
                      }}
                      data-testid="button-clear-restaurant"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {restaurantName.trim() && (
                  <p className="text-xs text-primary mt-1">
                    Searching {restaurantName.trim()} menu for exact nutrition data
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder={restaurantName.trim() ? `Search ${restaurantName.trim()} menu...` : "Search foods (e.g., chicken breast, Big Mac)..."}
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
                <div className="space-y-0 max-h-[220px] sm:max-h-[300px] overflow-y-auto rounded-lg border bg-card">
                  {searchResults.map((product, index) => {
                    const st = product.sourceType;
                    const isVerified = st === 'branded_database' || st === 'curated_database';
                    const isEstimated = st === 'ai_estimated' || st === 'generic_database' || product.isEstimate === true;
                    return (
                    <button
                      key={product.barcode || index}
                      onClick={() => {
                        setSelectedFood(product);
                        setSelectedModifiers(new Set());
                        setShowRestaurantDropdown(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left hover-elevate flex items-center justify-between gap-2 ${index !== searchResults.length - 1 ? 'border-b' : ''}`}
                      data-testid={`button-select-food-${product.barcode || index}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm sm:text-base">{product.name}</p>
                          {isVerified && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0 bg-emerald-600 dark:bg-emerald-700">Verified</Badge>
                          )}
                          {isEstimated && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Estimated</Badge>
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
                    );
                  })}
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
                          body: JSON.stringify({ 
                            description: searchQuery,
                            restaurant: restaurantName.trim() || undefined,
                          }),
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
                    {restaurantName.trim() ? `Look up at ${restaurantName.trim()}` : "Estimate with AI"}
                  </Button>
                </div>
              )}

              <div className="border-t pt-4 mt-1">
                <p className="text-sm font-medium mb-3 text-muted-foreground">
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{selectedFood.name}</p>
                    {(() => {
                      const st = selectedFood.sourceType;
                      const baseVerified = st === 'branded_database' || st === 'curated_database';
                      const hasModifiers = selectedModifiers.size > 0;
                      const isVerified = baseVerified && !hasModifiers;
                      return isVerified ? (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-emerald-600 dark:bg-emerald-700">Verified</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Estimated</Badge>
                      );
                    })()}
                  </div>
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

              {selectedFood.commonModifiers && selectedFood.commonModifiers.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Modifications</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFood.commonModifiers.map((mod, idx) => {
                      const isSelected = selectedModifiers.has(idx);
                      return (
                        <Badge
                          key={idx}
                          variant={isSelected ? "default" : "outline"}
                          className={`cursor-pointer text-xs toggle-elevate ${isSelected ? 'toggle-elevated' : ''}`}
                          onClick={() => {
                            const next = new Set(selectedModifiers);
                            if (isSelected) next.delete(idx); else next.add(idx);
                            setSelectedModifiers(next);
                          }}
                          data-testid={`button-modifier-${idx}`}
                        >
                          {mod.label}
                          <span className="ml-1 opacity-70">
                            {mod.calorieDelta >= 0 ? '+' : ''}{mod.calorieDelta} cal
                          </span>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const qty = parseFloat(quantity) || 1;
                const modCalories = selectedFood.commonModifiers 
                  ? Array.from(selectedModifiers).reduce((sum, idx) => sum + (selectedFood.commonModifiers![idx]?.calorieDelta || 0), 0)
                  : 0;
                const adjustedCals = Math.max(0, Math.round((selectedFood.nutrients.calories + modCalories) * qty));
                return (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{adjustedCals}</div>
                  <div className="text-muted-foreground">Cal</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.protein || 0) * qty)}g</div>
                  <div className="text-muted-foreground">Protein</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.carbs || 0) * qty)}g</div>
                  <div className="text-muted-foreground">Carbs</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.fat || 0) * qty)}g</div>
                  <div className="text-muted-foreground">Fat</div>
                </div>
              </div>
                );
              })()}

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

      <NutritionAnalytics />
    </div>
  );
}

function CircularProgress({ value, size = 56, strokeWidth = 5, color, children }: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

function NutritionAnalytics() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [activeTab, setActiveTab] = useState<"calories" | "protein">("calories");

  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/nutrition/analytics", period],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/analytics?period=${period}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });

  if (isLoading) {
    return (
      <Card className="bg-card/60">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analytics || !analytics.dailyData) return null;

  const calAdherence = analytics.summary.adherencePercent;
  const protAdherence = analytics.summary.proteinAdherencePercent;

  const calChartData = analytics.dailyData.map(d => ({
    date: format(new Date(d.date + "T12:00:00"), period === "week" ? "EEE" : "MMM d"),
    eaten: d.actual,
    target: d.target,
  }));

  const protChartData = analytics.dailyData.map(d => ({
    date: format(new Date(d.date + "T12:00:00"), period === "week" ? "EEE" : "MMM d"),
    eaten: d.protein,
    target: analytics.summary.proteinTarget,
  }));

  const getAdherenceLabel = (pct: number) => {
    if (pct >= 90) return { text: "Excellent", color: "text-emerald-500" };
    if (pct >= 70) return { text: "Good", color: "text-amber-500" };
    if (pct >= 50) return { text: "Fair", color: "text-orange-500" };
    return { text: "Needs Work", color: "text-red-500" };
  };

  const getAdherenceRingColor = (pct: number) => {
    if (pct >= 90) return "#10b981";
    if (pct >= 70) return "#f59e0b";
    if (pct >= 50) return "#f97316";
    return "#ef4444";
  };

  const calLabel = getAdherenceLabel(calAdherence);
  const protLabel = getAdherenceLabel(protAdherence);

  const isCalories = activeTab === "calories";
  const chartData = isCalories ? calChartData : protChartData;
  const unit = isCalories ? "cal" : "g";
  const accentColor = isCalories ? "hsl(var(--chart-1))" : "#ef4444";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-xs font-medium text-foreground mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: entry.color }}>
            {entry.name === "eaten" ? "Eaten" : "Target"}: {entry.value.toLocaleString()}{unit}
          </p>
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card/60" data-testid="card-nutrition-analytics">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">Analytics</CardTitle>
          </div>
          <div className="flex gap-0.5">
            <Button
              variant={period === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPeriod("week")}
              data-testid="button-analytics-week"
            >
              7D
            </Button>
            <Button
              variant={period === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPeriod("month")}
              data-testid="button-analytics-month"
            >
              30D
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <div className="flex items-center gap-1 mb-4">
          <Button
            variant={activeTab === "calories" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setActiveTab("calories")}
            data-testid="button-tab-calories"
          >
            <Flame className="w-3.5 h-3.5 mr-1.5" />
            Calories
          </Button>
          <Button
            variant={activeTab === "protein" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setActiveTab("protein")}
            data-testid="button-tab-protein"
          >
            <Beef className="w-3.5 h-3.5 mr-1.5" />
            Protein
          </Button>
        </div>

        {isCalories ? (
          <div className="flex items-center gap-4 mb-4">
            <CircularProgress 
              value={calAdherence} 
              size={72} 
              strokeWidth={6}
              color={getAdherenceRingColor(calAdherence)}
            >
              <div className="text-center">
                <div className="text-sm font-bold leading-none">{calAdherence}%</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">Score</div>
              </div>
            </CircularProgress>

            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold leading-tight" data-testid="text-cal-avg">{analytics.summary.avgCalories.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">avg / day</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold leading-tight ${calLabel.color}`} data-testid="text-cal-adherence">{calLabel.text}</div>
                <div className="text-[10px] text-muted-foreground">adherence</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold leading-tight" data-testid="text-cal-days">{analytics.summary.daysLogged}</div>
                <div className="text-[10px] text-muted-foreground">days logged</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 mb-4">
            <CircularProgress 
              value={protAdherence} 
              size={72} 
              strokeWidth={6}
              color={getAdherenceRingColor(protAdherence)}
            >
              <div className="text-center">
                <div className="text-sm font-bold leading-none">{protAdherence}%</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">Score</div>
              </div>
            </CircularProgress>

            <div className="flex-1 grid grid-cols-3 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold leading-tight" data-testid="text-prot-avg">{analytics.summary.avgProtein}g</div>
                <div className="text-[10px] text-muted-foreground">avg / day</div>
              </div>
              <div className="text-center">
                <div className={`text-lg font-bold leading-tight ${protLabel.color}`} data-testid="text-prot-adherence">{protLabel.text}</div>
                <div className="text-[10px] text-muted-foreground">adherence</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold leading-tight" data-testid="text-prot-days">{analytics.summary.daysWithProtein}</div>
                <div className="text-[10px] text-muted-foreground">days logged</div>
              </div>
            </div>
          </div>
        )}

        {analytics.goal && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 px-1">
            <Target className="w-3 h-3 shrink-0" />
            <span>Daily target:</span>
            <span className="font-semibold text-foreground">
              {isCalories 
                ? `${analytics.summary.dailyTarget.toLocaleString()} cal` 
                : `${analytics.summary.proteinTarget}g`}
            </span>
            {isCalories && analytics.goal.setBy === "trainer" && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Set by trainer</Badge>
            )}
          </div>
        )}

        <div className="h-44 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="20%" barGap={2}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--muted-foreground) / 0.15)" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={period === "month" ? 4 : 0}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 4 }} />
              <Bar 
                dataKey="target" 
                fill="hsl(var(--muted-foreground) / 0.15)" 
                radius={[4, 4, 0, 0]}
                name="target"
              />
              <Bar 
                dataKey="eaten" 
                fill={accentColor}
                radius={[4, 4, 0, 0]}
                name="eaten"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: accentColor }} />
            <span className="text-[10px] text-muted-foreground">Eaten</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/15" />
            <span className="text-[10px] text-muted-foreground">Target</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="text-analytics-period">{period === "week" ? "Last 7 days" : "Last 30 days"}</span>
            <span className="font-medium text-foreground" data-testid="text-analytics-total">
              {isCalories 
                ? `${analytics.summary.totalCalories.toLocaleString()} cal total`
                : `${analytics.summary.totalProtein.toLocaleString()}g total`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MacroProgress({ label, value, goal, percent, icon: Icon, color, bgColor }: { 
  label: string; 
  value: number; 
  goal: number; 
  percent: number; 
  icon: any; 
  color: string;
  bgColor: string;
}) {
  return (
    <div className="text-center space-y-1.5 p-2 rounded-lg bg-muted/20">
      <div className="flex items-center justify-center gap-1">
        <div className={`p-0.5 rounded ${bgColor}/10`}>
          <Icon className={`w-3 h-3 ${color}`} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div 
          className={`absolute inset-y-0 left-0 rounded-full ${bgColor}`}
          style={{ 
            width: `${Math.min(percent, 100)}%`,
            transition: 'width 0.8s ease-out',
            opacity: 0.8,
          }}
        />
      </div>
      <div>
        <span className="text-sm font-bold">{value}g</span>
        <span className="text-[10px] text-muted-foreground"> / {goal}g</span>
      </div>
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
