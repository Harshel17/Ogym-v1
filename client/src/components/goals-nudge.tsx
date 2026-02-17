import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import type { UserGoal } from "@shared/schema";
import { useState, useEffect } from "react";

export function GoalsNudge() {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const { data: goals, isLoading } = useQuery<UserGoal | null>({
    queryKey: ["/api/user/goals"],
  });

  useEffect(() => {
    const key = "goals_nudge_dismissed";
    const val = localStorage.getItem(key);
    if (val) {
      const ts = parseInt(val);
      if (Date.now() - ts < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, []);

  if (isLoading || dismissed) return null;

  const hasGoals = goals && (goals.primaryGoal || goals.targetWeight || goals.dailyCalorieTarget || goals.dailyProteinTarget || goals.weeklyWorkoutDays || goals.customGoalText);
  if (hasGoals) return null;

  const handleDismiss = () => {
    localStorage.setItem("goals_nudge_dismissed", Date.now().toString());
    setDismissed(true);
  };

  return (
    <Card className="border-dashed border-primary/30" data-testid="card-goals-nudge">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Set your fitness goals</p>
            <p className="text-xs text-muted-foreground">Get personalized coaching from Dika and smarter performance reports</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-xs text-muted-foreground"
              data-testid="button-dismiss-goals-nudge"
            >
              Later
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/goals")}
              data-testid="button-set-goals"
            >
              Set Goals
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
