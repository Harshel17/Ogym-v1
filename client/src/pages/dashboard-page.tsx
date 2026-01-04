import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useAttendance, usePayments, useMemberAttendance, useMemberPayments } from "@/hooks/use-gym";
import { useMemberStats, useTodayWorkout, useCompleteAllWorkouts, useCompleteWorkout, useMemberProfile, useShareWorkout } from "@/hooks/use-workouts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, CalendarCheck, TrendingUp, AlertCircle, CreditCard, Flame, Target, Calendar, CheckCircle2, Dumbbell, ChevronDown, ChevronUp, User2, Clock, ChevronLeft, ChevronRight, Check, Download } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Link, useLocation } from "wouter";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user } = useAuth();
  
  if (!user) return null;

  const greeting = getGreeting();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">
          {greeting}, {user.username}
        </h2>
        <p className="text-muted-foreground mt-1">
          {user.role === "owner" && "Here's your gym overview for today."}
          {user.role === "trainer" && "Track your members' progress and workouts."}
          {user.role === "member" && "Ready to crush your workout today?"}
        </p>
      </div>

      {user.role === "owner" && <OwnerDashboard />}
      {user.role === "trainer" && <TrainerDashboard />}
      {user.role === "member" && <MemberDashboard />}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, description }: any) {
  return (
    <Card className="dashboard-card border-none shadow-lg shadow-black/5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="p-2 bg-primary/10 rounded-full text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-display text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

type GymSubscription = {
  id: number;
  gymId: number;
  planType: string;
  amountPaid: number;
  paymentStatus: string;
  paidOn: string | null;
  validUntil: string | null;
  notes: string | null;
};

function OwnerDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: attendance = [] } = useAttendance();
  const { data: payments = [] } = usePayments();

  const { data: dashboardMetrics } = useQuery<{
    totalMembers: number;
    checkedInToday: number;
    checkedInYesterday: number;
    newEnrollmentsLast30Days: number;
    pendingPayments: number;
    totalRevenue: number;
  }>({
    queryKey: ["/api/owner/dashboard-metrics"]
  });

  const { data: gymSubscription } = useQuery<GymSubscription | null>({
    queryKey: ["/api/owner/gym-subscription"]
  });

  const attendanceList = attendance as any[];
  const paymentsList = payments as any[];

  const totalMembers = dashboardMetrics?.totalMembers || 0;
  const checkedInToday = dashboardMetrics?.checkedInToday || 0;
  const checkedInYesterday = dashboardMetrics?.checkedInYesterday || 0;
  const pendingPayments = dashboardMetrics?.pendingPayments || 0;
  const revenue = dashboardMetrics?.totalRevenue || 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return format(d, 'yyyy-MM-dd');
  }).reverse();

  const chartData = last7Days.map(date => ({
    date: format(new Date(date), 'MMM dd'),
    count: attendanceList.filter(a => a.date === date && a.status === 'present').length
  }));

  const handleCopyCode = () => {
    if (user?.gym?.code) {
      navigator.clipboard.writeText(user.gym.code);
    }
  };

  return (
    <div className="space-y-6">
      {user?.gym && (
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{user.gym.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">Share this code with trainers and members</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="bg-background border-2 border-primary rounded-lg px-4 py-2 font-mono font-bold text-lg text-primary">
                  {user.gym.code}
                </div>
                <button 
                  onClick={handleCopyCode}
                  className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
                  data-testid="button-copy-code"
                >
                  Copy Code
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {gymSubscription && (
        <Card className={`border-2 ${
          gymSubscription.paymentStatus === 'paid' 
            ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20' 
            : gymSubscription.paymentStatus === 'overdue'
            ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
            : 'border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20'
        }`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  gymSubscription.paymentStatus === 'paid'
                    ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                    : gymSubscription.paymentStatus === 'overdue'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
                    : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400'
                }`}>
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">OGym Platform Subscription</h4>
                  <p className="text-sm text-muted-foreground">
                    Plan: {gymSubscription.planType.replace('_', ' ')}
                    {gymSubscription.validUntil && ` | Valid until: ${format(new Date(gymSubscription.validUntil), 'PP')}`}
                  </p>
                </div>
              </div>
              <Badge className={
                gymSubscription.paymentStatus === 'paid'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : gymSubscription.paymentStatus === 'overdue'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
              }>
                {gymSubscription.paymentStatus.charAt(0).toUpperCase() + gymSubscription.paymentStatus.slice(1)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card 
          className="dashboard-card border-none shadow-lg shadow-black/5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 cursor-pointer hover-elevate"
          onClick={() => navigate("/owner/member-analytics")}
          data-testid="card-total-members"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Total Members
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-foreground">{totalMembers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Click to view analytics
            </p>
          </CardContent>
        </Card>
        <Card 
          className="dashboard-card border-none shadow-lg shadow-black/5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 cursor-pointer hover-elevate"
          onClick={() => navigate("/owner/attendance")}
          data-testid="card-checked-in-today"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Checked-in Today
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <CalendarCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-foreground">{checkedInToday}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Click to view analytics
            </p>
          </CardContent>
        </Card>
        <StatCard 
          title="Yesterday" 
          value={checkedInYesterday} 
          icon={Calendar} 
          description="Members checked in yesterday"
        />
        <Card 
          className="dashboard-card border-none shadow-lg shadow-black/5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 cursor-pointer hover-elevate"
          onClick={() => navigate("/payments")}
          data-testid="card-pending-payments"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Pending Payments
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-foreground">{pendingPayments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Unpaid invoices
            </p>
          </CardContent>
        </Card>
        <Card 
          className="dashboard-card border-none shadow-lg shadow-black/5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 cursor-pointer hover-elevate"
          onClick={() => navigate("/owner/revenue")}
          data-testid="card-revenue"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              This Month
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-foreground">{`₹${(revenue / 100).toLocaleString('en-IN')}`}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue collected this month
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Export Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <a href="/api/owner/export/members" download>
              <Button variant="outline" data-testid="button-export-members">
                <Download className="w-4 h-4 mr-2" />
                Export Members
              </Button>
            </a>
            <a href="/api/owner/export/payments" download>
              <Button variant="outline" data-testid="button-export-payments">
                <Download className="w-4 h-4 mr-2" />
                Export Payments
              </Button>
            </a>
            <a href="/api/owner/export/attendance" download>
              <Button variant="outline" data-testid="button-export-attendance">
                <Download className="w-4 h-4 mr-2" />
                Export Attendance
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 dashboard-card">
          <CardHeader>
            <CardTitle>Attendance Trends</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3 dashboard-card">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {attendanceList.slice(0, 5).map((record: any) => (
                <div key={record.id} className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold mr-3">
                    {record.member?.username?.slice(0, 2).toUpperCase() || '??'}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{record.member?.username || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">Checked in {record.date}</p>
                  </div>
                  <div className="ml-auto font-medium text-xs text-primary">
                    {record.verifiedMethod || record.status}
                  </div>
                </div>
              ))}
              {attendanceList.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type TrainerDashboardData = {
  totalMembers: number;
  activeWorkouts: number;
  starMembers: number;
  recentActivity: { memberName: string; action: string; date: string }[];
  memberProgress: { memberId: number; memberName: string; streak: number; lastWorkout: string | null }[];
};

function TrainerDashboard() {
  const { data: dashboardData } = useQuery<TrainerDashboardData>({
    queryKey: ["/api/trainer/dashboard"],
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["/api/trainer/members"],
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard 
          title="My Members" 
          value={dashboardData?.totalMembers || members.length || 0} 
          icon={Users} 
          description="Members assigned to you"
        />
        <StatCard 
          title="Active Programs" 
          value={dashboardData?.activeWorkouts || 0} 
          icon={Dumbbell} 
          description="Workout cycles in progress"
        />
        <StatCard 
          title="Star Members" 
          value={dashboardData?.starMembers || 0} 
          icon={Target} 
          description="Your starred members"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/workouts">
              <Button variant="outline" className="w-full justify-start" data-testid="link-create-workout">
                <Dumbbell className="w-4 h-4 mr-2" />
                Create Workout Program
              </Button>
            </Link>
            <Link href="/star-members">
              <Button variant="outline" className="w-full justify-start" data-testid="link-star-members">
                <Target className="w-4 h-4 mr-2" />
                View Star Members
              </Button>
            </Link>
            <Link href="/members">
              <Button variant="outline" className="w-full justify-start" data-testid="link-members">
                <Users className="w-4 h-4 mr-2" />
                View All Members
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Member Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-muted-foreground text-sm">No members assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {members.slice(0, 5).map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {member.username?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{member.username}</span>
                    </div>
                    <Link href={`/workouts`}>
                      <Button variant="ghost" size="sm" data-testid={`button-view-member-${member.id}`}>
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
                {members.length > 5 && (
                  <Link href="/members">
                    <Button variant="ghost" className="w-full text-sm text-primary" data-testid="link-view-all-members">
                      View all {members.length} members
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Member Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.memberName}</p>
                    <p className="text-xs text-muted-foreground">{activity.action}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dashboardData?.memberProgress && dashboardData.memberProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Member Streaks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.memberProgress
                .filter((m) => m.streak > 0)
                .sort((a, b) => b.streak - a.streak)
                .slice(0, 5)
                .map((member) => (
                <div key={member.memberId} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{member.memberName}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.lastWorkout ? `Last: ${member.lastWorkout}` : 'Active'}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    {member.streak} day streak
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type WorkoutSummary = {
  streak: number;
  totalWorkouts: number;
  last7DaysCount: number;
  thisMonthCount: number;
  calendarDays: { date: string; focusLabel: string }[];
};

function MemberDashboard() {
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [exerciseInputs, setExerciseInputs] = useState<Record<number, { sets: string; reps: string; weight: string }>>({});
  const [showMarkDoneDialog, setShowMarkDoneDialog] = useState(false);
  const [shareableAchievements, setShareableAchievements] = useState<{ type: string; label: string; metadata: Record<string, unknown> }[]>([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  
  const { data: attendance = [] } = useMemberAttendance();
  const { data: payments = [] } = useMemberPayments();
  const { data: stats } = useMemberStats();
  const { data: workoutSummary } = useQuery<WorkoutSummary>({
    queryKey: ["/api/member/workout/summary"],
  });
  const { data: todayWorkout, isLoading: workoutLoading } = useTodayWorkout();
  const { data: profile } = useMemberProfile();
  
  const handleAskToShare = (achievements: { type: string; label: string; metadata: Record<string, unknown> }[]) => {
    if (achievements.length > 0) {
      setShareableAchievements(achievements);
      setCurrentAchievementIndex(0);
    }
  };
  
  const completeAllMutation = useCompleteAllWorkouts(handleAskToShare);
  const completeWorkoutMutation = useCompleteWorkout();
  const shareWorkoutMutation = useShareWorkout();
  
  const currentAchievement = shareableAchievements[currentAchievementIndex];
  const showShareDialog = shareableAchievements.length > 0 && currentAchievementIndex < shareableAchievements.length;
  
  const handleShareOrSkip = (share: boolean) => {
    if (share && currentAchievement) {
      shareWorkoutMutation.mutate(currentAchievement);
    }
    if (currentAchievementIndex + 1 < shareableAchievements.length) {
      setCurrentAchievementIndex(currentAchievementIndex + 1);
    } else {
      setShareableAchievements([]);
      setCurrentAchievementIndex(0);
    }
  };
  
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  
  const markDayDoneMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/member/workout/day/${todayDate}/mark-done`);
    },
    onSuccess: () => {
      setShowMarkDoneDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/missed'] });
    }
  });

  const attendanceList = attendance as any[];
  const paymentsList = payments as any[];
  const memberStats = stats as any;
  const memberProfile = profile as any;
  const workoutItems = (todayWorkout as any)?.items || [];

  const attendedCount = attendanceList.length;
  const lastPayment = paymentsList[0];

  const workoutData = todayWorkout as any;
  const currentDayIndex = workoutData?.dayIndex ?? 0;
  const cycleLength = workoutData?.cycleLength ?? 3;
  const dayLabel = workoutData?.dayLabel || null;
  
  const muscleTypes = Array.from(new Set(workoutItems.map((i: any) => i.muscleType).filter(Boolean)));
  const muscleTypesDisplay = muscleTypes.length > 0 ? muscleTypes.join(" + ") : null;

  const allCompleted = workoutItems.length > 0 && workoutItems.every((i: any) => i.completed);
  const incompleteIds = workoutItems.filter((i: any) => !i.completed).map((i: any) => i.id);
  const completedCount = workoutItems.filter((i: any) => i.completed).length;

  const handleMarkAllDone = () => {
    if (incompleteIds.length > 0) {
      completeAllMutation.mutate({ workoutItemIds: incompleteIds });
    }
  };

  const handleInputChange = (itemId: number, field: 'sets' | 'reps' | 'weight', value: string) => {
    setExerciseInputs(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleCompleteExercise = (item: any) => {
    const inputs = exerciseInputs[item.id] || {};
    completeWorkoutMutation.mutate({
      workoutItemId: item.id,
      actualSets: inputs.sets ? parseInt(inputs.sets) : item.sets,
      actualReps: inputs.reps ? parseInt(inputs.reps) : item.reps,
      actualWeight: inputs.weight || item.weight || undefined
    });
    setExpandedItem(null);
  };

  const handleQuickComplete = (item: any) => {
    completeWorkoutMutation.mutate({
      workoutItemId: item.id,
      actualSets: item.sets,
      actualReps: item.reps,
      actualWeight: item.weight || undefined
    });
  };

  return (
    <div className="space-y-6">
      <Collapsible open={isWorkoutOpen} onOpenChange={setIsWorkoutOpen}>
        <Card className="workout-card overflow-hidden" data-testid="card-today-workout">
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between gap-2 cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="premium-gradient p-2.5 rounded-xl shadow-lg shadow-primary/25">
                  <Dumbbell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Today's Workout</CardTitle>
                  {workoutItems.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {dayLabel ? (
                        <span className="font-medium">{dayLabel}</span>
                      ) : (
                        <span>Day {currentDayIndex + 1} of {cycleLength}</span>
                      )}
                      {muscleTypesDisplay && (
                        <span className="ml-1 text-primary font-medium"> - {muscleTypesDisplay}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {workoutItems.length > 0 && (
                  <Badge 
                    variant={allCompleted ? "default" : "secondary"}
                    className={allCompleted ? "bg-green-500 hover:bg-green-600" : ""}
                  >
                    {allCompleted ? "Done" : `${completedCount}/${workoutItems.length}`}
                  </Badge>
                )}
                <div className="p-1.5 rounded-lg transition-colors group-hover:bg-muted">
                  {isWorkoutOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              {workoutLoading ? (
                <p className="text-muted-foreground text-center py-4">Loading...</p>
              ) : workoutItems.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">No workout scheduled for today.</p>
                  <Button 
                    variant="secondary"
                    onClick={() => setShowMarkDoneDialog(true)}
                    data-testid="button-mark-rest-day-done"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Mark Day as Done
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {workoutItems.map((item: any, index: number) => {
                    const isExpanded = expandedItem === item.id;
                    const inputs = exerciseInputs[item.id] || {};
                    
                    return (
                      <div 
                        key={item.id}
                        className={`rounded-lg border transition-colors ${
                          item.completed 
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                            : 'bg-muted/30 border-transparent'
                        }`}
                        data-testid={`workout-item-${item.id}`}
                      >
                        <div className="flex items-center gap-3 p-3">
                          <button
                            onClick={() => !item.completed && handleQuickComplete(item)}
                            disabled={item.completed || completeWorkoutMutation.isPending}
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                              item.completed 
                                ? 'bg-green-500 text-white cursor-default' 
                                : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                            }`}
                            data-testid={`button-quick-complete-${item.id}`}
                          >
                            {item.completed ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <span className="text-xs font-semibold">{index + 1}</span>
                            )}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                              {item.exerciseName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.sets}x{item.reps} {item.weight ? `@ ${item.weight}` : ''}
                            </p>
                          </div>

                          {!item.completed && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                              data-testid={`button-expand-${item.id}`}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {isExpanded && !item.completed && (
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/50 mt-1">
                            <p className="text-xs text-muted-foreground pt-2">Log your actual performance:</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Sets</label>
                                <Input
                                  type="number"
                                  placeholder={String(item.sets)}
                                  value={inputs.sets || ''}
                                  onChange={(e) => handleInputChange(item.id, 'sets', e.target.value)}
                                  className="h-9"
                                  data-testid={`input-sets-${item.id}`}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Reps</label>
                                <Input
                                  type="number"
                                  placeholder={String(item.reps)}
                                  value={inputs.reps || ''}
                                  onChange={(e) => handleInputChange(item.id, 'reps', e.target.value)}
                                  className="h-9"
                                  data-testid={`input-reps-${item.id}`}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Weight</label>
                                <Input
                                  type="text"
                                  placeholder={item.weight || '-'}
                                  value={inputs.weight || ''}
                                  onChange={(e) => handleInputChange(item.id, 'weight', e.target.value)}
                                  className="h-9"
                                  data-testid={`input-weight-${item.id}`}
                                />
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => handleCompleteExercise(item)}
                              disabled={completeWorkoutMutation.isPending}
                              data-testid={`button-complete-${item.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Complete with Custom Values
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!allCompleted && workoutItems.length > 1 && (
                    <Button 
                      variant="outline"
                      className="w-full mt-3"
                      onClick={handleMarkAllDone}
                      disabled={completeAllMutation.isPending}
                      data-testid="button-mark-all-done"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Complete All Remaining
                    </Button>
                  )}
                  
                  {!allCompleted && (
                    <Button 
                      variant="secondary"
                      className="w-full mt-2"
                      onClick={() => setShowMarkDoneDialog(true)}
                      data-testid="button-mark-day-done"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Mark Day as Done
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {workoutSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link href="/progress/workouts">
            <Card className="stat-card cursor-pointer group" data-testid="card-streak-link">
              <CardContent className="flex flex-col items-center justify-center py-5">
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white mb-3 shadow-lg shadow-orange-500/25 group-hover:scale-105 transition-transform">
                  <Flame className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold font-display">{workoutSummary.streak}</p>
                <p className="text-xs text-muted-foreground mt-1">Day Streak</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/progress/workouts">
            <Card className="stat-card cursor-pointer group" data-testid="card-total-link">
              <CardContent className="flex flex-col items-center justify-center py-5">
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white mb-3 shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
                  <Target className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold font-display">{workoutSummary.totalWorkouts}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Sessions</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/progress/workouts">
            <Card className="stat-card cursor-pointer group" data-testid="card-week-link">
              <CardContent className="flex flex-col items-center justify-center py-5">
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 text-white mb-3 shadow-lg shadow-green-500/25 group-hover:scale-105 transition-transform">
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold font-display">{workoutSummary.last7DaysCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Last 7 Days</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/progress/workouts">
            <Card className="stat-card cursor-pointer group" data-testid="card-month-link">
              <CardContent className="flex flex-col items-center justify-center py-5">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white mb-3 shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold font-display">{workoutSummary.thisMonthCount}</p>
                <p className="text-xs text-muted-foreground mt-1">This Month</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <MemberCalendarWidget />

      {memberProfile && (memberProfile.trainerName || memberProfile.cycleEndDate) && (
        <Card className="border-2 border-primary/10 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {memberProfile.trainerName && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full text-primary">
                    <User2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Trainer</p>
                    <p className="font-semibold text-foreground">{memberProfile.trainerName}</p>
                  </div>
                </div>
              )}
              {memberProfile.cycleEndDate && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full text-primary">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Cycle Ends</p>
                    <p className="font-semibold text-foreground">{memberProfile.cycleEndDate}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard 
          title="My Attendance" 
          value={attendedCount} 
          icon={CalendarCheck} 
          description="Total sessions logged"
        />
        <StatCard 
          title="Last Payment" 
          value={lastPayment ? `$${((lastPayment.amountPaid || 0) / 100).toFixed(2)}` : 'N/A'} 
          icon={CreditCard} 
          description={lastPayment ? `Status: ${lastPayment.status}` : 'No payment history'}
        />
      </div>

      <Dialog open={showMarkDoneDialog} onOpenChange={setShowMarkDoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Today as Done?</DialogTitle>
            <DialogDescription>
              {workoutItems.length > 0 ? (
                <>
                  You've completed {completedCount} of {workoutItems.length} exercises today.
                  {completedCount < workoutItems.length && (
                    <span className="block mt-2 text-muted-foreground">
                      Marking as done will count this as a completed workout day even though some exercises are incomplete.
                    </span>
                  )}
                </>
              ) : (
                "No workout was scheduled for today, but you can still mark the day as done if you did some activity."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMarkDoneDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => markDayDoneMutation.mutate()}
              disabled={markDayDoneMutation.isPending}
              data-testid="button-confirm-mark-done"
            >
              <Check className="w-4 h-4 mr-2" />
              {markDayDoneMutation.isPending ? "Marking..." : "Yes, Mark as Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showShareDialog} onOpenChange={(open) => { if (!open) handleShareOrSkip(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {currentAchievement?.type === "workout_completed" && "Share Your Workout?"}
              {currentAchievement?.type === "streak_milestone" && "Share Your Streak?"}
              {currentAchievement?.type === "achievement" && "Share Your Achievement?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {currentAchievement?.type === "workout_completed" && (
                <>You completed your <strong>{currentAchievement.label}</strong> workout! Share it with your gym community?</>
              )}
              {currentAchievement?.type === "streak_milestone" && (
                <>Amazing! You hit a <strong>{currentAchievement.label}</strong>! Share this milestone with your gym?</>
              )}
              {currentAchievement?.type === "achievement" && (
                <>Congrats on reaching <strong>{currentAchievement.label}</strong>! Share this achievement?</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleShareOrSkip(false)} data-testid="button-skip-share">Skip</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleShareOrSkip(true)}
              disabled={shareWorkoutMutation.isPending}
              data-testid="button-share-workout"
            >
              {shareWorkoutMutation.isPending ? "Sharing..." : "Share on Feed"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type CalendarDayData = {
  date: string;
  status: "present" | "absent" | "rest" | "future";
  completed: { name: string; sets: number; reps: number; weight: string | null }[];
  missed: { name: string; sets: number; reps: number; weight: string | null }[];
};

type DailyAnalytics = {
  date: string;
  totalExercises: number;
  completedCount: number;
  missedCount: number;
  totalVolume: number;
  muscleBreakdown: { muscle: string; count: number; volume: number }[];
  exercises: {
    name: string;
    muscle: string;
    sets: number;
    reps: number;
    weight: string | null;
    completed: boolean;
    volume: number;
  }[];
};

const MUSCLE_COLORS = [
  "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ec4899", 
  "#6366f1", "#14b8a6", "#f97316", "#22c55e", "#a855f7"
];

function MemberCalendarWidget() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [, navigate] = useLocation();
  
  const monthStr = format(currentMonth, "yyyy-MM");
  
  const { data: calendarData = [] } = useQuery<CalendarDayData[]>({
    queryKey: [`/api/me/calendar/enhanced?month=${monthStr}`],
  });

  const { data: dailyAnalytics, isLoading: analyticsLoading } = useQuery<DailyAnalytics>({
    queryKey: [`/api/me/workout/daily/${selectedDate}`],
    enabled: !!selectedDate,
  });

  const calendarMap = new Map(calendarData.map(d => [d.date, d]));
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const selectedDayData = selectedDate ? calendarMap.get(selectedDate) : null;

  const prevMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const handleDateClick = (dateStr: string) => {
    const dayData = calendarMap.get(dateStr);
    if (dayData && dayData.status !== "future") {
      setSelectedDate(dateStr);
    }
  };

  const getStatusStyles = (status: string, isTodayDate: boolean) => {
    const baseStyles = "p-2 text-sm rounded-md transition-colors relative";
    const todayRing = isTodayDate ? "ring-2 ring-primary" : "";
    
    switch (status) {
      case "present":
        return `${baseStyles} bg-green-500/20 text-green-700 dark:text-green-400 cursor-pointer hover:bg-green-500/30 ${todayRing}`;
      case "absent":
        return `${baseStyles} bg-red-500/20 text-red-700 dark:text-red-400 cursor-pointer hover:bg-red-500/30 ${todayRing}`;
      case "rest":
        return `${baseStyles} text-muted-foreground cursor-pointer hover:bg-muted/50 ${todayRing}`;
      case "future":
        return `${baseStyles} text-muted-foreground/50 cursor-default ${todayRing}`;
      default:
        return `${baseStyles} text-muted-foreground ${todayRing}`;
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "present":
        return <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full" />;
      case "absent":
        return <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full" />;
      default:
        return null;
    }
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k kg`;
    return `${volume.toFixed(0)} kg`;
  };

  return (
    <Card data-testid="card-calendar">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Workout Calendar
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-4 mb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-full" />
            <span>Missed</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
            <div key={day} className="text-xs text-muted-foreground font-medium py-1">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayData = calendarMap.get(dateStr);
            const status = dayData?.status || "rest";
            const isTodayDate = isToday(day);
            
            return (
              <button
                key={dateStr}
                onClick={() => handleDateClick(dateStr)}
                disabled={status === "future"}
                className={getStatusStyles(status, isTodayDate)}
                data-testid={`calendar-day-${dateStr}`}
              >
                {format(day, "d")}
                {getStatusDot(status)}
              </button>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              {selectedDate && format(new Date(selectedDate), "EEEE, MMMM d, yyyy")}
            </DialogTitle>
            <DialogDescription>
              {selectedDayData?.status === "present" && "Workout completed"}
              {selectedDayData?.status === "absent" && "Workout missed"}
              {selectedDayData?.status === "rest" && "Rest day"}
            </DialogDescription>
          </DialogHeader>
          
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : dailyAnalytics && dailyAnalytics.completedCount > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{dailyAnalytics.completedCount}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{dailyAnalytics.missedCount}</p>
                  <p className="text-xs text-muted-foreground">Missed</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-2xl font-bold">{formatVolume(dailyAnalytics.totalVolume)}</p>
                  <p className="text-xs text-muted-foreground">Volume</p>
                </div>
              </div>

              {dailyAnalytics.muscleBreakdown.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Muscle Groups Trained</h4>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dailyAnalytics.muscleBreakdown}
                            dataKey="count"
                            nameKey="muscle"
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={50}
                            paddingAngle={2}
                          >
                            {dailyAnalytics.muscleBreakdown.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={MUSCLE_COLORS[index % MUSCLE_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1">
                      {dailyAnalytics.muscleBreakdown.map((item, index) => (
                        <div key={item.muscle} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: MUSCLE_COLORS[index % MUSCLE_COLORS.length] }}
                            />
                            <span>{item.muscle}</span>
                          </div>
                          <span className="text-muted-foreground">{item.count} exercises</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Exercise Details</h4>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {dailyAnalytics.exercises.map((exercise, i) => (
                    <div 
                      key={i} 
                      className={`p-2 rounded-md text-sm flex items-center justify-between ${
                        exercise.completed 
                          ? 'bg-green-50 dark:bg-green-900/20' 
                          : 'bg-red-50 dark:bg-red-900/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {exercise.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        <div>
                          <span className="font-medium">{exercise.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">({exercise.muscle})</span>
                        </div>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {exercise.sets}x{exercise.reps} {exercise.weight ? `@ ${exercise.weight}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : selectedDayData?.status === "absent" ? (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
                <p className="font-medium">Workout was scheduled but not completed</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedDayData.missed.length} exercises were missed
                </p>
              </div>
              {selectedDayData.missed.length > 0 && (
                <div className="space-y-1">
                  {selectedDayData.missed.map((exercise, i) => (
                    <div key={i} className="p-2 bg-red-50 dark:bg-red-900/20 rounded-md text-sm flex items-center justify-between">
                      <span className="font-medium">{exercise.name}</span>
                      <span className="text-muted-foreground">
                        {exercise.sets}x{exercise.reps} {exercise.weight ? `@ ${exercise.weight}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No workout was scheduled for this day.</p>
            </div>
          )}
          
          <Button 
            className="w-full" 
            variant="outline"
            onClick={() => navigate("/progress/workouts")}
            data-testid="button-view-history"
          >
            View Full Workout History
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
