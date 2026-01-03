import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertCircle, Calendar, Dumbbell, Clock, Trophy } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";

type MissedWorkout = {
  date: string;
  dayLabel: string;
  completedCount: number;
  totalCount: number;
  status: "missed" | "partial";
  missedExercises: string[];
};

export default function MissedWorkoutsPage() {
  const { data: missedWorkouts = [], isLoading } = useQuery<MissedWorkout[]>({
    queryKey: ["/api/member/workout/missed"],
  });

  const fullyMissed = missedWorkouts.filter(d => d.status === "missed");
  const partialMissed = missedWorkouts.filter(d => d.status === "partial");

  // Calculate total missed points
  const totalMissedPoints = missedWorkouts.reduce((sum, d) => sum + (d.totalCount - d.completedCount), 0);
  const totalPlannedPoints = missedWorkouts.reduce((sum, d) => sum + d.totalCount, 0);
  const totalEarnedPoints = missedWorkouts.reduce((sum, d) => sum + d.completedCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/progress">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Missed Workouts</h2>
          <p className="text-muted-foreground text-sm">
            Track workouts you skipped or didn't complete
          </p>
        </div>
      </div>

      {!isLoading && missedWorkouts.length > 0 && (
        <Card data-testid="card-missed-points-summary">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="font-semibold">Missed Points Summary</p>
                <p className="text-sm text-muted-foreground">
                  {fullyMissed.length} day{fullyMissed.length !== 1 ? "s" : ""} missed, {partialMissed.length} partial
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-red-500">-{totalMissedPoints}</p>
              <p className="text-sm text-muted-foreground">{totalEarnedPoints}/{totalPlannedPoints} earned</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      ) : missedWorkouts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <Dumbbell className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg">No Missed Workouts!</h3>
            <p className="text-muted-foreground mt-2">
              Great job! You haven't missed any workout days in your current cycle.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {fullyMissed.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Fully Missed Days
                  <Badge variant="secondary" className="ml-2">
                    {fullyMissed.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {fullyMissed.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between p-4 rounded-lg border bg-red-500/5"
                    data-testid={`missed-day-${day.date}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {day.dayLabel} - {day.totalCount} pts missed
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">
                      Missed
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {partialMissed.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Partial Completions
                  <Badge variant="secondary" className="ml-2">
                    {partialMissed.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {partialMissed.map((day) => (
                  <div
                    key={day.date}
                    className="p-4 rounded-lg border bg-yellow-500/5"
                    data-testid={`partial-day-${day.date}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {day.dayLabel}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
                        {day.completedCount}/{day.totalCount} pts
                      </Badge>
                    </div>
                    {day.missedExercises.length > 0 && (
                      <div className="mt-3 pl-13">
                        <p className="text-xs text-muted-foreground mb-1">Missed exercises:</p>
                        <div className="flex flex-wrap gap-1">
                          {day.missedExercises.map((ex, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {ex}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="flex justify-center">
        <Link href="/progress/workouts">
          <Button variant="outline" data-testid="button-view-schedule">
            <Calendar className="w-4 h-4 mr-2" />
            View Full Schedule
          </Button>
        </Link>
      </div>
    </div>
  );
}
