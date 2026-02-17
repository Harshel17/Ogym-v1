import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Utensils, Shield, Loader2, Coffee, Sun, Moon, Apple } from "lucide-react";

type DietPlanMeal = {
  id: number;
  dayIndex: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  calories: number | null;
  protein: number | null;
  orderIndex: number;
};

type DietPlan = {
  id: number;
  title: string;
  durationWeeks: number;
  notes: string | null;
  isActive: boolean;
  meals: DietPlanMeal[];
};

const mealIcons = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Apple
};

const mealLabels = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack"
};

export default function MyDietPlanPage() {
  const { user } = useAuth();

  const { data: plans = [], isLoading } = useQuery<DietPlan[]>({
    queryKey: ["/api/member/diet-plans"]
  });

  if (user?.role !== "member") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Members Only</h2>
        <p className="text-muted-foreground">This page is only for gym members.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">My Diet Plan</h2>
          <p className="text-sm text-muted-foreground mt-1">Your personalized diet plan from your trainer.</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No Diet Plan Yet</h3>
            <p className="text-muted-foreground mt-2">
              Your trainer hasn't created a diet plan for you yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activePlan = plans.find(p => p.isActive) || plans[0];
  const dayNames = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
  const mealsByDay = groupMealsByDay(activePlan.meals);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display text-foreground">My Diet Plan</h2>
        <p className="text-sm text-muted-foreground mt-1">Your personalized diet plan from your trainer.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>{activePlan.title}</CardTitle>
              <CardDescription className="mt-1">
                {activePlan.durationWeeks} week program
              </CardDescription>
            </div>
            <Badge variant={activePlan.isActive ? "default" : "secondary"}>
              {activePlan.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          {activePlan.notes && (
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg mt-4">
              {activePlan.notes}
            </p>
          )}
        </CardHeader>
      </Card>

      {activePlan.meals.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No meals added to this plan yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="0" className="w-full">
          <TabsList className="w-full flex flex-wrap justify-start gap-1 h-auto bg-muted/50 p-1">
            {Object.keys(mealsByDay).map((dayIndex) => (
              <TabsTrigger key={dayIndex} value={dayIndex} className="flex-1 min-w-[80px]" data-testid={`tab-day-${dayIndex}`}>
                {dayNames[parseInt(dayIndex)] || `Day ${parseInt(dayIndex) + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {Object.entries(mealsByDay).map(([dayIndex, meals]) => (
            <TabsContent key={dayIndex} value={dayIndex} className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {(meals as DietPlanMeal[]).map((meal: DietPlanMeal) => {
                  const Icon = mealIcons[meal.mealType];
                  return (
                    <Card key={meal.id} data-testid={`card-meal-${meal.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="w-4 h-4 text-primary" />
                          </div>
                          <CardTitle className="text-base">{mealLabels[meal.mealType]}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm">{meal.description}</p>
                        {(meal.calories || meal.protein) && (
                          <div className="flex gap-3 text-sm">
                            {meal.calories && (
                              <Badge variant="outline">{meal.calories} cal</Badge>
                            )}
                            {meal.protein && (
                              <Badge variant="outline">{meal.protein}g protein</Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function groupMealsByDay(meals: DietPlanMeal[]): Record<number, DietPlanMeal[]> {
  return meals.reduce((acc, meal) => {
    if (!acc[meal.dayIndex]) {
      acc[meal.dayIndex] = [];
    }
    acc[meal.dayIndex].push(meal);
    return acc;
  }, {} as Record<number, DietPlanMeal[]>);
}
