import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, BarChart3, Shield, ChevronRight, AlertCircle, Target } from "lucide-react";
import { Link } from "wouter";

export default function ProgressPage() {
  const { user } = useAuth();

  if (user?.role !== "member") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Members Only</h2>
        <p className="text-muted-foreground">This page is only for gym members.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">My Progress</h2>
        <p className="text-muted-foreground mt-1">Track your workout history and view your stats.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link href="/progress/workouts">
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 h-full" data-testid="card-my-workouts">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Dumbbell className="w-8 h-8 text-primary" />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardTitle className="mt-4">My Workouts</CardTitle>
              <CardDescription>
                View your workout history by date. See exercises, edit sets, reps, and weights.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" data-testid="button-view-workouts">
                View Workout History
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/progress/stats">
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 h-full" data-testid="card-view-stats">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <BarChart3 className="w-8 h-8 text-green-500" />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardTitle className="mt-4">View My Stats</CardTitle>
              <CardDescription>
                Muscle group breakdown, workout streak, volume metrics, and trends.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" data-testid="button-view-stats">
                View Statistics
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/progress/missed">
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-red-500/50 h-full" data-testid="card-missed-workouts">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardTitle className="mt-4">Missed Workouts</CardTitle>
              <CardDescription>
                Track which workout days you skipped or missed from your cycle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" data-testid="button-view-missed">
                View Missed Days
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/progress/phases">
          <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-purple-500/50 h-full" data-testid="card-training-phases">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-3 bg-purple-500/10 rounded-lg">
                  <Target className="w-8 h-8 text-purple-500" />
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <CardTitle className="mt-4">Training Phases</CardTitle>
              <CardDescription>
                View your training phases set by your trainer with goals and progress.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" data-testid="button-view-phases">
                View Training Phases
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
