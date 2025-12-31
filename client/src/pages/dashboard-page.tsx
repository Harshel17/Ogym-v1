import { useAuth } from "@/hooks/use-auth";
import { useMembers, useAttendance, usePayments, useMemberAttendance, useMemberPayments } from "@/hooks/use-gym";
import { useMemberStats, useTodayWorkout, useCompleteAllWorkouts } from "@/hooks/use-workouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, CalendarCheck, TrendingUp, AlertCircle, CreditCard, Flame, Target, Calendar, CheckCircle2, Dumbbell, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useLocation } from "wouter";

export default function DashboardPage() {
  const { user } = useAuth();
  
  if (!user) return null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Overview of your gym activities and metrics.</p>
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

function OwnerDashboard() {
  const { user } = useAuth();
  const { data: members = [] } = useMembers();
  const { data: attendance = [] } = useAttendance();
  const { data: payments = [] } = usePayments();

  const membersList = members as any[];
  const attendanceList = attendance as any[];
  const paymentsList = payments as any[];

  const totalMembers = membersList.length;
  const presentToday = attendanceList.filter(a => a.date === format(new Date(), 'yyyy-MM-dd') && a.status === 'present').length;
  const pendingPayments = paymentsList.filter(p => p.status !== 'paid').length;
  const revenue = paymentsList
    .filter(p => p.status === 'paid')
    .reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Members" 
          value={totalMembers} 
          icon={Users} 
          description="Active gym members"
        />
        <StatCard 
          title="Attendance Today" 
          value={presentToday} 
          icon={CalendarCheck} 
          description="Members checked in today"
        />
        <StatCard 
          title="Revenue (Month)" 
          value={`$${(revenue / 100).toFixed(2)}`} 
          icon={TrendingUp} 
          description="Total collected this month"
        />
        <StatCard 
          title="Pending Payments" 
          value={pendingPayments} 
          icon={AlertCircle} 
          description="Unpaid invoices"
        />
      </div>

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

function TrainerDashboard() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Welcome, Trainer</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Go to "Workouts" to create training programs for your members, or check the activity feed to see their progress.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberDashboard() {
  const [, navigate] = useLocation();
  const { data: attendance = [] } = useMemberAttendance();
  const { data: payments = [] } = useMemberPayments();
  const { data: stats } = useMemberStats();
  const { data: todayWorkout, isLoading: workoutLoading } = useTodayWorkout();
  const completeAllMutation = useCompleteAllWorkouts();

  const attendanceList = attendance as any[];
  const paymentsList = payments as any[];
  const memberStats = stats as any;
  const workoutItems = (todayWorkout as any)?.items || [];

  const attendedCount = attendanceList.length;
  const lastPayment = paymentsList[0];

  const groupedByBodyPart = workoutItems.reduce((acc: any, item: any) => {
    const part = item.bodyPart || 'Other';
    if (!acc[part]) acc[part] = [];
    acc[part].push(item);
    return acc;
  }, {});

  const allCompleted = workoutItems.length > 0 && workoutItems.every((i: any) => i.completed);
  const incompleteIds = workoutItems.filter((i: any) => !i.completed).map((i: any) => i.id);

  const handleMarkAllDone = () => {
    if (incompleteIds.length > 0) {
      completeAllMutation.mutate({ workoutItemIds: incompleteIds });
    }
  };

  return (
    <div className="space-y-6">
      <Card 
        className="dashboard-card cursor-pointer hover-elevate" 
        onClick={() => navigate('/my-workout')}
        data-testid="card-today-workout"
      >
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            <CardTitle>Your Workout Today</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, MMM d')}
            </span>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent onClick={(e) => e.stopPropagation()}>
          {workoutLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : workoutItems.length === 0 ? (
            <p className="text-muted-foreground">No workout scheduled for today. Ask your trainer to create a workout plan!</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByBodyPart).map(([bodyPart, items]: [string, any]) => (
                <div key={bodyPart}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">{bodyPart}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {items.filter((i: any) => i.completed).length}/{items.length} done
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map((item: any) => (
                      <div 
                        key={item.id} 
                        className={`flex items-center gap-3 p-2 rounded-md ${
                          item.completed 
                            ? 'bg-green-50 dark:bg-green-900/20' 
                            : 'bg-muted/30'
                        }`}
                        data-testid={`workout-item-${item.id}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          item.completed 
                            ? 'bg-green-500 text-white' 
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {item.completed ? <CheckCircle2 className="w-3 h-3" /> : item.orderIndex + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {item.exerciseName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.sets} sets x {item.reps} reps {item.weight ? `@ ${item.weight}` : ''}
                          </p>
                        </div>
                        {item.muscleType && (
                          <Badge variant="outline" className="text-xs hidden sm:inline-flex">{item.muscleType}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!allCompleted && (
                <Button 
                  className="w-full"
                  onClick={handleMarkAllDone}
                  disabled={completeAllMutation.isPending}
                  data-testid="button-mark-all-done"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark All as Done
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {memberStats && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Flame className="w-8 h-8 text-orange-500 mb-2" />
              <p className="text-2xl font-bold">{memberStats.streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Target className="w-8 h-8 text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{memberStats.totalWorkouts}</p>
              <p className="text-xs text-muted-foreground">Total Workouts</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Calendar className="w-8 h-8 text-green-500 mb-2" />
              <p className="text-2xl font-bold">{memberStats.last7Days}</p>
              <p className="text-xs text-muted-foreground">Last 7 Days</p>
            </CardContent>
          </Card>
        </div>
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
    </div>
  );
}
