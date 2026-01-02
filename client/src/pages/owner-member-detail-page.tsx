import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Dumbbell, Calendar, TrendingUp, Flame, Target, BarChart3 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

type MemberProfile = {
  id: number;
  username: string;
  publicId: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  trainerName: string | null;
  cycleName: string | null;
  cycleEndDate: string | null;
};

type WorkoutSession = {
  date: string;
  title: string;
  exercises: {
    completionId: number;
    exerciseName: string;
    muscleType: string;
    sets: number;
    reps: number;
    weight: string | null;
    actualSets: number | null;
    actualReps: number | null;
    actualWeight: string | null;
    notes: string | null;
  }[];
};

type MemberStats = {
  streak: number;
  totalWorkouts: number;
  last7Days: number;
  thisMonth: number;
  muscleGroupBreakdown: { name: string; count: number; percentage: number }[];
  volumeStats: { totalSets: number; totalReps: number; totalVolume: number };
  weeklyTrend: { week: string; count: number }[];
  progress: {
    exerciseName: string;
    muscleType: string;
    history: { date: string; weight: string | null; reps: number | null }[];
    personalRecord: { weight: string | null; reps: number | null; date: string } | null;
  }[];
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function OwnerMemberDetailPage() {
  const params = useParams<{ memberId: string }>();
  const memberId = parseInt(params.memberId || "0");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<MemberProfile>({
    queryKey: ["/api/owner/members", memberId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: workouts = [], isLoading: workoutsLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/owner/members", memberId, "workouts"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/workouts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workouts");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: stats, isLoading: statsLoading } = useQuery<MemberStats>({
    queryKey: ["/api/owner/members", memberId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: sessionDetail } = useQuery<WorkoutSession>({
    queryKey: ["/api/owner/members", memberId, "workouts", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/workouts/${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
    enabled: !!selectedDate
  });

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <p className="text-lg text-muted-foreground">Member not found or access denied</p>
        <Link href="/members">
          <Button variant="outline" className="mt-4">Back to Members</Button>
        </Link>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = stats?.progress || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/members">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{profile?.username}</h2>
          <p className="text-sm text-muted-foreground">{profile?.publicId || "No ID"}</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          <TabsTrigger value="workouts" data-testid="tab-workouts">Workouts</TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Member Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="font-medium">{profile?.username}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Public ID</p>
                  <p className="font-medium">{profile?.publicId || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile?.email || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile?.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trainer</p>
                  <p className="font-medium">{profile?.trainerName || "Not assigned"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Cycle</p>
                  <p className="font-medium">{profile?.cycleName || "None"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workouts" className="mt-4">
          {workoutsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : workouts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No workout history
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {workouts.map((session) => (
                <Card 
                  key={session.date} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedDate(session.date)}
                  data-testid={`session-${session.date}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Dumbbell className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{session.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(session.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{session.exercises.length} exercises</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-4 space-y-6">
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <span className="text-sm text-muted-foreground">Streak</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{stats?.streak || 0} days</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Total</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{stats?.totalWorkouts || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-muted-foreground">Last 7 Days</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{stats?.last7Days || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                      <span className="text-sm text-muted-foreground">This Month</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{stats?.thisMonth || 0}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Weekly Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.weeklyTrend || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Muscle Group Focus</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats?.muscleGroupBreakdown || []}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={({ name, percentage }) => `${name} ${percentage}%`}
                          >
                            {(stats?.muscleGroupBreakdown || []).map((_, idx) => (
                              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {progress.length > 0 && progress.some(p => p.personalRecord) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Records</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {progress
                        .filter(p => p.personalRecord)
                        .slice(0, 6)
                        .map((p) => (
                          <div key={p.exerciseName} className="p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium text-sm">{p.exerciseName}</p>
                            <p className="text-xs text-muted-foreground mb-1">{p.muscleType}</p>
                            <p className="text-lg font-bold">
                              {p.personalRecord?.weight || "-"} kg x {p.personalRecord?.reps || "-"}
                            </p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {sessionDetail?.title || "Workout Session"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedDate && format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {sessionDetail?.exercises.map((exercise, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium">{exercise.exerciseName}</p>
                    <Badge variant="outline" className="text-xs">{exercise.muscleType}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground text-xs">Sets</p>
                    <p className="font-medium">{exercise.actualSets ?? exercise.sets}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground text-xs">Reps</p>
                    <p className="font-medium">{exercise.actualReps ?? exercise.reps}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground text-xs">Weight</p>
                    <p className="font-medium">{exercise.actualWeight || exercise.weight || "-"}</p>
                  </div>
                </div>
                {exercise.notes && (
                  <p className="text-sm text-muted-foreground mt-2 italic">Note: {exercise.notes}</p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
