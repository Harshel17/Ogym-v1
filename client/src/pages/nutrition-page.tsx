import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from "react";
import { 
  Flame, Apple, Beef, Wheat, Droplet, Plus, Minus, Search, Loader2, 
  ChevronLeft, ChevronRight, Trash2, ScanLine, Target, X, TrendingUp, Calendar, BarChart3, Watch,
  Droplets, Clock, Sparkles, Undo2, Zap, CheckCircle2, AlertTriangle, Camera, ImageIcon, Check,
  UtensilsCrossed, ChevronDown, Store, Hand
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
import { AiNutritionCoaching } from "@/components/ai-coach-cards";
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

function InlineMacroBar({ label, value, goal, color, icon: Icon }: {
  label: string;
  value: number;
  goal: number;
  color: string;
  icon: any;
}) {
  const percent = Math.min((value / (goal || 1)) * 100, 100);
  const isOver = value > goal && goal > 0;
  const barColor = isOver ? "#ef4444" : color;

  return (
    <div className="flex items-center gap-3" data-testid={`macro-bar-${label.toLowerCase()}`}>
      <div className="flex items-center gap-1.5 w-[72px] shrink-0">
        <Icon className="w-3.5 h-3.5" style={{ color: barColor }} />
        <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 h-2 rounded-full bg-muted/25 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 6px ${barColor}30`,
          }}
        />
      </div>
      <div className="w-[72px] text-right shrink-0">
        <span className={`text-xs font-bold tabular-nums ${isOver ? "text-red-500" : ""}`}>{value}g</span>
        <span className="text-[10px] text-muted-foreground"> / {goal}g</span>
      </div>
    </div>
  );
}

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
  const [foodMode, setFoodMode] = useState<"search" | "recent" | "photo" | "menu">("search");
  const [restaurantName, setRestaurantName] = useState("");
  const [showRestaurantDropdown, setShowRestaurantDropdown] = useState(false);
  const [restaurantSuggestions, setRestaurantSuggestions] = useState<Array<{ name: string; category: string }>>([]);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<number>>(new Set());
  const [foodTypePresets, setFoodTypePresets] = useState<{
    countUnit?: string;
    countOptions?: number[];
    defaultCount?: number;
    sizeOptions?: { label: string; multiplier: number }[];
    styleOptions?: string[];
    styleCalorieMultipliers?: Record<string, number>;
    foodType?: string;
  } | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedSizeMultiplier, setSelectedSizeMultiplier] = useState<number>(1);

  const [menuRestaurant, setMenuRestaurant] = useState<string>("");
  const [menuData, setMenuData] = useState<{ name: string; categories: string[]; items: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number; servingSize: string; category: string }>; commonModifiers: Array<{ name: string; caloriesDelta: number; proteinDelta: number; carbsDelta: number; fatDelta: number; type: string }> } | null>(null);
  const [menuCategory, setMenuCategory] = useState<string | null>(null);
  const [menuSelectedItem, setMenuSelectedItem] = useState<{ name: string; calories: number; protein: number; carbs: number; fat: number; servingSize: string; category: string } | null>(null);
  const [menuSelectedMods, setMenuSelectedMods] = useState<Set<string>>(new Set());
  const [menuSearch, setMenuSearch] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuRestaurantSearch, setMenuRestaurantSearch] = useState("");
  const [allRestaurants, setAllRestaurants] = useState<string[]>([]);
  const [portionCategory, setPortionCategory] = useState<{ name: string; examples: string[]; portions: Array<{ label: string; emoji: string; description: string; gramsEstimate: number }>; defaultPortionIndex: number } | null>(null);
  const [selectedPortionIdx, setSelectedPortionIdx] = useState<number>(1);

  const [isPhotoAnalyzing, setIsPhotoAnalyzing] = useState(false);
  const [photoResults, setPhotoResults] = useState<{
    items: Array<{ name: string; estimatedGrams: number; calories: number; protein: number; carbs: number; fat: number; servingSize: string; confidence: string; selected: boolean; portionMultiplier: number; baseCalories: number; baseProtein: number; baseCarbs: number; baseFat: number; baseGrams: number }>;
    mealDescription: string;
    overallConfidence: string;
  } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [photoMealType, setPhotoMealType] = useState<string>("snack");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoUploadRef = useRef<HTMLInputElement>(null);

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
      fetch('/api/discipline/score/today?refresh=true', { credentials: 'include' })
        .then(r => r.json())
        .then(d => queryClient.setQueryData(['/api/discipline/score/today'], d))
        .catch(() => {});
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

  useEffect(() => {
    if (!selectedFood) {
      setFoodTypePresets(null);
      setSelectedStyle(null);
      setSelectedSizeMultiplier(1);
      return;
    }
    const fetchPresets = async () => {
      try {
        const res = await fetch(`/api/nutrition/food/type-presets?name=${encodeURIComponent(selectedFood.name)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.presets) {
            setFoodTypePresets(data.presets);
            setSelectedStyle(null);
            setSelectedSizeMultiplier(1);
            if (data.presets.defaultCount) {
              setQuantity(String(data.presets.defaultCount));
            }
          } else {
            setFoodTypePresets(null);
          }
        }
      } catch {
        setFoodTypePresets(null);
      }
    };
    fetchPresets();
    const fetchPortionCategory = async () => {
      try {
        const res = await fetch(`/api/nutrition/portion-sizes/detect?food=${encodeURIComponent(selectedFood.name)}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.category) {
            setPortionCategory(data.category);
            setSelectedPortionIdx(data.category.defaultPortionIndex);
          } else {
            setPortionCategory(null);
          }
        }
      } catch {
        setPortionCategory(null);
      }
    };
    fetchPortionCategory();
  }, [selectedFood]);

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
    setFoodTypePresets(null);
    setSelectedStyle(null);
    setSelectedSizeMultiplier(1);
    setPhotoPreview(null);
    setPhotoResults(null);
    setMenuRestaurant("");
    setMenuData(null);
    setMenuCategory(null);
    setMenuSelectedItem(null);
    setMenuSelectedMods(new Set());
    setMenuSearch("");
    setMenuRestaurantSearch("");
    setPortionCategory(null);
    setSelectedPortionIdx(1);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 7 * 1024 * 1024) {
      toast({ title: "Photo too large", description: "Please use a photo under 7MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setIsPhotoDialogOpen(true);
      setIsPhotoAnalyzing(true);
      setPhotoResults(null);

      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11) setPhotoMealType("breakfast");
      else if (hour >= 11 && hour < 15) setPhotoMealType("lunch");
      else if (hour >= 15 && hour < 18) setPhotoMealType("snack");
      else setPhotoMealType("dinner");

      try {
        const res = await apiRequest("POST", "/api/nutrition/food/photo-analyze", { imageBase64: base64 });
        const data = await res.json();
        setPhotoResults({
          items: data.items.map((item: any) => ({ ...item, selected: true, portionMultiplier: 1, baseCalories: item.calories, baseProtein: item.protein, baseCarbs: item.carbs, baseFat: item.fat, baseGrams: item.estimatedGrams || 0 })),
          mealDescription: data.mealDescription,
          overallConfidence: data.overallConfidence,
        });
      } catch (err: any) {
        toast({ title: "Analysis failed", description: err.message || "Could not analyze photo. Try again.", variant: "destructive" });
        setIsPhotoDialogOpen(false);
      } finally {
        setIsPhotoAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const logPhotoFoodsMutation = useMutation({
    mutationFn: async (items: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number; servingSize: string; selected: boolean }>) => {
      const selectedItems = items.filter(i => i.selected);
      const promises = selectedItems.map((item: any) =>
        apiRequest("POST", "/api/nutrition/logs", {
          date: dateStr,
          mealType: photoMealType,
          mealLabel: null,
          foodName: item.name,
          brandName: "Photo Analysis",
          servingSize: item.servingSize,
          servingQuantity: 1,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          barcode: null,
          isEstimate: true,
          sourceType: "ai_estimated",
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/page-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutrition/analytics"] });
      setIsPhotoDialogOpen(false);
      setIsAddFoodOpen(false);
      setPhotoResults(null);
      setPhotoPreview(null);
      resetAddFood();
      toast({ title: "Food logged!", description: "All items from your photo have been logged." });
    },
    onError: () => {
      toast({ title: "Failed to log", description: "Something went wrong. Please try again.", variant: "destructive" });
    },
  });

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
          credentials: "include",
          body: JSON.stringify({ restaurant: restaurantName.trim(), query: searchQuery }),
        });
        if (res.status === 403) {
          const errData = await res.json();
          if (errData?.code === "AI_CONSENT_REQUIRED") {
            window.dispatchEvent(new CustomEvent("ai-consent-required"));
            setIsSearching(false);
            return;
          }
          toast({ title: "Permission denied", variant: "destructive" });
          setIsSearching(false);
          return;
        }
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
    const sizeMult = foodTypePresets?.sizeOptions ? selectedSizeMultiplier : 1;
    const styleMult = (selectedStyle && foodTypePresets?.styleCalorieMultipliers?.[selectedStyle]) || 1;
    const effectiveQty = qty * sizeMult;
    if (restaurantName.trim()) {
      addRecentRestaurant(restaurantName.trim());
    }
    const modCalories = selectedFood.commonModifiers 
      ? Array.from(selectedModifiers).reduce((sum, idx) => sum + (selectedFood.commonModifiers![idx]?.calorieDelta || 0), 0)
      : 0;
    const modLabels = selectedFood.commonModifiers 
      ? Array.from(selectedModifiers).map(idx => selectedFood.commonModifiers![idx]?.label).filter(Boolean)
      : [];
    const descriptors = [...modLabels];
    if (selectedStyle) descriptors.push(selectedStyle);
    const foodNameWithMods = descriptors.length > 0 
      ? `${selectedFood.name} (${descriptors.join(', ')})`
      : selectedFood.name;
    const st = selectedFood.sourceType;
    const baseVerified = st === 'branded_database' || st === 'curated_database';
    const hasModifiers = selectedModifiers.size > 0 || selectedStyle !== null;
    const finalIsEstimate = !baseVerified || hasModifiers;
    const finalSourceType = st || 'ai_estimated';

    logFoodMutation.mutate({
      date: dateStr,
      mealType: selectedMealType,
      mealLabel: selectedMealType === "extra" ? extraMealLabel.trim() : null,
      foodName: foodNameWithMods,
      brandName: selectedFood.brandName || restaurantName.trim() || undefined,
      servingSize: selectedFood.servingSize,
      quantity: effectiveQty,
      calories: Math.max(0, Math.round((selectedFood.nutrients.calories * styleMult + modCalories) * effectiveQty)),
      protein: selectedFood.nutrients.protein ? Math.round(selectedFood.nutrients.protein * styleMult * effectiveQty) : null,
      carbs: selectedFood.nutrients.carbs ? Math.round(selectedFood.nutrients.carbs * styleMult * effectiveQty) : null,
      fat: selectedFood.nutrients.fat ? Math.round(selectedFood.nutrients.fat * styleMult * effectiveQty) : null,
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
    <div className="space-y-3 pb-36 stagger-list">
      <div className="flex items-center justify-between gap-2">
        <div className="page-header-gradient flex-1">
          <div className="flex items-center gap-3">
            <div className="icon-badge icon-badge-green">
              <Apple className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display">Nutrition</h1>
              <p className="text-sm text-muted-foreground">Track your meals & macros</p>
            </div>
          </div>
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

      <div className="flex items-center justify-between gap-1 rounded-2xl bg-muted/20 border border-border/40 px-1.5 py-1.5">
        <Button 
          variant="ghost" 
          size="icon"
          className="rounded-xl"
          onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          data-testid="button-prev-day"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-background/80 rounded-xl px-3 py-1.5 border border-border/30 shadow-sm">
            <Calendar className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold">
              {isToday(selectedDate) ? "Today" : format(selectedDate, "EEE, MMM d")}
            </span>
            {!isToday(selectedDate) && (
              <span className="text-[10px] text-muted-foreground">{format(selectedDate, "yyyy")}</span>
            )}
          </div>
          {!isToday(selectedDate) && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-[11px] px-2.5"
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
            className="rounded-xl"
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            data-testid="button-next-day"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl"
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

      {foodLogs.length > 0 && (
        <div className="flex items-center gap-2 justify-center -mt-1" data-testid="analytics-peek">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/10">
            <TrendingUp className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-semibold text-primary">{foodLogs.length} items logged</span>
          </div>
          {allMealsLogged && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/15">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">All meals</span>
            </div>
          )}
        </div>
      )}

      <Card className={`card-glow-green rounded-2xl shadow-lg shadow-primary/5 relative overflow-hidden ${allMealsLogged ? 'card-shine' : ''}`} data-testid="card-calorie-summary">
        <CardContent className="pt-6 pb-5 px-4 relative">
          <div className="flex flex-col items-center mb-3">
            <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="68" stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/15" />
                <circle cx="80" cy="80" r="68" stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/8" strokeDasharray="4 8" />
                <circle
                  cx="80" cy="80" r="68"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${(caloriePercent / 100) * 427.3} 427.3`}
                  strokeLinecap="round"
                  className="nutrition-ring-progress"
                  style={{
                    stroke: remaining >= 0 ? 'url(#calorieGradient)' : 'hsl(var(--destructive))',
                    filter: remaining >= 0 
                      ? `drop-shadow(0 0 ${caloriePercent > 60 ? 10 : 5}px hsl(var(--primary) / ${caloriePercent > 60 ? 0.5 : 0.3}))` 
                      : 'drop-shadow(0 0 10px hsl(var(--destructive) / 0.5))',
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
                <Flame className={`w-4 h-4 text-orange-500 ${caloriePercent > 0 ? 'streak-flame' : ''}`} />
                <div className="text-3xl font-bold tracking-tight mt-0.5 leading-none" data-testid="text-calories-eaten">{summary.calories}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-1">of {calorieGoal} cal</div>
                <div className={`text-xs font-semibold mt-1 ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-calories-remaining">
                  {remaining >= 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
                </div>
              </div>
            </div>

            {(() => {
              const StatusIcon = calorieStatus.icon;
              return (
                <div 
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-full ${calorieStatus.bg} mt-2`}
                  style={{ animation: 'fadeIn 0.6s ease-out 0.3s both' }}
                  data-testid="text-calorie-status"
                >
                  <StatusIcon className={`w-3 h-3 ${calorieStatus.color}`} style={calorieStatus.glow ? { animation: 'breathe 2s ease-in-out infinite' } : undefined} />
                  <span className={`text-[11px] font-semibold ${calorieStatus.color}`}>{calorieStatus.label}</span>
                  {calorieStatus.glow && <span className="pulse-dot ml-1" />}
                </div>
              );
            })()}
          </div>

          {healthStatus?.connected && healthData?.caloriesBurned && (
            <div className="flex items-center justify-center gap-1.5 mb-3 py-2 px-3 bg-gradient-to-r from-orange-500/8 via-orange-500/12 to-orange-500/8 rounded-xl border border-orange-500/10">
              <div className="p-1.5 rounded-lg bg-orange-500/15">
                <Watch className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <span className="text-xs font-semibold">
                Burned: <span className="text-orange-500">{healthData.caloriesBurned.toLocaleString()} cal</span>
                <span className="text-muted-foreground font-normal ml-1">
                  (Net: {(summary.calories - healthData.caloriesBurned).toLocaleString()} cal)
                </span>
              </span>
            </div>
          )}

          <div className="space-y-2.5 pt-3 border-t border-border/30">
            <InlineMacroBar label="Protein" value={summary.protein} goal={proteinGoal} color="#ef4444" icon={Beef} />
            <InlineMacroBar label="Carbs" value={summary.carbs} goal={carbsGoal} color="#f59e0b" icon={Wheat} />
            <InlineMacroBar label="Fat" value={summary.fat} goal={fatGoal} color="#3b82f6" icon={Droplet} />
          </div>
        </CardContent>
      </Card>

      {calorieGoal > 0 && summary.calories > 0 && (
        <div className="space-y-2" data-testid="section-calorie-budget">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Calorie Budget</span>
            <span className="text-[10px] text-muted-foreground font-medium">{summary.calories} / {calorieGoal} cal</span>
          </div>
          <div className="h-3 rounded-full bg-muted/20 overflow-hidden flex">
            {(() => {
              const mealColors: Record<string, string> = { breakfast: '#f59e0b', lunch: '#3b82f6', dinner: '#8b5cf6', snack: '#10b981' };
              const segments = MEAL_TYPES.map(meal => {
                const cals = groupedLogs[meal]?.reduce((s: number, l: any) => s + l.calories, 0) || 0;
                return { meal, cals, pct: calorieGoal > 0 ? Math.min((cals / calorieGoal) * 100, 100) : 0 };
              }).filter(s => s.cals > 0);
              const totalPct = segments.reduce((s, seg) => s + seg.pct, 0);
              const scale = totalPct > 100 ? 100 / totalPct : 1;
              return segments.map((seg, i) => (
                <div
                  key={seg.meal}
                  className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${seg.pct * scale}%`,
                    backgroundColor: mealColors[seg.meal] || '#6b7280',
                    marginLeft: i > 0 ? '1px' : undefined,
                  }}
                  title={`${seg.meal}: ${seg.cals} cal`}
                />
              ));
            })()}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {[
              { meal: 'breakfast', label: 'B', color: '#f59e0b' },
              { meal: 'lunch', label: 'L', color: '#3b82f6' },
              { meal: 'dinner', label: 'D', color: '#8b5cf6' },
              { meal: 'snack', label: 'S', color: '#10b981' },
            ].map(({ meal, label, color }) => {
              const cals = groupedLogs[meal]?.reduce((s: number, l: any) => s + l.calories, 0) || 0;
              if (cals === 0) return null;
              return (
                <div key={meal} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-muted-foreground">{label}: {cals}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(() => {
        const proteinPct = proteinGoal > 0 ? (summary.protein / proteinGoal) * 100 : 0;
        const hour = new Date().getHours();
        let insight = '';
        let insightIcon = '💡';
        
        if (summary.calories === 0) {
          insight = hour < 12 ? "Start your day with a balanced breakfast!" : "Log your first meal to track your progress.";
          insightIcon = '🌅';
        } else if (remaining < 0) {
          insight = `You're ${Math.abs(remaining)} cal over your goal. Consider lighter meals for the rest of the day.`;
          insightIcon = '⚠️';
        } else if (remaining > 0 && remaining < 200 && caloriePercent > 85) {
          insight = `Almost there! Just ${remaining} cal left — a light snack would round out your day.`;
          insightIcon = '🎯';
        } else if (proteinPct >= 100) {
          insight = "Great job hitting your protein target today!";
          insightIcon = '💪';
        } else if (proteinPct < 50 && hour > 15) {
          insight = `You've had ${summary.protein}g protein. Consider a protein-rich dinner or shake.`;
          insightIcon = '🥩';
        } else if (caloriePercent > 50 && caloriePercent < 80) {
          insight = `You're on pace. About ${remaining} cal left for ${hour < 15 ? 'lunch and dinner' : 'dinner'}.`;
          insightIcon = '✅';
        } else if (caloriePercent <= 30 && hour > 14) {
          insight = "You're eating light today — make sure to get enough nutrients!";
          insightIcon = '🍽️';
        } else {
          insight = `Keep logging! You've tracked ${summary.calories} cal so far.`;
          insightIcon = '📊';
        }

        return (
          <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-gradient-to-r from-primary/5 via-primary/8 to-primary/5 border border-primary/10" data-testid="card-smart-insight">
            <span className="text-sm mt-0.5 shrink-0">{insightIcon}</span>
            <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
          </div>
        );
      })()}

      {recentFoods.length > 0 && (
        <div data-testid="section-quick-relog" style={{ animation: 'slideUp 0.4s ease-out 0.3s both' }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-md bg-primary/10">
                <Zap className="w-3 h-3 text-primary" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Re-log</span>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
            {recentFoods.slice(0, 6).map((food: any, i: number) => (
              <button
                key={`quick-${i}`}
                onClick={() => {
                  logFoodMutation.mutate({
                    date: dateStr,
                    mealType: "snack",
                    mealLabel: null,
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
                disabled={logFoodMutation.isPending}
                className="flex-shrink-0 flex flex-col gap-1.5 px-3.5 py-3 rounded-2xl border border-border/50 bg-gradient-to-br from-card to-muted/20 shadow-sm hover-elevate active:scale-[0.97] transition-transform min-w-[120px]"
                data-testid={`button-quick-relog-${i}`}
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-xs font-semibold truncate max-w-[80px] text-left">{food.foodName || food.food_name}</p>
                </div>
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold">{food.calories} cal</span>
                  <div className="flex items-center gap-1">
                    {(food.protein || 0) > 0 && <div className="w-1.5 h-1.5 rounded-full bg-red-400" title={`P: ${food.protein}g`} />}
                    {(food.carbs || 0) > 0 && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" title={`C: ${food.carbs}g`} />}
                    {(food.fat || 0) > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" title={`F: ${food.fat}g`} />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
        <div className="p-1 rounded-md bg-blue-500/10">
          <Droplets className="w-3 h-3 text-blue-500" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hydration</span>
      </div>

      <Card className="card-glow-blue rounded-2xl shadow-sm relative overflow-hidden" data-testid="card-water-tracker" style={{ animation: 'slideUp 0.4s ease-out 0.5s both' }}>
        <CardContent className="pt-4 pb-4 px-4 relative">
          {(() => {
            const waterOz = waterData?.totalOz || 0;
            const waterGoal = 64;
            const waterPercent = Math.min((waterOz / waterGoal) * 100, 100);
            const isFull = waterOz >= waterGoal;
            const glassCount = 8;
            const ozPerGlass = waterGoal / glassCount;
            const filledGlasses = Math.min(Math.floor(waterOz / ozPerGlass), glassCount);
            const partialFill = ((waterOz % ozPerGlass) / ozPerGlass);
            return (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-500" style={{ animation: waterOz > 0 ? 'breathe 3s ease-in-out infinite' : undefined }} />
                    <span className="text-sm font-bold">Water</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold tabular-nums">
                      {waterOz}<span className="text-muted-foreground font-normal">oz / {waterGoal}oz</span>
                    </span>
                    {isFull && (
                      <Badge variant="default" className="text-[9px] px-1.5 py-0 bg-blue-600 dark:bg-blue-700 no-default-hover-elevate no-default-active-elevate" style={{ animation: 'checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>Full</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-end justify-center gap-1.5 mb-3 py-2">
                  {Array.from({ length: glassCount }).map((_, i) => {
                    const filled = i < filledGlasses;
                    const isPartial = i === filledGlasses && partialFill > 0;
                    const fillHeight = filled ? 100 : isPartial ? partialFill * 100 : 0;
                    return (
                      <div key={i} className="relative flex flex-col items-center">
                        <div
                          className="w-5 h-8 rounded-b-md border-2 relative overflow-hidden transition-all duration-500"
                          style={{
                            borderColor: filled ? '#3b82f6' : isPartial ? '#93c5fd' : 'hsl(var(--border))',
                          }}
                          data-testid={`water-glass-${i}`}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out rounded-b-[2px]"
                            style={{
                              height: `${fillHeight}%`,
                              background: filled ? 'linear-gradient(to top, #2563eb, #60a5fa)' : 'linear-gradient(to top, #93c5fd, #bfdbfe)',
                              opacity: fillHeight > 0 ? 1 : 0,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="w-full h-2 rounded-full bg-muted/20 overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${waterPercent}%`,
                      background: isFull ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #2563eb, #60a5fa)',
                      boxShadow: `0 0 8px ${isFull ? '#10b98140' : '#3b82f640'}`,
                    }}
                    data-testid="text-water-ring-percent"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[{ oz: 8, label: "8oz" }, { oz: 12, label: "12oz" }, { oz: 16, label: "16oz" }, { oz: 24, label: "24oz" }].map(({ oz, label }) => (
                    <Button
                      key={oz}
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-[11px] px-0"
                      onClick={() => addWaterMutation.mutate(oz)}
                      disabled={addWaterMutation.isPending}
                      data-testid={`button-add-water-${oz}`}
                    >
                      <Plus className="w-3 h-3 mr-0.5" />
                      {label}
                    </Button>
                  ))}
                </div>
                {waterData?.logs && waterData.logs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 text-muted-foreground text-[11px]"
                    onClick={() => {
                      const lastLog = waterData.logs[waterData.logs.length - 1];
                      if (lastLog) deleteWaterMutation.mutate(lastLog.id);
                    }}
                    disabled={deleteWaterMutation.isPending}
                    data-testid="button-undo-water"
                  >
                    <Undo2 className="w-3 h-3 mr-0.5" />
                    Undo last
                  </Button>
                )}
              </>
            );
          })()}
        </CardContent>
      </Card>

      <AiNutritionCoaching />

      <FindMyFood 
        remainingCalories={remaining}
        goalType={(goalData?.goalType as 'lose' | 'maintain' | 'gain') || 'maintain'}
        onLogFood={(foodName, calories) => {
          setSearchQuery(foodName);
          setSelectedMealType('lunch');
          setIsAddFoodOpen(true);
        }}
      />

      <div className="flex items-center gap-2 mt-1">
        <div className="p-1 rounded-md bg-amber-500/10">
          <Flame className="w-3 h-3 text-amber-500" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meals</span>
      </div>

      {MEAL_TYPES.map((meal, mealIndex) => {
        const mealCalories = groupedLogs[meal].reduce((sum, log) => sum + log.calories, 0);
        const mealIconConfig: Record<string, { icon: typeof Apple; color: string; bg: string; glow: string }> = {
          breakfast: { icon: Apple, color: 'text-amber-500', bg: 'bg-amber-500/15', glow: 'card-glow-amber' },
          lunch: { icon: Beef, color: 'text-green-500', bg: 'bg-green-500/15', glow: 'card-glow-green' },
          dinner: { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/15', glow: 'card-glow-orange' },
          snack: { icon: Wheat, color: 'text-purple-500', bg: 'bg-purple-500/15', glow: 'card-glow-purple' },
        };
        const config = mealIconConfig[meal] || mealIconConfig.snack;
        const MealIcon = config.icon;
        const hasFood = groupedLogs[meal].length > 0;
        return (
        <Card key={meal} className={`overflow-hidden rounded-2xl shadow-sm relative ${hasFood ? config.glow : 'border-dashed border-border/50'}`} style={{ animation: `slideUp 0.4s ease-out ${0.1 * mealIndex}s both` }}>
          {hasFood && <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${meal === 'breakfast' ? 'from-amber-500/60 to-amber-400/20' : meal === 'lunch' ? 'from-green-500/60 to-green-400/20' : meal === 'dinner' ? 'from-orange-500/60 to-orange-400/20' : 'from-purple-500/60 to-purple-400/20'}`} />}
          <CardHeader className="pb-1 pt-3 px-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-xl ${config.bg}`}>
                  <MealIcon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">{MEAL_LABELS[meal]}</CardTitle>
                  {hasFood && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground font-medium" data-testid={`text-meal-cal-${meal}`}>{mealCalories} cal</span>
                      <span className="text-[10px] text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        P:{groupedLogs[meal].reduce((s, l) => s + (l.protein || 0), 0)}g
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        C:{groupedLogs[meal].reduce((s, l) => s + (l.carbs || 0), 0)}g
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        F:{groupedLogs[meal].reduce((s, l) => s + (l.fat || 0), 0)}g
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                className="rounded-xl"
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
              <button 
                onClick={() => openAddFoodForMeal(meal)}
                className="w-full flex flex-col items-center gap-1.5 py-4 cursor-pointer rounded-xl border border-dashed border-border/40 bg-muted/10"
                data-testid={`button-empty-${meal}`}
              >
                <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center`}>
                  <Plus className={`w-4 h-4 ${config.color}`} />
                </div>
                <span className="text-[11px] text-muted-foreground/60 font-medium">
                  Tap to add {MEAL_LABELS[meal].toLowerCase()}
                </span>
              </button>
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
                        {log.createdAt && !isNaN(new Date(log.createdAt).getTime()) && (
                          <span className="text-muted-foreground/60 mr-1">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        )}
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

      <Card className={`shadow-sm relative ${proteinLogs.length > 0 ? 'card-glow-red' : 'card-ambient'}`}>
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

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+68px)] left-0 right-0 z-30 px-4 pointer-events-none" data-testid="floating-add-food-bar">
        <div className="max-w-lg mx-auto flex gap-2 pointer-events-auto">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoSelect}
            data-testid="input-photo-food"
          />
          <Button 
            onClick={openGlobalAddFood}
            className={`flex-1 rounded-2xl shadow-xl shadow-primary/25 bg-gradient-to-r from-primary to-primary/80 ${summary.calories === 0 ? 'nutrition-cta-pulse' : ''}`}
            data-testid="button-global-add-food"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Food
          </Button>
          <Button
            variant="outline"
            onClick={() => photoInputRef.current?.click()}
            className="rounded-2xl bg-card/95 backdrop-blur-sm border-violet-500/20 text-violet-600 dark:text-violet-400 shadow-xl"
            data-testid="button-photo-food"
          >
            <Camera className="w-4 h-4 mr-1.5" />
            Photo
          </Button>
        </div>
      </div>

      <Dialog open={isPhotoDialogOpen} onOpenChange={(open) => { setIsPhotoDialogOpen(open); if (!open) { setPhotoResults(null); setPhotoPreview(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-violet-500" />
              Photo Food Log
            </DialogTitle>
          </DialogHeader>

          {photoPreview && (
            <div className="relative rounded-xl overflow-hidden border border-border/50">
              <img src={photoPreview} alt="Food" className="w-full max-h-48 object-cover" />
              {isPhotoAnalyzing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-white font-medium">Analyzing food...</p>
                    <p className="text-xs text-white/60 mt-1">Identifying items and nutrition</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {photoResults && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{photoResults.mealDescription}</p>
                <Badge variant="outline" className={
                  photoResults.overallConfidence === 'high' ? 'border-green-500/30 text-green-600 bg-green-500/5' :
                  photoResults.overallConfidence === 'medium' ? 'border-amber-500/30 text-amber-600 bg-amber-500/5' :
                  'border-red-500/30 text-red-600 bg-red-500/5'
                }>
                  {photoResults.overallConfidence} confidence
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Log as:</Label>
                <Select value={photoMealType} onValueChange={setPhotoMealType}>
                  <SelectTrigger className="w-32" data-testid="select-photo-meal-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakfast">Breakfast</SelectItem>
                    <SelectItem value="lunch">Lunch</SelectItem>
                    <SelectItem value="dinner">Dinner</SelectItem>
                    <SelectItem value="snack">Snack</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                {photoResults.items.map((item, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border transition-all ${item.selected ? 'border-violet-500/30 bg-violet-500/5' : 'border-border/50 bg-muted/30 opacity-60'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setPhotoResults(prev => {
                                if (!prev) return prev;
                                const updated = [...prev.items];
                                updated[i] = { ...updated[i], selected: !updated[i].selected };
                                return { ...prev, items: updated };
                              });
                            }}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.selected ? 'bg-violet-500 border-violet-500' : 'border-muted-foreground/30'}`}
                            data-testid={`toggle-photo-item-${i}`}
                          >
                            {item.selected && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <span className="font-medium text-sm truncate">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-7">
                          <span className="text-xs text-muted-foreground">{item.servingSize}</span>
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${
                            item.confidence === 'high' ? 'text-green-600 border-green-500/20' :
                            item.confidence === 'medium' ? 'text-amber-600 border-amber-500/20' :
                            'text-red-600 border-red-500/20'
                          }`}>
                            {item.confidence}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold">{item.calories} cal</p>
                        <p className="text-[10px] text-muted-foreground">P:{item.protein}g C:{item.carbs}g F:{item.fat}g</p>
                      </div>
                    </div>
                    {item.selected && (
                      <div className="flex items-center gap-2 mt-2 ml-7">
                        <span className="text-[10px] text-muted-foreground mr-auto">Portion:</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoResults(prev => {
                              if (!prev) return prev;
                              const updated = [...prev.items];
                              const newMult = Math.max(0.25, (updated[i].portionMultiplier || 1) - 0.25);
                              updated[i] = { ...updated[i], portionMultiplier: newMult, calories: Math.round(updated[i].baseCalories * newMult), protein: Math.round(updated[i].baseProtein * newMult), carbs: Math.round(updated[i].baseCarbs * newMult), fat: Math.round(updated[i].baseFat * newMult), estimatedGrams: Math.round(updated[i].baseGrams * newMult) };
                              return { ...prev, items: updated };
                            });
                          }}
                          data-testid={`portion-decrease-${i}`}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-xs font-medium w-10 text-center" data-testid={`portion-value-${i}`}>{item.portionMultiplier || 1}x</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoResults(prev => {
                              if (!prev) return prev;
                              const updated = [...prev.items];
                              const newMult = Math.min(5, (updated[i].portionMultiplier || 1) + 0.25);
                              updated[i] = { ...updated[i], portionMultiplier: newMult, calories: Math.round(updated[i].baseCalories * newMult), protein: Math.round(updated[i].baseProtein * newMult), carbs: Math.round(updated[i].baseCarbs * newMult), fat: Math.round(updated[i].baseFat * newMult), estimatedGrams: Math.round(updated[i].baseGrams * newMult) };
                              return { ...prev, items: updated };
                            });
                          }}
                          data-testid={`portion-increase-${i}`}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl border border-border/30">
                <span className="text-sm font-medium">Total</span>
                <div className="text-right">
                  <p className="font-bold">
                    {photoResults.items.filter(i => i.selected).reduce((s, i) => s + i.calories, 0)} cal
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    P:{photoResults.items.filter(i => i.selected).reduce((s, i) => s + i.protein, 0)}g{' '}
                    C:{photoResults.items.filter(i => i.selected).reduce((s, i) => s + i.carbs, 0)}g{' '}
                    F:{photoResults.items.filter(i => i.selected).reduce((s, i) => s + i.fat, 0)}g
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setIsPhotoDialogOpen(false); setPhotoResults(null); setPhotoPreview(null); }}
                  data-testid="button-photo-cancel"
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20"
                  disabled={!photoResults.items.some(i => i.selected) || logPhotoFoodsMutation.isPending}
                  onClick={() => logPhotoFoodsMutation.mutate(photoResults.items)}
                  data-testid="button-photo-confirm"
                >
                  {logPhotoFoodsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
                  Log {photoResults.items.filter(i => i.selected).length} Items
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                <Button
                  variant={foodMode === "photo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFoodMode("photo")}
                  className={foodMode !== "photo" ? "border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400" : "bg-violet-600 hover:bg-violet-700 text-white"}
                  data-testid="button-food-mode-photo"
                >
                  <Camera className="w-3 h-3 mr-1" />
                  Photo
                </Button>
                <Button
                  variant={foodMode === "menu" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFoodMode("menu");
                    if (allRestaurants.length === 0) {
                      fetch("/api/nutrition/restaurant-menus", { credentials: "include" })
                        .then(r => r.json())
                        .then(d => setAllRestaurants(d.restaurants || []))
                        .catch(() => {});
                    }
                  }}
                  className={foodMode !== "menu" ? "border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400" : "bg-orange-600 hover:bg-orange-700 text-white"}
                  data-testid="button-food-mode-menu"
                >
                  <Store className="w-3 h-3 mr-1" />
                  Menu
                </Button>
              </div>

              {foodMode === "menu" ? (
                <div className="space-y-2">
                  {!menuData ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          placeholder="Search restaurants..."
                          value={menuRestaurantSearch}
                          onChange={(e) => setMenuRestaurantSearch(e.target.value)}
                          className="text-base"
                          data-testid="input-menu-restaurant-search"
                        />
                        <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                      <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
                        {(menuRestaurantSearch.trim().length >= 1
                          ? allRestaurants.filter(r => r.toLowerCase().includes(menuRestaurantSearch.toLowerCase()))
                          : allRestaurants
                        ).map((r, i) => (
                          <button
                            key={r}
                            className="w-full px-3 py-2 text-left hover:bg-muted/50 flex items-center justify-between gap-2 rounded-md"
                            onClick={async () => {
                              setMenuLoading(true);
                              setMenuRestaurant(r);
                              try {
                                const res = await fetch(`/api/nutrition/restaurant-menus/${encodeURIComponent(r)}`, { credentials: "include" });
                                const data = await res.json();
                                if (data.found) {
                                  setMenuData(data.menu);
                                  setMenuCategory(null);
                                  setMenuSelectedItem(null);
                                  setMenuSelectedMods(new Set());
                                  addRecentRestaurant(r);
                                }
                              } catch {}
                              setMenuLoading(false);
                            }}
                            data-testid={`button-menu-restaurant-${i}`}
                          >
                            <div className="flex items-center gap-2">
                              <Store className="w-4 h-4 text-orange-500" />
                              <span className="font-medium text-sm">{r}</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        ))}
                        {allRestaurants.length === 0 && !menuLoading && (
                          <div className="text-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Loading...</p>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">{allRestaurants.length} restaurants</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7" onClick={() => { setMenuData(null); setMenuRestaurant(""); setMenuCategory(null); setMenuSearch(""); setMenuSelectedItem(null); }} data-testid="button-menu-back-restaurants">
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <p className="font-semibold text-sm truncate flex-1">{menuRestaurant}</p>
                        <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-500 shrink-0">Verified</Badge>
                      </div>
                      
                      <Input
                        placeholder={`Search menu...`}
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        className="text-sm h-8"
                        data-testid="input-menu-item-search"
                      />

                      {!menuSearch.trim() && (
                        <div className="flex gap-1 flex-wrap">
                          {menuData.categories.map((cat) => (
                            <Badge
                              key={cat}
                              variant={menuCategory === cat ? "default" : "outline"}
                              className="cursor-pointer text-[10px] px-2 py-0.5"
                              onClick={() => setMenuCategory(menuCategory === cat ? null : cat)}
                              data-testid={`button-menu-category-${cat}`}
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="space-y-0 max-h-[240px] overflow-y-auto rounded-lg border bg-card">
                        {menuData.items
                          .filter(item => {
                            const matchesCat = !menuCategory || item.category === menuCategory;
                            const matchesSearch = !menuSearch.trim() || item.name.toLowerCase().includes(menuSearch.toLowerCase());
                            return matchesCat && matchesSearch;
                          })
                          .map((item, idx) => {
                            const isExpanded = menuSelectedItem?.name === item.name && menuSelectedItem?.category === item.category;
                            return (
                            <div key={`${item.name}-${idx}`} className={idx > 0 ? 'border-t' : ''}>
                              <div
                                className="w-full px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-muted/50"
                              >
                                <div className="flex-1 min-w-0" onClick={() => {
                                  setMenuSelectedItem(isExpanded ? null : item);
                                  setMenuSelectedMods(new Set());
                                }}>
                                  <p className="font-medium text-sm leading-tight">{item.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{item.calories} cal · P:{item.protein}g C:{item.carbs}g F:{item.fat}g</p>
                                </div>
                                <button
                                  className="shrink-0 h-7 w-7 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center text-white transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    logFoodMutation.mutate({
                                      date: dateStr,
                                      mealType: selectedMealType,
                                      mealLabel: selectedMealType === "extra" ? extraMealLabel.trim() : null,
                                      foodName: item.name,
                                      brandName: menuRestaurant,
                                      servingSize: item.servingSize,
                                      quantity: 1,
                                      calories: item.calories,
                                      protein: item.protein,
                                      carbs: item.carbs,
                                      fat: item.fat,
                                      barcode: null,
                                      isEstimate: false,
                                      sourceType: "restaurant_menu",
                                    });
                                  }}
                                  disabled={logFoodMutation.isPending}
                                  data-testid={`button-quick-log-${idx}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {isExpanded && menuData.commonModifiers.length > 0 && (
                                <div className="px-3 pb-2 space-y-1.5">
                                  <div className="flex flex-wrap gap-1">
                                    {menuData.commonModifiers.map((mod) => {
                                      const isSelected = menuSelectedMods.has(mod.name);
                                      return (
                                        <Badge
                                          key={mod.name}
                                          variant={isSelected ? "default" : "outline"}
                                          className={cn("cursor-pointer text-[10px] px-1.5 py-0.5", isSelected && "bg-orange-500")}
                                          onClick={() => {
                                            setMenuSelectedMods(prev => {
                                              const next = new Set(prev);
                                              if (next.has(mod.name)) next.delete(mod.name);
                                              else next.add(mod.name);
                                              return next;
                                            });
                                          }}
                                          data-testid={`button-mod-${mod.name}`}
                                        >
                                          {mod.name} <span className={cn("ml-0.5", mod.caloriesDelta > 0 ? "text-red-400" : "text-green-400")}>{mod.caloriesDelta > 0 ? `+${mod.caloriesDelta}` : mod.caloriesDelta}</span>
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                  {menuSelectedMods.size > 0 && (
                                    <Button
                                      size="sm"
                                      className="w-full h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                                      onClick={() => {
                                        let cal = item.calories, protein = item.protein, carbs = item.carbs, fat = item.fat;
                                        const modNames: string[] = [];
                                        menuSelectedMods.forEach(modName => {
                                          const mod = menuData?.commonModifiers.find(m => m.name === modName);
                                          if (mod) { cal += mod.caloriesDelta; protein += mod.proteinDelta; carbs += mod.carbsDelta; fat += mod.fatDelta; modNames.push(mod.name); }
                                        });
                                        logFoodMutation.mutate({
                                          date: dateStr, mealType: selectedMealType,
                                          mealLabel: selectedMealType === "extra" ? extraMealLabel.trim() : null,
                                          foodName: `${item.name} (${modNames.join(", ")})`,
                                          brandName: menuRestaurant, servingSize: item.servingSize, quantity: 1,
                                          calories: Math.max(0, cal), protein: Math.max(0, protein),
                                          carbs: Math.max(0, carbs), fat: Math.max(0, fat),
                                          barcode: null, isEstimate: false, sourceType: "restaurant_menu",
                                        });
                                      }}
                                      disabled={logFoodMutation.isPending}
                                      data-testid="button-log-menu-item"
                                    >
                                      {logFoodMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                                      Log with changes ({(() => { let d = 0; menuSelectedMods.forEach(n => { const m = menuData?.commonModifiers.find(x => x.name === n); if (m) d += m.caloriesDelta; }); return d > 0 ? `+${d}` : d; })()} cal)
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : foodMode === "photo" ? (
                <div className="space-y-4">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 7 * 1024 * 1024) {
                        toast({ title: "Photo too large", description: "Please use a photo under 7MB.", variant: "destructive" });
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = reader.result as string;
                        setPhotoPreview(base64);
                        setIsPhotoAnalyzing(true);
                        setPhotoResults(null);
                        setPhotoMealType(selectedMealType);
                        try {
                          const res = await apiRequest("POST", "/api/nutrition/food/photo-analyze", { imageBase64: base64 });
                          const data = await res.json();
                          setPhotoResults({
                            items: data.items.map((item: any) => ({ ...item, selected: true, portionMultiplier: 1, baseCalories: item.calories, baseProtein: item.protein, baseCarbs: item.carbs, baseFat: item.fat, baseGrams: item.estimatedGrams || 0 })),
                            mealDescription: data.mealDescription,
                            overallConfidence: data.overallConfidence,
                          });
                        } catch (err: any) {
                          toast({ title: "Analysis failed", description: err.message || "Could not analyze photo.", variant: "destructive" });
                          setPhotoPreview(null);
                        } finally {
                          setIsPhotoAnalyzing(false);
                        }
                      };
                      reader.readAsDataURL(file);
                      if (photoInputRef.current) photoInputRef.current.value = "";
                    }}
                    data-testid="input-photo-food-inline"
                  />

                  <input
                    ref={photoUploadRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 7 * 1024 * 1024) {
                        toast({ title: "Photo too large", description: "Please use a photo under 7MB.", variant: "destructive" });
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const base64 = reader.result as string;
                        setPhotoPreview(base64);
                        setIsPhotoAnalyzing(true);
                        setPhotoResults(null);
                        setPhotoMealType(selectedMealType);
                        try {
                          const res = await apiRequest("POST", "/api/nutrition/food/photo-analyze", { imageBase64: base64 });
                          const data = await res.json();
                          setPhotoResults({
                            items: data.items.map((item: any) => ({ ...item, selected: true, portionMultiplier: 1, baseCalories: item.calories, baseProtein: item.protein, baseCarbs: item.carbs, baseFat: item.fat, baseGrams: item.estimatedGrams || 0 })),
                            mealDescription: data.mealDescription,
                            overallConfidence: data.overallConfidence,
                          });
                        } catch (err: any) {
                          toast({ title: "Analysis failed", description: err.message || "Could not analyze photo.", variant: "destructive" });
                          setPhotoPreview(null);
                        } finally {
                          setIsPhotoAnalyzing(false);
                        }
                      };
                      reader.readAsDataURL(file);
                      if (photoUploadRef.current) photoUploadRef.current.value = "";
                    }}
                    data-testid="input-upload-photo-inline"
                  />

                  {!photoPreview && !photoResults && (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <Camera className="w-8 h-8 text-violet-500" />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">Take or upload a photo of your food for instant nutrition analysis</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => photoInputRef.current?.click()}
                          className="bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                          data-testid="button-take-photo-inline"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Take Photo
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => photoUploadRef.current?.click()}
                          data-testid="button-upload-photo-inline"
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          Upload
                        </Button>
                      </div>
                    </div>
                  )}

                  {photoPreview && (
                    <div className="relative rounded-xl overflow-hidden border border-border/50">
                      <img src={photoPreview} alt="Food" className="w-full max-h-48 object-cover" />
                      {isPhotoAnalyzing && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                          <div className="text-center">
                            <Loader2 className="w-8 h-8 text-violet-400 animate-spin mx-auto mb-2" />
                            <p className="text-sm text-white font-medium">Analyzing food...</p>
                            <p className="text-xs text-white/60 mt-1">Identifying items and nutrition</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {photoResults && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{photoResults.mealDescription}</p>
                        <Badge variant="outline" className={
                          photoResults.overallConfidence === 'high' ? 'border-green-500/30 text-green-600 bg-green-500/5' :
                          photoResults.overallConfidence === 'medium' ? 'border-amber-500/30 text-amber-600 bg-amber-500/5' :
                          'border-red-500/30 text-red-600 bg-red-500/5'
                        }>
                          {photoResults.overallConfidence} confidence
                        </Badge>
                      </div>

                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {photoResults.items.map((item, i) => (
                          <div key={i} className="space-y-1">
                            <div
                              className={cn("flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer", item.selected ? "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800" : "bg-muted/30 border-border/30 opacity-60")}
                              onClick={() => {
                                setPhotoResults(prev => prev ? {
                                  ...prev,
                                  items: prev.items.map((it, idx) => idx === i ? { ...it, selected: !it.selected } : it)
                                } : null);
                              }}
                              data-testid={`photo-item-inline-${i}`}
                            >
                              <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0", item.selected ? "border-violet-500 bg-violet-500" : "border-muted-foreground/30")}>
                                {item.selected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.servingSize}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-sm">{item.calories} cal</p>
                                <p className="text-[10px] text-muted-foreground">P:{item.protein}g C:{item.carbs}g F:{item.fat}g</p>
                              </div>
                            </div>
                            {item.selected && (
                              <div className="flex items-center gap-1.5 ml-8">
                                <span className="text-[10px] text-muted-foreground mr-auto">Portion:</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => {
                                    setPhotoResults(prev => prev ? {
                                      ...prev,
                                      items: prev.items.map((it, idx) => {
                                        if (idx !== i) return it;
                                        const newMult = Math.max(0.25, (it.portionMultiplier || 1) - 0.25);
                                        return { ...it, portionMultiplier: newMult, calories: Math.round(it.baseCalories * newMult), protein: Math.round(it.baseProtein * newMult), carbs: Math.round(it.baseCarbs * newMult), fat: Math.round(it.baseFat * newMult), estimatedGrams: Math.round(it.baseGrams * newMult) };
                                      })
                                    } : null);
                                  }}
                                  data-testid={`inline-portion-decrease-${i}`}
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </Button>
                                <span className="text-[11px] font-medium w-8 text-center">{item.portionMultiplier || 1}x</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-5 w-5 rounded-full"
                                  onClick={() => {
                                    setPhotoResults(prev => prev ? {
                                      ...prev,
                                      items: prev.items.map((it, idx) => {
                                        if (idx !== i) return it;
                                        const newMult = Math.min(5, (it.portionMultiplier || 1) + 0.25);
                                        return { ...it, portionMultiplier: newMult, calories: Math.round(it.baseCalories * newMult), protein: Math.round(it.baseProtein * newMult), carbs: Math.round(it.baseCarbs * newMult), fat: Math.round(it.baseFat * newMult), estimatedGrams: Math.round(it.baseGrams * newMult) };
                                      })
                                    } : null);
                                  }}
                                  data-testid={`inline-portion-increase-${i}`}
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">{photoResults.items.filter(i => i.selected).reduce((s, i) => s + i.calories, 0)} cal</span>
                          {' '}
                          <span className="text-xs">
                            P:{photoResults.items.filter(i => i.selected).reduce((s, i) => s + i.protein, 0)}g{' '}
                            C:{photoResults.items.filter(i => i.selected).reduce((s, i) => s + i.carbs, 0)}g{' '}
                            F:{photoResults.items.filter(i => i.selected).reduce((s, i) => s + i.fat, 0)}g
                          </span>
                        </div>
                        <Button
                          size="sm"
                          disabled={!photoResults.items.some(i => i.selected) || logPhotoFoodsMutation.isPending}
                          onClick={() => logPhotoFoodsMutation.mutate(photoResults.items)}
                          className="bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                          data-testid="button-log-photo-items-inline"
                        >
                          {logPhotoFoodsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
                          Log {photoResults.items.filter(i => i.selected).length} Items
                        </Button>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => { setPhotoPreview(null); setPhotoResults(null); }}
                        data-testid="button-retake-photo-inline"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1.5" />
                        Try Another Photo
                      </Button>
                    </div>
                  )}
                </div>
              ) : foodMode === "recent" ? (
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
                          credentials: "include",
                          body: JSON.stringify({ 
                            description: searchQuery,
                            restaurant: restaurantName.trim() || undefined,
                          }),
                        });
                        if (res.status === 403) {
                          const errData = await res.json();
                          if (errData?.code === "AI_CONSENT_REQUIRED") {
                            window.dispatchEvent(new CustomEvent("ai-consent-required"));
                          } else {
                            toast({ title: "Permission denied", variant: "destructive" });
                          }
                          setIsSearching(false);
                          return;
                        }
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

              {portionCategory && !foodTypePresets && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Hand className="w-3.5 h-3.5" />
                    How much did you eat? ({portionCategory.name})
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {portionCategory.portions.map((p, idx) => {
                      const isActive = selectedPortionIdx === idx;
                      return (
                        <button
                          key={idx}
                          className={cn(
                            "px-2.5 py-2 rounded-lg border text-left transition-colors",
                            isActive ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                          )}
                          onClick={() => {
                            setSelectedPortionIdx(idx);
                            const defaultGrams = portionCategory.portions[portionCategory.defaultPortionIndex].gramsEstimate;
                            const mult = p.gramsEstimate / defaultGrams;
                            setQuantity(String(Math.round(mult * 100) / 100));
                          }}
                          data-testid={`button-portion-${idx}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{p.emoji}</span>
                            <div>
                              <p className="text-sm font-medium">{p.label}</p>
                              <p className="text-[10px] text-muted-foreground">{p.description}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">Tap a size to set your portion automatically</p>
                </div>
              )}

              {foodTypePresets ? (
                <div className="space-y-3">
                  {(foodTypePresets.countOptions && foodTypePresets.countUnit) && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        How many {foodTypePresets.countUnit}?
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {foodTypePresets.countOptions.map((count) => {
                          const isActive = String(count) === quantity;
                          return (
                            <Badge
                              key={count}
                              variant={isActive ? "default" : "outline"}
                              className={`cursor-pointer text-xs toggle-elevate ${isActive ? 'toggle-elevated' : ''}`}
                              onClick={() => setQuantity(String(count))}
                              data-testid={`button-count-${count}`}
                            >
                              {count}
                            </Badge>
                          );
                        })}
                        {foodTypePresets.countUnit && (
                          <span className="text-xs text-muted-foreground self-center ml-0.5">{foodTypePresets.countUnit}</span>
                        )}
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            className="w-16 h-7 text-xs text-center"
                            data-testid="input-quantity-custom"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {foodTypePresets.sizeOptions && foodTypePresets.sizeOptions.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Size</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {foodTypePresets.sizeOptions.map((size, idx) => {
                          const isActive = selectedSizeMultiplier === size.multiplier;
                          return (
                            <Badge
                              key={idx}
                              variant={isActive ? "default" : "outline"}
                              className={`cursor-pointer text-xs toggle-elevate ${isActive ? 'toggle-elevated' : ''}`}
                              onClick={() => setSelectedSizeMultiplier(size.multiplier)}
                              data-testid={`button-size-${idx}`}
                            >
                              {size.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {foodTypePresets.styleOptions && foodTypePresets.styleOptions.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Type / Style</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {foodTypePresets.styleOptions.map((style, idx) => {
                          const isActive = selectedStyle === style;
                          return (
                            <Badge
                              key={idx}
                              variant={isActive ? "default" : "outline"}
                              className={`cursor-pointer text-xs toggle-elevate ${isActive ? 'toggle-elevated' : ''}`}
                              onClick={() => setSelectedStyle(isActive ? null : style)}
                              data-testid={`button-style-${idx}`}
                            >
                              {style}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {!foodTypePresets.countOptions && !foodTypePresets.sizeOptions && (
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
                  )}

                  <p className="text-[10px] text-muted-foreground italic">
                    More detail = more accurate results
                  </p>
                </div>
              ) : (
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
              )}

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
                const sizeMult = foodTypePresets?.sizeOptions ? selectedSizeMultiplier : 1;
                const styleMult = (selectedStyle && foodTypePresets?.styleCalorieMultipliers?.[selectedStyle]) || 1;
                const effectiveQty = qty * sizeMult;
                const modCalories = selectedFood.commonModifiers 
                  ? Array.from(selectedModifiers).reduce((sum, idx) => sum + (selectedFood.commonModifiers![idx]?.calorieDelta || 0), 0)
                  : 0;
                const adjustedCals = Math.max(0, Math.round((selectedFood.nutrients.calories * styleMult + modCalories) * effectiveQty));
                return (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{adjustedCals}</div>
                  <div className="text-muted-foreground">Cal</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.protein || 0) * styleMult * effectiveQty)}g</div>
                  <div className="text-muted-foreground">Protein</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.carbs || 0) * styleMult * effectiveQty)}g</div>
                  <div className="text-muted-foreground">Carbs</div>
                </div>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{Math.round((selectedFood.nutrients.fat || 0) * styleMult * effectiveQty)}g</div>
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
    <Card className="card-glow-blue bg-card/60" data-testid="card-nutrition-analytics">
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
