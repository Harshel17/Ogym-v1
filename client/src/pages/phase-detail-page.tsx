import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Target, Calendar, Dumbbell, 
  Loader2, Shield, TrendingUp, CheckCircle2, Flame, Activity, Scale
} from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval, isPast, isFuture } from "date-fns";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

type TrainingPhase = {
  id: number;
  name: string;
  goalType: string;
  startDate: string;
  endDate: string;
  cycleId: number;
  cycleName: string | null;
  notes: string | null;
  memberId: number;
  gymId: number;
};

type PhaseAnalytics = {
  attendanceDays: number;
  totalDays: number;
  totalPoints: number;
  avgPointsPerDay: number;
  totalWorkouts: number;
  startWeight: number | null;
  endWeight: number | null;
  weightChange: number | null;
  pointsTrend: { date: string; points: number }[];
  weightTrend: { date: string; weight: number }[];
};

const goalTypeLabels: Record<string, string> = {
  cut: "Cut (Fat Loss)",
  bulk: "Bulk (Muscle Gain)",
  strength: "Strength",
  endurance: "Endurance",
  rehab: "Rehabilitation",
  general: "General Fitness"
};

const goalTypeColors: Record<string, string> = {
  cut: "bg-red-500/10 text-red-700 dark:text-red-400",
  bulk: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  strength: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  endurance: "bg-green-500/10 text-green-700 dark:text-green-400",
  rehab: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  general: "bg-gray-500/10 text-gray-700 dark:text-gray-400"
};

function getPhaseStatus(startDate: string, endDate: string): { label: string; color: string } {
  const today = new Date();
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  if (isWithinInterval(today, { start, end })) {
    return { label: "Active", color: "bg-green-500/10 text-green-700 dark:text-green-400" };
  } else if (isPast(end)) {
    return { label: "Completed", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" };
  } else if (isFuture(start)) {
    return { label: "Upcoming", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" };
  }
  return { label: "Unknown", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" };
}

export default function PhaseDetailPage() {
  const { user } = useAuth();
  const { phaseId } = useParams();

  const { data: phase, isLoading: phaseLoading } = useQuery<TrainingPhase>({
    queryKey: ["/api/training-phases", phaseId],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<PhaseAnalytics>({
    queryKey: ["/api/training-phases", phaseId, "analytics"],
    enabled: !!phase,
  });

  if (user?.role !== "member" && user?.role !== "trainer" && user?.role !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  if (phaseLoading || analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!phase) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Target className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Phase Not Found</h2>
        <p className="text-muted-foreground">This training phase doesn't exist or you don't have access to it.</p>
        <Link href="/progress/phases">
          <Button variant="outline" className="mt-4">Back to Phases</Button>
        </Link>
      </div>
    );
  }

  const status = getPhaseStatus(phase.startDate, phase.endDate);
  const durationDays = differenceInDays(parseISO(phase.endDate), parseISO(phase.startDate)) + 1;
  const daysPassed = Math.min(
    Math.max(0, differenceInDays(new Date(), parseISO(phase.startDate)) + 1),
    durationDays
  );
  const progressPercent = Math.round((daysPassed / durationDays) * 100);

  const backUrl = user?.role === "member" ? "/progress/phases" : `/star-members/${phase.memberId}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={backUrl}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold font-display text-foreground">{phase.name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge className={goalTypeColors[phase.goalType] || goalTypeColors.general} data-testid="badge-goal-type">
              {goalTypeLabels[phase.goalType] || phase.goalType}
            </Badge>
            <Badge className={status.color} data-testid="badge-status">
              {status.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-duration">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-xl font-semibold">{durationDays} days</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {format(parseISO(phase.startDate), "MMM d")} - {format(parseISO(phase.endDate), "MMM d, yyyy")}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-progress">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-xl font-semibold">{progressPercent}%</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Day {daysPassed} of {durationDays}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-attendance">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Attendance</p>
                <p className="text-xl font-semibold">{analytics?.attendanceDays || 0} days</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {analytics?.totalDays ? Math.round((analytics.attendanceDays / analytics.totalDays) * 100) : 0}% attendance rate
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-points">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Flame className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-xl font-semibold">{analytics?.totalPoints || 0}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Avg {analytics?.avgPointsPerDay?.toFixed(1) || 0} pts/day
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {phase.cycleName && (
          <Card data-testid="card-workout-cycle">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Dumbbell className="w-5 h-5" />
                Linked Workout Cycle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{phase.cycleName}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {analytics?.totalWorkouts || 0} workout sessions completed during this phase
              </p>
            </CardContent>
          </Card>
        )}

        {(analytics?.startWeight || analytics?.endWeight) && (
          <Card data-testid="card-weight-change">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="w-5 h-5" />
                Weight Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {analytics?.startWeight && (
                  <div>
                    <p className="text-sm text-muted-foreground">Start</p>
                    <p className="text-xl font-semibold">{analytics.startWeight} kg</p>
                  </div>
                )}
                {analytics?.endWeight && (
                  <div>
                    <p className="text-sm text-muted-foreground">Current</p>
                    <p className="text-xl font-semibold">{analytics.endWeight} kg</p>
                  </div>
                )}
                {analytics?.weightChange !== null && analytics?.weightChange !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">Change</p>
                    <p className={`text-xl font-semibold ${analytics.weightChange < 0 ? 'text-green-600 dark:text-green-400' : analytics.weightChange > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {analytics.weightChange > 0 ? '+' : ''}{analytics.weightChange} kg
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {phase.notes && (
        <Card data-testid="card-notes">
          <CardHeader>
            <CardTitle className="text-lg">Trainer Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{phase.notes}</p>
          </CardContent>
        </Card>
      )}

      {analytics?.pointsTrend && analytics.pointsTrend.length > 0 && (
        <Card data-testid="card-points-chart">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Points Trend
            </CardTitle>
            <CardDescription>Daily workout points earned during this phase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.pointsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), "MMM d")}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                    formatter={(value: number) => [value, "Points"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="points" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {analytics?.weightTrend && analytics.weightTrend.length > 1 && (
        <Card data-testid="card-weight-chart">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Weight Trend
            </CardTitle>
            <CardDescription>Body weight measurements during this phase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.weightTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), "MMM d")}
                    className="text-xs"
                  />
                  <YAxis 
                    domain={['dataMin - 2', 'dataMax + 2']}
                    className="text-xs" 
                  />
                  <Tooltip 
                    labelFormatter={(val) => format(parseISO(val as string), "MMM d, yyyy")}
                    formatter={(value: number) => [`${value} kg`, "Weight"]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
