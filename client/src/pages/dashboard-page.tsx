import { useAuth } from "@/hooks/use-auth";
import { useMembers, useAttendance, usePayments } from "@/hooks/use-gym";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CalendarCheck, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

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

function StatCard({ title, value, icon: Icon, description, trend }: any) {
  return (
    <Card className="dashboard-card border-none shadow-lg shadow-black/5 bg-gradient-to-br from-white to-slate-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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

  // Simple stats calculation
  const totalMembers = members.length;
  const presentToday = attendance.filter(a => a.date === format(new Date(), 'yyyy-MM-dd') && a.status === 'present').length;
  const pendingPayments = payments.filter(p => p.status !== 'paid').length;
  const revenue = payments
    .filter(p => p.status === 'paid')
    .reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);

  // Chart data preparation
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return format(d, 'yyyy-MM-dd');
  }).reverse();

  const chartData = last7Days.map(date => ({
    date: format(new Date(date), 'MMM dd'),
    count: attendance.filter(a => a.date === date && a.status === 'present').length
  }));

  const handleCopyCode = () => {
    if (user?.gym?.code) {
      navigator.clipboard.writeText(user.gym.code);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gym Info Card */}
      {user?.gym && (
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
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
              {attendance.slice(0, 5).map((record) => (
                <div key={record.id} className="flex items-center">
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold mr-3">
                    {record.member.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{record.member.username}</p>
                    <p className="text-xs text-muted-foreground">Checked in at {new Date(record.createdAt!).toLocaleTimeString()}</p>
                  </div>
                  <div className="ml-auto font-medium text-xs text-primary">
                    {record.status}
                  </div>
                </div>
              ))}
              {attendance.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrainerDashboard() {
  const { data: attendance = [] } = useAttendance();
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayCount = attendance.filter(a => a.date === today && a.status === 'present').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard 
          title="My Members Present" 
          value={todayCount} 
          icon={Users} 
          description="Assigned members here today"
        />
        {/* Trainers see a simplified view */}
      </div>
      <Card>
        <CardHeader><CardTitle>Welcome, Trainer</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Select "Attendance" from the menu to mark members present.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberDashboard() {
  const { user } = useAuth();
  const { data: attendance = [] } = useAttendance({ memberId: user?.id });
  const { data: payments = [] } = usePayments({ memberId: user?.id });

  const attendedThisMonth = attendance.length;
  const lastPayment = payments[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
         <StatCard 
          title="My Attendance" 
          value={attendedThisMonth} 
          icon={CalendarCheck} 
          description="Total sessions logged"
        />
        <StatCard 
          title="Last Payment" 
          value={lastPayment ? `$${(lastPayment.amountPaid || 0) / 100}` : 'N/A'} 
          icon={CreditCard} 
          description={lastPayment ? `Status: ${lastPayment.status}` : 'No payment history'}
        />
      </div>
      
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle>My Progress</CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-muted-foreground">Keep showing up! Consistency is key.</p>
        </CardContent>
      </Card>
    </div>
  );
}
