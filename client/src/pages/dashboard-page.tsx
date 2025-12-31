import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, useAttendance, usePayments, useMemberAttendance, useMemberPayments } from "@/hooks/use-gym";
import { useMemberStats, useTodayWorkout, useCompleteAllWorkouts, useCompleteWorkout, useMemberProfile } from "@/hooks/use-workouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, CalendarCheck, TrendingUp, AlertCircle, CreditCard, Flame, Target, Calendar, CheckCircle2, Dumbbell, ChevronDown, ChevronUp, User2, Clock } from "lucide-react";
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
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [exerciseInputs, setExerciseInputs] = useState<Record<number, { sets: string; reps: string; weight: string }>>({});
  
  const { data: attendance = [] } = useMemberAttendance();
  const { data: payments = [] } = useMemberPayments();
  const { data: stats } = useMemberStats();
  const { data: todayWorkout, isLoading: workoutLoading } = useTodayWorkout();
  const { data: profile } = useMemberProfile();
  const completeAllMutation = useCompleteAllWorkouts();
  const completeWorkoutMutation = useCompleteWorkout();

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
  
  const muscleTypes = [...new Set(workoutItems.map((i: any) => i.muscleType).filter(Boolean))];
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
        <Card className="dashboard-card" data-testid="card-today-workout">
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between gap-2 cursor-pointer hover-elevate">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Today's Workout</CardTitle>
                  {workoutItems.length > 0 && (
                    <div className="text-xs text-muted-foreground">
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
                  <Badge variant={allCompleted ? "default" : "secondary"}>
                    {completedCount}/{workoutItems.length}
                  </Badge>
                )}
                {isWorkoutOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              {workoutLoading ? (
                <p className="text-muted-foreground text-center py-4">Loading...</p>
              ) : workoutItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No workout scheduled for today.</p>
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
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
    </div>
  );
}
