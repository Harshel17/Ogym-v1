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
  ChevronLeft, ChevronRight, Trash2, ScanLine, Target, X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, subDays } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { BarcodeScanner } from "@/components/barcode-scanner";

type CalorieGoal = {
  id: number;
  userId: number;
  dailyCalories: number;
  dailyProtein: number | null;
  dailyCarbs: number | null;
  dailyFat: number | null;
  goalType: string;
  isActive: boolean;
  createdAt: string;
};

type FoodLog = {
  id: number;
  userId: number;
  date: string;
  mealType: string;
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

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch", 
  dinner: "Dinner",
  snack: "Snack"
};

export default function NutritionPage() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [isAddFoodOpen, setIsAddFoodOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string>("breakfast");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodProduct | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [manualEntry, setManualEntry] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "" });
  const [showScanner, setShowScanner] = useState(false);
  const [isScanLookup, setIsScanLookup] = useState(false);

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

  const resetAddFood = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedFood(null);
    setQuantity("1");
    setManualEntry({ name: "", calories: "", protein: "", carbs: "", fat: "" });
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
    if (!manualEntry.name || !manualEntry.calories) {
      toast({ title: "Name and calories are required", variant: "destructive" });
      return;
    }
    logFoodMutation.mutate({
      date: dateStr,
      mealType: selectedMealType,
      foodName: manualEntry.name,
      quantity: 1,
      calories: parseInt(manualEntry.calories),
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

  const calorieGoal = goalData?.dailyCalories || 2000;
  const proteinGoal = goalData?.dailyProtein || 120;
  const carbsGoal = goalData?.dailyCarbs || 250;
  const fatGoal = goalData?.dailyFat || 65;

  const caloriePercent = Math.min((summary.calories / calorieGoal) * 100, 100);
  const proteinPercent = Math.min((summary.protein / proteinGoal) * 100, 100);
  const carbsPercent = Math.min((summary.carbs / carbsGoal) * 100, 100);
  const fatPercent = Math.min((summary.fat / fatGoal) * 100, 100);

  const remaining = calorieGoal - summary.calories;

  const groupedLogs = MEAL_TYPES.reduce((acc, meal) => {
    acc[meal] = foodLogs.filter(log => log.mealType === meal);
    return acc;
  }, {} as Record<string, FoodLog[]>);

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nutrition</h1>
        <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-set-goal">
              <Target className="w-4 h-4 mr-2" />
              Set Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
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

      <div className="flex items-center justify-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSelectedDate(subDays(selectedDate, 1))}
          data-testid="button-prev-day"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="text-lg font-medium min-w-[160px] text-center">
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
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-center">
              <div className="text-3xl font-bold">{summary.calories}</div>
              <div className="text-sm text-muted-foreground">Eaten</div>
            </div>
            <div className="relative w-24 h-24">
              <svg className="w-full h-full transform -rotate-90">
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
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${remaining < 0 ? "text-destructive" : ""}`}>
                {Math.abs(remaining)}
              </div>
              <div className="text-sm text-muted-foreground">
                {remaining >= 0 ? "Remaining" : "Over"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <MacroProgress label="Protein" value={summary.protein} goal={proteinGoal} percent={proteinPercent} icon={Beef} color="text-red-500" />
            <MacroProgress label="Carbs" value={summary.carbs} goal={carbsGoal} percent={carbsPercent} icon={Wheat} color="text-amber-500" />
            <MacroProgress label="Fat" value={summary.fat} goal={fatGoal} percent={fatPercent} icon={Droplet} color="text-blue-500" />
          </div>
        </CardContent>
      </Card>

      {MEAL_TYPES.map((meal) => (
        <Card key={meal}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{MEAL_LABELS[meal]}</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setSelectedMealType(meal); setIsAddFoodOpen(true); }}
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

      <Dialog open={isAddFoodOpen} onOpenChange={(open) => { setIsAddFoodOpen(open); if (!open) resetAddFood(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add to {MEAL_LABELS[selectedMealType]}</DialogTitle>
          </DialogHeader>
          
          {!selectedFood ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search foods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  data-testid="input-food-search"
                />
                <Button onClick={handleSearch} disabled={isSearching} data-testid="button-search-food">
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => { setIsAddFoodOpen(false); setShowScanner(true); }}
                  disabled={isScanLookup}
                  data-testid="button-scan-barcode"
                >
                  {isScanLookup ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {searchResults.map((product) => (
                    <button
                      key={product.barcode}
                      onClick={() => setSelectedFood(product)}
                      className="w-full p-3 text-left border rounded-lg hover-elevate"
                      data-testid={`button-select-food-${product.barcode}`}
                    >
                      <div className="flex items-center gap-3">
                        {product.imageUrl && (
                          <img src={product.imageUrl} alt="" className="w-10 h-10 object-contain rounded" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.nutrients.calories} cal per {product.servingSize || "100g"}
                            {product.brandName && ` · ${product.brandName}`}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Or add manually:</p>
                <div className="space-y-3">
                  <Input
                    placeholder="Food name"
                    value={manualEntry.name}
                    onChange={(e) => setManualEntry({ ...manualEntry, name: e.target.value })}
                    data-testid="input-manual-name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Calories"
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
                  <Button 
                    onClick={handleLogManual} 
                    disabled={logFoodMutation.isPending}
                    className="w-full"
                    data-testid="button-log-manual"
                  >
                    {logFoodMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Food"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                {selectedFood.imageUrl && (
                  <img src={selectedFood.imageUrl} alt="" className="w-16 h-16 object-contain rounded" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{selectedFood.name}</p>
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
    </div>
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
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <Progress value={percent} className="h-2 mb-1" />
      <div className="text-sm font-medium">{value}g</div>
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
    dailyCalories: currentGoal?.dailyCalories?.toString() || "2000",
    dailyProtein: currentGoal?.dailyProtein?.toString() || "120",
    dailyCarbs: currentGoal?.dailyCarbs?.toString() || "250",
    dailyFat: currentGoal?.dailyFat?.toString() || "65",
    goalType: currentGoal?.goalType || "maintain"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      dailyCalories: parseInt(formData.dailyCalories),
      dailyProtein: formData.dailyProtein ? parseInt(formData.dailyProtein) : null,
      dailyCarbs: formData.dailyCarbs ? parseInt(formData.dailyCarbs) : null,
      dailyFat: formData.dailyFat ? parseInt(formData.dailyFat) : null,
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
