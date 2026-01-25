import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMembers, useAttendance, usePayments, useMemberAttendance, useMemberPayments } from "@/hooks/use-gym";
import { useMemberStats, useTodayWorkout, useCompleteAllWorkouts, useCompleteWorkout, useMemberProfile, useShareWorkout, useSwapRestDay, useUndoRestDaySwap, useLogWorkoutSets } from "@/hooks/use-workouts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Users, CalendarCheck, TrendingUp, AlertCircle, CreditCard, Flame, Target, Calendar, CheckCircle2, Dumbbell, ChevronDown, ChevronUp, User2, Clock, ChevronLeft, ChevronRight, Check, Download, Loader2, Brain, AlertTriangle, Bell, ArrowRight, Shuffle, ArrowLeftRight, Moon } from "lucide-react";
import { useGymCurrency } from "@/hooks/use-gym-currency";
import { Switch } from "@/components/ui/switch";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
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
    <div className="space-y-8 page-enter">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-purple-500/10 dark:from-primary/20 dark:via-background dark:to-purple-500/20 p-6 md:p-8 animate-slide-in-up border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground">
            {greeting}, <span className="text-primary">{user.username}</span>
          </h2>
          <p className="text-muted-foreground mt-2 text-lg">
            {user.role === "owner" && "Here's your gym overview for today."}
            {user.role === "trainer" && "Track your members' progress and workouts."}
            {user.role === "member" && "Ready to crush your workout today?"}
          </p>
        </div>
      </div>

      {user.role === "owner" && <OwnerDashboard />}
      {user.role === "trainer" && <TrainerDashboard />}
      {user.role === "member" && <MemberDashboard />}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, description, delay = 0, onClick, color = "primary" }: any) {
  const colorClasses: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary",
    green: "from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400",
    red: "from-red-500/20 to-red-500/5 text-red-600 dark:text-red-400",
    purple: "from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400",
  };
  
  return (
    <Card 
      className={`group relative overflow-hidden border-0 shadow-lg shadow-black/5 bg-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1 animate-slide-in-up ${onClick ? 'cursor-pointer' : ''}`} 
      style={{ animationDelay: `${delay}ms` }}
      onClick={onClick}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color] || colorClasses.primary} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 relative z-10">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorClasses[color] || colorClasses.primary}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-bold font-display text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground mt-1.5">
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
  const { format: formatMoney } = useGymCurrency();

  // Get client's local date to handle timezone differences
  const getClientLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { data: dashboardMetrics } = useQuery<{
    totalMembers: number;
    checkedInToday: number;
    checkedInYesterday: number;
    newEnrollmentsLast30Days: number;
    pendingPayments: number;
    totalRevenue: number;
  }>({
    queryKey: ["/api/owner/dashboard-metrics", getClientLocalDate()],
    queryFn: async () => {
      const clientToday = getClientLocalDate();
      const res = await fetch(`/api/owner/dashboard-metrics?clientToday=${clientToday}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
      return res.json();
    }
  });

  const { data: gymSubscription } = useQuery<GymSubscription | null>({
    queryKey: ["/api/owner/gym-subscription"]
  });

  // AI Insights
  const { data: aiInsights } = useQuery<{
    churnRisk: { count: number; members: { id: number; name: string; daysAbsent: number; riskLevel: 'high' | 'medium' }[] };
    followUpReminders: { count: number; items: { type: string; memberId: number; name: string; message: string; priority: string }[] };
    memberInsights: { totalActive: number; newThisMonth: number; atRiskCount: number };
  }>({
    queryKey: [`/api/owner/ai-insights/${getClientLocalDate()}`]
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-purple-600 p-6 md:p-8 animate-slide-in-up shadow-xl shadow-primary/20" style={{ animationDelay: '100ms' }}>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-50" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div className="text-white">
              <h3 className="text-2xl font-bold">{user.gym.name}</h3>
              <p className="text-white/70 mt-1">Share this code with trainers and members</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl px-6 py-3 font-mono font-bold text-2xl text-white tracking-wider">
                {user.gym.code}
              </div>
              <button 
                onClick={handleCopyCode}
                className="text-sm px-5 py-2 bg-white text-primary font-semibold rounded-lg hover:bg-white/90 transition-all hover:shadow-lg"
                data-testid="button-copy-code"
              >
                Copy Code
              </button>
            </div>
          </div>
        </div>
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

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <StatCard 
          title="Total Members" 
          value={totalMembers} 
          icon={Users} 
          description="Click to view analytics"
          color="primary"
          delay={0}
          onClick={() => navigate("/owner/member-analytics")}
        />
        <StatCard 
          title="Checked-in Today" 
          value={checkedInToday} 
          icon={CalendarCheck} 
          description="Active today"
          color="green"
          delay={50}
          onClick={() => navigate("/owner/attendance")}
        />
        <StatCard 
          title="Yesterday" 
          value={checkedInYesterday} 
          icon={Calendar} 
          description="Members checked in"
          color="purple"
          delay={100}
        />
        <StatCard 
          title="Pending Payments" 
          value={pendingPayments} 
          icon={AlertCircle} 
          description="Unpaid invoices"
          color={pendingPayments > 0 ? "amber" : "green"}
          delay={150}
          onClick={() => navigate("/payments")}
        />
        <StatCard 
          title="This Month" 
          value={formatMoney(revenue)} 
          icon={TrendingUp} 
          description="Revenue collected"
          color="green"
          delay={200}
          onClick={() => navigate("/owner/revenue")}
        />
      </div>

      <Card className="border-0 shadow-lg animate-slide-in-up" style={{ animationDelay: '250ms' }}>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Export Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <a href="/api/owner/export/members" download>
              <Button variant="outline" className="hover:border-primary/50" data-testid="button-export-members">
                <Download className="w-4 h-4 mr-2" />
                Export Members
              </Button>
            </a>
            <a href="/api/owner/export/payments" download>
              <Button variant="outline" className="hover:border-primary/50" data-testid="button-export-payments">
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

      {/* AI Insights Summary */}
      {aiInsights && (
        <Card className="border-0 shadow-lg animate-slide-in-up bg-gradient-to-br from-purple-500/5 to-indigo-500/5" style={{ animationDelay: '300ms' }}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              AI Insights
            </CardTitle>
            <Link href="/owner/ai-insights">
              <Button variant="ghost" size="sm" className="text-primary" data-testid="link-ai-insights">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Churn Risk Alert */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className={`p-2 rounded-full ${aiInsights.churnRisk.count > 0 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400' : 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{aiInsights.churnRisk.count}</p>
                  <p className="text-xs text-muted-foreground">Members at risk</p>
                </div>
              </div>
              
              {/* Follow-up Reminders */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className={`p-2 rounded-full ${aiInsights.followUpReminders.count > 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{aiInsights.followUpReminders.count}</p>
                  <p className="text-xs text-muted-foreground">Follow-ups needed</p>
                </div>
              </div>
              
              {/* New Members This Month */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{aiInsights.memberInsights.newThisMonth}</p>
                  <p className="text-xs text-muted-foreground">New this month</p>
                </div>
              </div>
            </div>
            
            {/* Quick alerts */}
            {aiInsights.churnRisk.members.slice(0, 2).length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground mb-2">Priority alerts:</p>
                <div className="space-y-2">
                  {aiInsights.churnRisk.members.slice(0, 2).map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded bg-orange-50 dark:bg-orange-950/30 text-sm">
                      <span>{member.name} - {member.daysAbsent} days absent</span>
                      <Badge variant={member.riskLevel === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                        {member.riskLevel}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

  const { data: newMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/trainer/new-members"],
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

      {newMembers.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary" />
              New Members - Need Workout Plan
            </CardTitle>
            <Badge variant="secondary">{newMembers.length}</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These members were recently assigned to you and don't have a workout cycle yet.
            </p>
            <div className="space-y-2">
              {newMembers.slice(0, 5).map((member: any) => (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-background border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {member.username?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-sm">{member.username}</span>
                      <p className="text-xs text-muted-foreground">
                        Joined {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'recently'}
                      </p>
                    </div>
                  </div>
                  <Link href="/workouts">
                    <Button size="sm" data-testid={`button-assign-cycle-${member.id}`}>
                      <Dumbbell className="w-3 h-3 mr-1" />
                      Assign Cycle
                    </Button>
                  </Link>
                </div>
              ))}
              {newMembers.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {newMembers.length - 5} more members need workout plans
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

type PerSetInput = { reps: string; weight: string; targetReps: number; targetWeight: string };

function MemberDashboard() {
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [exerciseInputs, setExerciseInputs] = useState<Record<number, { sets: string; reps: string; weight: string }>>({});
  const [perSetInputs, setPerSetInputs] = useState<Record<number, { sameForAll: boolean; setInputs: PerSetInput[] }>>({});
  const [loadingPlanSets, setLoadingPlanSets] = useState<number | null>(null);
  const [showMarkDoneDialog, setShowMarkDoneDialog] = useState(false);
  const [shareableAchievements, setShareableAchievements] = useState<{ type: string; label: string; metadata: Record<string, unknown> }[]>([]);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  
  // Do Another Workout state
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [reorderDays, setReorderDays] = useState<any[]>([]);
  const [selectedReorderDay, setSelectedReorderDay] = useState<number | null>(null);
  const [reorderAction, setReorderAction] = useState<"swap" | "push">("swap");
  const [isRestDayReorder, setIsRestDayReorder] = useState(false);
  const { toast } = useToast();
  
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
  const logWorkoutSetsMutation = useLogWorkoutSets();
  const shareWorkoutMutation = useShareWorkout();
  const swapRestDayMutation = useSwapRestDay();
  const undoSwapMutation = useUndoRestDaySwap();
  
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
  
  // Reorder workout mutation ("Do Another Workout" or "Workout Today" from rest day)
  const reorderMutation = useMutation({
    mutationFn: async (data: { cycleId: number; targetDayIndex: number; action: "swap" | "push"; isRestDayReorder?: boolean }) => {
      const res = await apiRequest("POST", "/api/workouts/reorder", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/workout/summary"] });
      setReorderDialogOpen(false);
      setSelectedReorderDay(null);
      setIsRestDayReorder(false);
      toast({ title: data.message });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to change workout", variant: "destructive" });
    }
  });
  
  // Fetch available days for reordering
  const openReorderDialog = async (forRestDay = false) => {
    try {
      setIsRestDayReorder(forRestDay);
      const url = forRestDay 
        ? "/api/workouts/available-days?forRestDay=true" 
        : "/api/workouts/available-days";
      const res = await apiRequest("GET", url, undefined);
      const data = await res.json();
      // Filter out current day; for rest day reorder, backend already filters to workout days only
      const availableForReorder = (data.days || []).filter((d: any) => 
        d.dayIndex !== currentDayIndex && (forRestDay || !d.isRestDay)
      );
      setReorderDays(availableForReorder);
      setSelectedReorderDay(null);
      setReorderAction("swap");
      setReorderDialogOpen(true);
    } catch (error) {
      toast({ title: "Failed to fetch workout days", variant: "destructive" });
    }
  };

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
  const canSwapRestDay = workoutData?.canSwapRestDay ?? false;
  const activeSwap = workoutData?.swap ?? null;
  const isRestDay = workoutData?.isRestDay ?? false;
  
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

  const initializePerSetInputs = async (itemId: number, numSets: number, defaultReps: number, defaultWeight: string) => {
    if (perSetInputs[itemId]) return;
    
    setLoadingPlanSets(itemId);
    try {
      const res = await fetch(`/api/workouts/items/${itemId}/plan-sets`, { credentials: 'include' });
      const planSets = res.ok ? await res.json() : [];
      const sortedPlanSets = [...planSets].sort((a: any, b: any) => a.setNumber - b.setNumber);
      
      const setInputs = sortedPlanSets.length > 0
        ? sortedPlanSets.map((ps: any) => ({
            reps: String(ps.reps),
            weight: ps.weight || '',
            targetReps: ps.reps,
            targetWeight: ps.weight || ''
          }))
        : Array.from({ length: numSets }, () => ({
            reps: String(defaultReps),
            weight: defaultWeight || '',
            targetReps: defaultReps,
            targetWeight: defaultWeight || ''
          }));
      
      setPerSetInputs(prev => ({
        ...prev,
        [itemId]: { sameForAll: true, setInputs }
      }));
    } catch {
      setPerSetInputs(prev => ({
        ...prev,
        [itemId]: {
          sameForAll: true,
          setInputs: Array.from({ length: numSets }, () => ({
            reps: String(defaultReps),
            weight: defaultWeight || '',
            targetReps: defaultReps,
            targetWeight: defaultWeight || ''
          }))
        }
      }));
    } finally {
      setLoadingPlanSets(null);
    }
  };

  const handleExpandItem = (item: any) => {
    if (expandedItem === item.id) {
      setExpandedItem(null);
    } else {
      setExpandedItem(item.id);
      initializePerSetInputs(item.id, item.sets, item.reps, item.weight || '');
    }
  };

  const toggleSameForAll = (itemId: number, value: boolean, item: any) => {
    setPerSetInputs(prev => {
      const current = prev[itemId] || { sameForAll: true, setInputs: [] };
      const inputs = exerciseInputs[itemId] || { sets: String(item.sets), reps: String(item.reps), weight: item.weight || '' };
      
      if (value) {
        // Switching to same-for-all: sync all set inputs with the uniform values
        return {
          ...prev,
          [itemId]: {
            sameForAll: true,
            setInputs: current.setInputs.map(si => ({
              ...si,
              reps: inputs.reps || String(si.targetReps),
              weight: inputs.weight || si.targetWeight
            }))
          }
        };
      }
      // Switching to per-set mode: populate per-set entries with latest uniform values
      return {
        ...prev,
        [itemId]: {
          sameForAll: false,
          setInputs: current.setInputs.map(si => ({
            ...si,
            reps: inputs.reps || String(si.targetReps),
            weight: inputs.weight || si.targetWeight
          }))
        }
      };
    });
  };

  const updatePerSetInput = (itemId: number, setIndex: number, field: 'reps' | 'weight', value: string) => {
    setPerSetInputs(prev => {
      const current = prev[itemId];
      if (!current) return prev;
      const newSetInputs = [...current.setInputs];
      newSetInputs[setIndex] = { ...newSetInputs[setIndex], [field]: value };
      return { ...prev, [itemId]: { ...current, setInputs: newSetInputs } };
    });
  };

  const handleCompleteExercise = (item: any) => {
    const perSet = perSetInputs[item.id];
    
    if (perSet && !perSet.sameForAll && perSet.setInputs.length > 0) {
      const todayStr = new Date().toISOString().split("T")[0];
      const sets = perSet.setInputs.map((setInput, idx) => ({
        setNumber: idx + 1,
        targetReps: setInput.targetReps,
        targetWeight: setInput.targetWeight || null,
        actualReps: parseInt(setInput.reps) || setInput.targetReps || item.reps,
        actualWeight: setInput.weight || setInput.targetWeight || item.weight || null,
        completed: true
      }));
      
      logWorkoutSetsMutation.mutate({ workoutItemId: item.id, date: todayStr, sets }, {
        onSuccess: () => setExpandedItem(null)
      });
    } else {
      const inputs = exerciseInputs[item.id] || {};
      completeWorkoutMutation.mutate({
        workoutItemId: item.id,
        actualSets: inputs.sets ? parseInt(inputs.sets) : item.sets,
        actualReps: inputs.reps ? parseInt(inputs.reps) : item.reps,
        actualWeight: inputs.weight || item.weight || undefined
      });
      setExpandedItem(null);
    }
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
                  <p className="text-muted-foreground mb-4">
                    {isRestDay ? "Today is a Rest Day" : "No workout scheduled for today."}
                  </p>
                  <div className="flex flex-col gap-2 items-center">
                    {isRestDay && workoutData?.cycleId && (
                      <Button 
                        onClick={() => openReorderDialog(true)}
                        data-testid="button-workout-today"
                      >
                        <Dumbbell className="w-4 h-4 mr-2" />
                        Workout Today
                      </Button>
                    )}
                    {canSwapRestDay && !activeSwap && (
                      <Button 
                        variant="outline"
                        onClick={() => swapRestDayMutation.mutate()}
                        disabled={swapRestDayMutation.isPending}
                        data-testid="button-swap-rest-day"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        {swapRestDayMutation.isPending ? "Swapping..." : "Do Tomorrow's Workout Today"}
                      </Button>
                    )}
                    {activeSwap && (
                      <Button 
                        variant="outline"
                        onClick={() => undoSwapMutation.mutate(activeSwap.id)}
                        disabled={undoSwapMutation.isPending}
                        data-testid="button-undo-swap"
                      >
                        {undoSwapMutation.isPending ? "Undoing..." : "Undo Swap"}
                      </Button>
                    )}
                    <Button 
                      variant="secondary"
                      onClick={() => setShowMarkDoneDialog(true)}
                      data-testid="button-mark-rest-day-done"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Mark Day as Done
                    </Button>
                  </div>
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
                              onClick={() => handleExpandItem(item)}
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
                            {(loadingPlanSets === item.id || !perSetInputs[item.id]) ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs text-muted-foreground pt-2">Log your actual performance:</p>
                                
                                <div className="flex items-center justify-between py-2">
                                  <span className="text-sm font-medium">Same for all sets</span>
                                  <Switch 
                                    checked={perSetInputs[item.id]?.sameForAll ?? true}
                                    onCheckedChange={(value) => toggleSameForAll(item.id, value, item)}
                                    data-testid={`switch-same-for-all-${item.id}`}
                                  />
                                </div>

                                {(perSetInputs[item.id]?.sameForAll ?? true) ? (
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
                                ) : (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium">
                                      <div className="col-span-2">Set</div>
                                      <div className="col-span-3">Target</div>
                                      <div className="col-span-3">Reps</div>
                                      <div className="col-span-4">Weight</div>
                                    </div>
                                    {(perSetInputs[item.id]?.setInputs || []).map((setInput, idx) => (
                                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-2 text-sm font-medium text-center">
                                          {idx + 1}
                                        </div>
                                        <div className="col-span-3 text-xs text-muted-foreground">
                                          {setInput.targetReps}r {setInput.targetWeight && `@ ${setInput.targetWeight}`}
                                        </div>
                                        <div className="col-span-3">
                                          <Input 
                                            type="number" 
                                            min={1} 
                                            value={setInput.reps}
                                            onChange={(e) => updatePerSetInput(item.id, idx, 'reps', e.target.value)}
                                            className="h-9"
                                            data-testid={`input-set-${idx + 1}-reps-${item.id}`}
                                          />
                                        </div>
                                        <div className="col-span-4">
                                          <Input 
                                            placeholder="e.g., 50kg"
                                            value={setInput.weight}
                                            onChange={(e) => updatePerSetInput(item.id, idx, 'weight', e.target.value)}
                                            className="h-9"
                                            data-testid={`input-set-${idx + 1}-weight-${item.id}`}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleCompleteExercise(item)}
                                  disabled={completeWorkoutMutation.isPending || logWorkoutSetsMutation.isPending}
                                  data-testid={`button-complete-${item.id}`}
                                >
                                  {(completeWorkoutMutation.isPending || logWorkoutSetsMutation.isPending) ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                  )}
                                  Complete with Custom Values
                                </Button>
                              </>
                            )}
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
                  
                  {!allCompleted && workoutItems.length > 0 && (
                    <Button 
                      variant="ghost"
                      className="w-full mt-2"
                      onClick={() => openReorderDialog(false)}
                      data-testid="button-different-workout"
                    >
                      <Shuffle className="w-4 h-4 mr-2" />
                      Do a Different Workout
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

      {/* Do Another Workout / Reorder Dialog */}
      <Dialog open={reorderDialogOpen} onOpenChange={setReorderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isRestDayReorder ? (
                <>
                  <Dumbbell className="w-5 h-5" />
                  Workout Today
                </>
              ) : (
                <>
                  <Shuffle className="w-5 h-5" />
                  Do a Different Workout
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isRestDayReorder 
                ? "Choose which workout you'd like to do today instead of resting."
                : "Choose which workout day you'd like to do today instead."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {reorderDays.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No other workout days available to switch to.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Select Workout Day</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {reorderDays.map((day: any) => (
                      <button
                        key={day.dayIndex}
                        type="button"
                        onClick={() => setSelectedReorderDay(day.dayIndex)}
                        className={`w-full p-3 rounded-lg border text-left transition-colors ${
                          selectedReorderDay === day.dayIndex
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        data-testid={`reorder-day-${day.dayIndex}`}
                      >
                        <p className="font-medium">{day.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {day.exercises?.slice(0, 3).join(', ')}{day.exercises?.length > 3 ? '...' : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                
                {selectedReorderDay !== null && (
                  <div className="space-y-2">
                    <Label>Choose Action</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReorderAction("swap")}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          reorderAction === "swap"
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        data-testid="reorder-action-swap"
                      >
                        <ArrowLeftRight className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-sm font-medium">{isRestDayReorder ? "Swap Rest" : "Swap"}</p>
                        <p className="text-xs text-muted-foreground">
                          {isRestDayReorder ? "Rest moves to workout's slot" : "Exchange positions"}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReorderAction("push")}
                        className={`p-3 rounded-lg border text-center transition-colors ${
                          reorderAction === "push"
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted/50'
                        }`}
                        data-testid="reorder-action-push"
                      >
                        <ArrowRight className="w-5 h-5 mx-auto mb-1" />
                        <p className="text-sm font-medium">{isRestDayReorder ? "Push Rest" : "Do First"}</p>
                        <p className="text-xs text-muted-foreground">
                          {isRestDayReorder ? "Rest moves later in schedule" : "Shifts others forward"}
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setReorderDialogOpen(false);
                setSelectedReorderDay(null);
                setIsRestDayReorder(false);
              }}
              data-testid="button-cancel-reorder"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedReorderDay !== null && workoutData?.cycleId) {
                  reorderMutation.mutate({
                    cycleId: workoutData.cycleId,
                    targetDayIndex: selectedReorderDay,
                    action: reorderAction,
                    isRestDayReorder
                  });
                }
              }}
              disabled={selectedReorderDay === null || reorderMutation.isPending}
              data-testid="button-confirm-reorder"
            >
              {reorderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Applying...
                </>
              ) : (
                "Apply Change"
              )}
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

// Component to mark past attendance for missed days
function MarkPastAttendanceButton({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const { toast } = useToast();
  
  // Check if date is within the last 7 days
  const dateObj = parseISO(date);
  const today = new Date();
  const daysDiff = Math.floor((today.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
  const isWithin7Days = daysDiff <= 7 && daysDiff >= 0;
  
  const markPastMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/attendance/mark-past', { date });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/calendar/enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      toast({
        title: "Attendance Marked",
        description: `Marked as present for ${format(parseISO(date), "MMMM d, yyyy")}`
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark attendance",
        variant: "destructive"
      });
    }
  });

  // Show different message for dates older than 7 days
  if (!isWithin7Days) {
    return (
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-sm text-muted-foreground">
          Attendance can only be marked for the last 7 days. Contact your trainer or gym owner if you need to update older records.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <p className="text-sm text-muted-foreground mb-2">
        Did you go to the gym but forgot to log your workout? You can mark this day as attended.
      </p>
      <Button 
        onClick={() => markPastMutation.mutate()}
        disabled={markPastMutation.isPending}
        className="w-full"
        data-testid="button-mark-past-attendance"
      >
        {markPastMutation.isPending ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
            Marking...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark as Present
          </>
        )}
      </Button>
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
  const clientToday = format(new Date(), "yyyy-MM-dd");
  
  const { data: calendarData = [] } = useQuery<CalendarDayData[]>({
    queryKey: [`/api/me/calendar/enhanced?month=${monthStr}&today=${clientToday}`],
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
        return `${baseStyles} bg-blue-500/10 text-blue-700 dark:text-blue-400 cursor-pointer hover:bg-blue-500/20 ${todayRing}`;
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
      case "rest":
        return <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full" />;
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
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-blue-500 rounded-full" />
            <span>Rest</span>
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
              {selectedDate && format(new Date(selectedDate + "T00:00:00"), "EEEE, MMMM d, yyyy")}
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
          ) : dailyAnalytics && dailyAnalytics.exercises.length > 0 ? (
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
              {selectedDate && selectedDate < clientToday && (
                <MarkPastAttendanceButton 
                  date={selectedDate} 
                  onSuccess={() => {
                    setSelectedDate(null);
                  }} 
                />
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
