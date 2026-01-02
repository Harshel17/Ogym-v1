import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Shield, Flame, Target, Calendar, Dumbbell, TrendingUp, BarChart3, Loader2, ChevronDown, ChevronUp, CalendarDays } from "lucide-react";
import { Link } from "wouter";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { format, parseISO } from "date-fns";

type MemberStats = {
  streak: number;
  totalWorkouts: number;
  last7Days: number;
  thisMonth: number;
  muscleGroupBreakdown: { name: string; count: number; percentage: number }[];
  volumeStats: {
    totalSets: number;
    totalReps: number;
    totalVolume: number;
  };
  weeklyTrend: { week: string; count: number }[];
};

type DailyWorkout = {
  date: string;
  muscleGroups: string[];
  exerciseCount: number;
  exercises: { name: string; muscleType: string; sets: number | null; reps: number | null; weight: string | null }[];
};

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316'];

export default function StatsPage() {
  const { user } = useAuth();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const { data: stats, isLoading } = useQuery<MemberStats>({
    queryKey: ["/api/me/stats"],
  });

  const { data: dailyWorkouts = [] } = useQuery<DailyWorkout[]>({
    queryKey: ["/api/me/workouts/daily"],
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
      <div className="flex flex-col items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground mt-2">Loading your stats...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/progress">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">My Stats</h2>
          <p className="text-muted-foreground text-sm">Your workout analytics and progress</p>
        </div>
      </div>

      {!stats || stats.totalWorkouts === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No stats yet</h3>
            <p className="text-muted-foreground mt-2">Complete some workouts to see your statistics!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card data-testid="card-streak">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Flame className="w-10 h-10 text-orange-500 mb-2" />
                <p className="text-3xl font-bold">{stats.streak}</p>
                <p className="text-xs text-muted-foreground text-center">Day Streak</p>
              </CardContent>
            </Card>
            <Card data-testid="card-total">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Target className="w-10 h-10 text-blue-500 mb-2" />
                <p className="text-3xl font-bold">{stats.totalWorkouts}</p>
                <p className="text-xs text-muted-foreground text-center">Total Workouts</p>
              </CardContent>
            </Card>
            <Card data-testid="card-week">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Calendar className="w-10 h-10 text-green-500 mb-2" />
                <p className="text-3xl font-bold">{stats.last7Days}</p>
                <p className="text-xs text-muted-foreground text-center">Days (Last 7)</p>
              </CardContent>
            </Card>
            <Card data-testid="card-month">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <CalendarDays className="w-10 h-10 text-purple-500 mb-2" />
                <p className="text-3xl font-bold">{stats.thisMonth}</p>
                <p className="text-xs text-muted-foreground text-center">Days (This Month)</p>
              </CardContent>
            </Card>
          </div>

          {stats.volumeStats && stats.volumeStats.totalSets > 0 && (
            <Card data-testid="card-volume">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Volume Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{stats.volumeStats.totalSets}</p>
                    <p className="text-sm text-muted-foreground">Total Sets</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{stats.volumeStats.totalReps}</p>
                    <p className="text-sm text-muted-foreground">Total Reps</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{stats.volumeStats.totalVolume.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Total Volume</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {stats.muscleGroupBreakdown && stats.muscleGroupBreakdown.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card data-testid="card-muscle-chart">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Muscle Group Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.muscleGroupBreakdown}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percentage }) => `${name} ${percentage}%`}
                        >
                          {stats.muscleGroupBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-muscle-list">
                <CardHeader>
                  <CardTitle>Sessions by Muscle Group</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats.muscleGroupBreakdown.map((group, index) => (
                    <div key={group.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium">{group.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{group.count}</Badge>
                          <span className="text-sm text-muted-foreground">{group.percentage}%</span>
                        </div>
                      </div>
                      <Progress value={group.percentage} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {stats.weeklyTrend && stats.weeklyTrend.length > 0 && (
            <Card data-testid="card-weekly-trend">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Weekly Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="week" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {dailyWorkouts.length > 0 && (
            <Card data-testid="card-workout-history">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  Workout History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dailyWorkouts.map((day) => {
                  const isExpanded = expandedDate === day.date;
                  return (
                    <Collapsible
                      key={day.date}
                      open={isExpanded}
                      onOpenChange={() => setExpandedDate(isExpanded ? null : day.date)}
                    >
                      <CollapsibleTrigger asChild>
                        <div
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover-elevate"
                          data-testid={`workout-day-${day.date}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <CalendarDays className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {format(parseISO(day.date), "EEEE, MMM d, yyyy")}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {day.muscleGroups.join(" + ")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{day.exerciseCount} exercises</Badge>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 ml-4 space-y-2 border-l-2 border-muted pl-4">
                          {day.exercises.map((exercise, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 rounded bg-background"
                              data-testid={`exercise-${day.date}-${idx}`}
                            >
                              <div>
                                <p className="font-medium text-sm">{exercise.name}</p>
                                <p className="text-xs text-muted-foreground">{exercise.muscleType}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {exercise.sets || "-"}x{exercise.reps || "-"}
                                </p>
                                {exercise.weight && (
                                  <p className="text-xs text-muted-foreground">@ {exercise.weight}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
