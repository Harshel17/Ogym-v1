import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMembers, useAttendance, usePayments, useMemberAttendance, useMemberPayments, useTrainingMode } from "@/hooks/use-gym";
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
import { Users, CalendarCheck, TrendingUp, AlertCircle, CreditCard, Flame, Target, Calendar, CheckCircle2, Dumbbell, ChevronDown, ChevronUp, User2, Clock, ChevronLeft, ChevronRight, Check, Download, Loader2, Brain, AlertTriangle, Bell, ArrowRight, Shuffle, ArrowLeftRight, Moon, Sparkles, Sun, UserPlus, Plus, Minus, Heart, Activity, Zap, BedDouble, ArrowRightLeft, ChevronsRight, SkipForward, Footprints, ExternalLink, X, Trophy } from "lucide-react";
import { AnimatedStatCard, CalorieProgressCard, WorkoutProgressBar, WeeklyProgress, StreakDisplay } from "@/components/premium-stats";
import { OwnerDashboardSkeleton, TrainerDashboardSkeleton, MemberDashboardSkeleton } from "@/components/dashboard-skeleton";
import { MemberOnboarding, PersonalModeOnboarding, TrainerOnboarding, OwnerOnboarding } from "@/components/onboarding-carousel";
import { FeatureDiscoveryTips } from "@/components/feature-discovery-tips";
import { useHealthStatus, useHealthDataToday } from "@/hooks/use-health-data";
import { useGymCurrency } from "@/hooks/use-gym-currency";
import { isIOS, isNative } from "@/lib/capacitor-init";
import { Switch } from "@/components/ui/switch";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Link, useLocation } from "wouter";

function ConfettiBurst({ trigger }: { trigger: boolean }) {
  const [pieces, setPieces] = useState<Array<{ id: number; left: number; color: string; delay: number; size: number }>>([]);

  useEffect(() => {
    if (!trigger) return;
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    const newPieces = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.8,
      size: 6 + Math.random() * 6,
    }));
    setPieces(newPieces);
    const timer = setTimeout(() => setPieces([]), 3000);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (pieces.length === 0) return null;

  return (
    <div className="confetti-container">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getGreetingIcon() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "sun";
  if (hour >= 12 && hour < 18) return "sun";
  return "moon";
}

function getMotivationalLine(streak: number, workoutsDone: boolean, caloriesLogged: number) {
  if (workoutsDone && caloriesLogged > 0) return "Crushing it today";
  if (workoutsDone) return "Workout complete";
  if (streak >= 7) return "Unstoppable this week";
  if (streak >= 3) return "Building momentum";
  if (caloriesLogged > 0) return "Tracking on point";
  const hour = new Date().getHours();
  if (hour < 12) return "Let's make it count";
  if (hour < 17) return "Stay focused";
  return "Rest well tonight";
}

function MiniRing({ value, max, size = 48, color, icon: Icon }: {
  value: number; max: number; size?: number; color: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}) {
  const sw = 4;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const c = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={c} cy={c} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted/10" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={circ - pct * circ} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
    </div>
  );
}

function HealthActivityDashboard() {
  const { data: status, isLoading: statusLoading } = useHealthStatus();
  const { data: healthData, isLoading: dataLoading } = useHealthDataToday();

  const connected = status?.connected || !!healthData;
  const hasData = connected && healthData;

  const steps = hasData ? (healthData.steps || 0) : 0;
  const caloriesBurned = hasData ? (healthData.caloriesBurned || 0) : 0;
  const sleepMinutes = hasData ? (healthData.sleepMinutes || 0) : 0;
  const restingHR = hasData ? (healthData.restingHeartRate || 0) : 0;
  const avgHR = hasData ? (healthData.avgHeartRate || 0) : 0;
  const activeMinutes = hasData ? (healthData.activeMinutes || 0) : 0;

  const computeRecovery = () => {
    if (!hasData) return 0;
    let score = 50;
    if (sleepMinutes >= 450) score += 20;
    else if (sleepMinutes >= 360) score += 10;
    else if (sleepMinutes < 360 && sleepMinutes > 0) score -= 15;
    if (restingHR > 0 && restingHR < 60) score += 15;
    else if (restingHR >= 60 && restingHR <= 75) score += 5;
    else if (restingHR > 75) score -= 10;
    if (activeMinutes > 90) score -= 10;
    else if (activeMinutes >= 30) score += 10;
    else if (activeMinutes > 0) score += 5;
    if (steps >= 8000) score += 5;
    else if (steps < 3000 && steps > 0) score -= 5;
    return Math.max(0, Math.min(100, score));
  };

  const recovery = computeRecovery();

  const getRecoveryColor = (s: number) => {
    if (s >= 80) return '#22c55e';
    if (s >= 60) return '#3b82f6';
    if (s >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const getRecoveryLabel = (s: number) => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Low';
  };

  const formatSleep = (mins: number) => {
    if (mins <= 0) return '--';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  if (statusLoading) {
    return (
      <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-health-loading">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href="/health">
      <Card className="overflow-hidden border-0 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300" data-testid="card-health-activity">
        <div className="bg-gradient-to-br from-card via-card to-muted/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10">
                  <Activity className="w-4 h-4 text-green-500" />
                </div>
                <CardTitle className="text-sm font-semibold">Health & Activity</CardTitle>
              </div>
              {hasData && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${getRecoveryColor(recovery)}15` }}>
                  <Zap className="w-3 h-3" style={{ color: getRecoveryColor(recovery) }} />
                  <span className="text-xs font-bold" style={{ color: getRecoveryColor(recovery) }}>{recovery}</span>
                  <span className="text-[10px] text-muted-foreground">{getRecoveryLabel(recovery)}</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-1 pb-4">
            {!connected ? (
              <div className="grid grid-cols-4 gap-3 py-1">
                {[
                  { icon: Footprints, color: '#3b82f6', bg: 'bg-blue-500/8', label: 'Steps' },
                  { icon: Flame, color: '#f97316', bg: 'bg-orange-500/8', label: 'Calories' },
                  { icon: Moon, color: '#a855f7', bg: 'bg-purple-500/8', label: 'Sleep' },
                  { icon: Heart, color: '#ef4444', bg: 'bg-red-500/8', label: 'Heart' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-1.5">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.bg}`}>
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            ) : dataLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <div className="flex flex-col items-center gap-1" data-testid="health-steps">
                  <MiniRing value={steps} max={10000} color="#3b82f6" icon={Footprints} />
                  <span className="text-[13px] font-bold tabular-nums">{formatNumber(steps)}</span>
                  <span className="text-[10px] text-muted-foreground">Steps</span>
                </div>
                <div className="flex flex-col items-center gap-1" data-testid="health-calories">
                  <MiniRing value={caloriesBurned} max={500} color="#f97316" icon={Flame} />
                  <span className="text-[13px] font-bold tabular-nums">{caloriesBurned}</span>
                  <span className="text-[10px] text-muted-foreground">Burned</span>
                </div>
                <div className="flex flex-col items-center gap-1" data-testid="health-sleep">
                  <MiniRing value={sleepMinutes} max={480} color="#a855f7" icon={Moon} />
                  <span className="text-[13px] font-bold tabular-nums">{formatSleep(sleepMinutes)}</span>
                  <span className="text-[10px] text-muted-foreground">Sleep</span>
                </div>
                <div className="flex flex-col items-center gap-1" data-testid="health-heart">
                  <MiniRing value={avgHR} max={200} color="#ef4444" icon={Heart} />
                  <span className="text-[13px] font-bold tabular-nums">{avgHR > 0 ? `${avgHR}` : '--'}</span>
                  <span className="text-[10px] text-muted-foreground">Avg HR</span>
                </div>
              </div>
            )}
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  
  if (!user) return null;

  const greeting = getGreeting();
  const greetingIcon = getGreetingIcon();

  return (
    <div className="space-y-3">
      {user.role === "owner" && (
        <div className="lg:max-w-5xl space-y-3">
          <GreetingBanner greeting={greeting} greetingIcon={greetingIcon} username={user.username} />
          <OwnerDashboard />
        </div>
      )}
      {user.role === "trainer" && (
        <>
          <GreetingBanner greeting={greeting} greetingIcon={greetingIcon} username={user.username} />
          <TrainerDashboard />
        </>
      )}
      {user.role === "member" && <MemberDashboard greeting={greeting} greetingIcon={greetingIcon} username={user.username} />}
    </div>
  );
}

function GreetingBanner({ greeting, greetingIcon, username, motiveLine }: { greeting: string; greetingIcon: string; username: string; motiveLine?: string }) {
  return (
    <div className="greeting-banner" data-testid="greeting-banner">
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 mb-1.5 font-semibold tracking-widest uppercase">
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(), 'EEE, MMM d')}</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight leading-tight mb-1" data-testid="text-greeting">
            {greeting}, <span className="shimmer-text">{username}</span>
          </h2>
          {motiveLine && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="pulse-dot" />
              <span className="text-xs text-muted-foreground/80 font-medium italic" data-testid="text-motivational">{motiveLine}</span>
            </div>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-lg ${greetingIcon === 'sun' ? 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/25' : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/25'}`}>
          {greetingIcon === 'sun' ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5 text-white" />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, description, onClick, color = "primary" }: any) {
  const colorClasses: Record<string, { bg: string; icon: string; accent: string }> = {
    primary: { 
      bg: "bg-gradient-to-br from-primary/5 to-primary/10", 
      icon: "bg-primary/15 text-primary",
      accent: "border-l-primary"
    },
    green: { 
      bg: "bg-gradient-to-br from-emerald-500/5 to-emerald-500/10", 
      icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      accent: "border-l-emerald-500"
    },
    amber: { 
      bg: "bg-gradient-to-br from-amber-500/5 to-amber-500/10", 
      icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      accent: "border-l-amber-500"
    },
    red: { 
      bg: "bg-gradient-to-br from-red-500/5 to-red-500/10", 
      icon: "bg-red-500/15 text-red-600 dark:text-red-400",
      accent: "border-l-red-500"
    },
    purple: { 
      bg: "bg-gradient-to-br from-purple-500/5 to-purple-500/10", 
      icon: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
      accent: "border-l-purple-500"
    },
  };

  const colorConfig = colorClasses[color] || colorClasses.primary;
  
  return (
    <Card 
      className={`overflow-visible border-0 ${colorConfig.bg} hover-elevate transition-all duration-200 ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-1 pt-3 px-3">
        <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {title}
        </CardTitle>
        <div className={`p-1.5 rounded-lg ${colorConfig.icon}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3 px-3">
        <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
        <p className="text-[11px] text-muted-foreground/70 mt-0.5 font-medium">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

type TodayActivity = {
  newMembers: { id: number; username: string; createdAt: string }[];
  payments: { id: number; memberId: number; amountPaid: number; method: string; paidOn: string; memberName: string }[];
  expiringSubscriptions: { id: number; memberId: number; endDate: string; status: string; memberName: string; planName: string | null }[];
};

function TodayActivitySection({ formatMoney }: { formatMoney: (v: number) => string }) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const isIOSNativeApp = isNative() && isIOS();

  const getClientLocalDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const { data: activity, isLoading } = useQuery<TodayActivity>({
    queryKey: ["/api/owner/today-activity", getClientLocalDate()],
    queryFn: async () => {
      const clientToday = getClientLocalDate();
      const res = await fetch(`/api/owner/today-activity?clientToday=${clientToday}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch today activity');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  const totalItems = (activity?.newMembers.length || 0) + (activity?.payments.length || 0) + (activity?.expiringSubscriptions.length || 0);

  if (isLoading) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading today's activity...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activity || totalItems === 0) {
    return (
      <Card className="bg-muted/30">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-3 px-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <div className="p-1.5 rounded-lg bg-primary/15">
              <Activity className="w-3.5 h-3.5 text-primary" />
            </div>
            Today's Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-3 px-3">
          <p className="text-xs text-muted-foreground text-center py-3">No activity yet today. Check back later!</p>
        </CardContent>
      </Card>
    );
  }

  const { newMembers, payments, expiringSubscriptions } = activity;
  const totalPaymentAmount = payments.reduce((sum, p) => sum + p.amountPaid, 0);

  return (
    <Card className="bg-muted/30">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-3 px-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className="p-1.5 rounded-lg bg-primary/15">
            <Activity className="w-3.5 h-3.5 text-primary" />
          </div>
          Today's Activity
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setExpanded(!expanded)}
          data-testid="button-toggle-today-activity"
        >
          {expanded ? "Collapse" : "View All"}
          {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
        </Button>
      </CardHeader>
      <CardContent className="pt-0 pb-3 px-3">
        <div className="flex gap-2 mb-2">
          <div
            className="flex-1 text-center p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer hover-elevate"
            onClick={() => navigate("/members")}
            data-testid="stat-new-members-today"
          >
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{newMembers.length}</p>
            <p className="text-xs font-medium text-muted-foreground">New Members</p>
          </div>
          {!isIOSNativeApp && (
            <div
              className="flex-1 text-center p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 cursor-pointer hover-elevate"
              onClick={() => navigate("/payments")}
              data-testid="stat-payments-today"
            >
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{payments.length}</p>
              <p className="text-xs font-medium text-muted-foreground">Payments</p>
            </div>
          )}
          {!isIOSNativeApp && (
            <div
              className="flex-1 text-center p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer hover-elevate"
              onClick={() => navigate("/payments")}
              data-testid="stat-expiring-today"
            >
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{expiringSubscriptions.length}</p>
              <p className="text-xs font-medium text-muted-foreground">Expiring</p>
            </div>
          )}
        </div>

        {expanded && (
          <div className="space-y-2 mt-3">
            {newMembers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <UserPlus className="w-3 h-3" /> New Members
                </p>
                <div className="space-y-1">
                  {newMembers.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50 cursor-pointer hover-elevate"
                      onClick={() => navigate(`/members`)}
                      data-testid={`activity-new-member-${m.id}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {m.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{m.username}</p>
                        <p className="text-[10px] text-muted-foreground">Joined today</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-5 shrink-0">New</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isIOSNativeApp && payments.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3" /> Payments ({formatMoney(totalPaymentAmount)})
                </p>
                <div className="space-y-1">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50 cursor-pointer hover-elevate"
                      onClick={() => navigate("/payments")}
                      data-testid={`activity-payment-${p.id}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        {p.memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.memberName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{p.method}</p>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">{formatMoney(p.amountPaid)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isIOSNativeApp && expiringSubscriptions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" /> Expiring Today
                </p>
                <div className="space-y-1">
                  {expiringSubscriptions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50 cursor-pointer hover-elevate"
                      onClick={() => navigate("/payments")}
                      data-testid={`activity-expiring-${s.id}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                        {s.memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{s.memberName}</p>
                        <p className="text-[10px] text-muted-foreground">{s.planName || 'Subscription'}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] h-5 bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">Expires</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OwnerDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { data: attendance = [] } = useAttendance();
  const { data: payments = [] } = usePayments();
  const { format: formatMoney } = useGymCurrency();
  const isIOSNativeApp = isNative() && isIOS();
  
  // Onboarding state (user-specific key to handle shared browsers)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(`ogym_owner_onboarding_seen_${user?.id}`);
  });
  
  const completeOnboarding = () => {
    localStorage.setItem(`ogym_owner_onboarding_seen_${user?.id}`, 'true');
    setShowOnboarding(false);
  };

  // Get client's local date to handle timezone differences
  const getClientLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const { data: dashboardMetrics, isLoading: metricsLoading } = useQuery<{
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
    },
    staleTime: 1000 * 60 * 2,
  });

  // AI Insights
  const { data: aiInsights } = useQuery<{
    churnRisk: { count: number; members: { id: number; name: string; daysAbsent: number; riskLevel: 'high' | 'medium' }[] };
    followUpReminders: { count: number; items: { type: string; memberId: number; name: string; message: string; priority: string }[] };
    memberInsights: { totalActive: number; newThisMonth: number; atRiskCount: number };
  }>({
    queryKey: [`/api/owner/ai-insights/${getClientLocalDate()}`],
    staleTime: 1000 * 60 * 10,
  });

  // Walk-in visitor stats
  const { data: walkInStats } = useQuery<{
    todayCount: number;
    weekCount: number;
    monthCount: number;
    todayRevenue: number;
    conversionRate: number;
  }>({
    queryKey: ["/api/owner/walk-in-visitors/stats"],
    staleTime: 1000 * 60 * 2,
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

  const isFirstTime = totalMembers === 0;

  if (showOnboarding) {
    return <OwnerOnboarding onComplete={completeOnboarding} />;
  }

  if (metricsLoading && !dashboardMetrics) {
    return <OwnerDashboardSkeleton />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard 
          title="Total Members" 
          value={totalMembers} 
          icon={Users} 
          description="View analytics"
          color="primary"
          onClick={() => navigate("/owner/member-analytics")}
        />
        <StatCard 
          title="Checked-in Today" 
          value={checkedInToday} 
          icon={CalendarCheck} 
          description="Active today"
          color="green"
          onClick={() => navigate("/owner/attendance")}
        />
        <StatCard 
          title="Yesterday" 
          value={checkedInYesterday} 
          icon={Calendar} 
          description="Checked in"
          color="purple"
        />
        {!isIOSNativeApp && (
          <StatCard 
            title="Pending" 
            value={pendingPayments} 
            icon={AlertCircle} 
            description="Unpaid"
            color={pendingPayments > 0 ? "amber" : "green"}
            onClick={() => navigate("/payments")}
          />
        )}
        {!isIOSNativeApp && (
          <StatCard 
            title="Revenue" 
            value={formatMoney(revenue)} 
            icon={TrendingUp} 
            description="This month"
            color="green"
            onClick={() => navigate("/owner/revenue")}
          />
        )}
        {!isIOSNativeApp && (
          <StatCard 
            title="Walk-ins" 
            value={walkInStats?.todayCount || 0} 
            icon={UserPlus} 
            description="Today"
            color="blue"
            onClick={() => navigate("/owner/walk-in-visitors")}
          />
        )}
      </div>

      <FeatureDiscoveryTips role="owner" />

      {!isIOSNativeApp && (
        <div className="flex flex-wrap gap-1.5">
          <a href="/api/owner/export/members" download>
            <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-export-members">
              <Download className="w-3 h-3 mr-1" />
              Members
            </Button>
          </a>
          <a href="/api/owner/export/payments" download>
            <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-export-payments">
              <Download className="w-3 h-3 mr-1" />
              Payments
            </Button>
          </a>
          <a href="/api/owner/export/attendance" download>
            <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="button-export-attendance">
              <Download className="w-3 h-3 mr-1" />
              Attendance
            </Button>
          </a>
        </div>
      )}

      <div className="grid gap-2.5 lg:grid-cols-2">
        {/* AI Insights Summary */}
        {aiInsights && !isIOSNativeApp && (
          <Card className="bg-gradient-to-br from-purple-500/5 via-transparent to-indigo-500/5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-3 px-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="p-1.5 rounded-lg bg-purple-500/15">
                  <Brain className="w-3.5 h-3.5 text-purple-500" />
                </div>
                AI Insights
              </CardTitle>
              <Link href="/owner/ai-insights">
                <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid="link-ai-insights">
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="pt-0 pb-3 px-3">
              <div className="flex gap-2">
                <div className="flex-1 text-center p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">{aiInsights.churnRisk.count}</p>
                  <p className="text-xs font-medium text-muted-foreground">At risk</p>
                </div>
                <div className="flex-1 text-center p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{aiInsights.followUpReminders.count}</p>
                  <p className="text-xs font-medium text-muted-foreground">Follow-ups</p>
                </div>
                <div className="flex-1 text-center p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{aiInsights.memberInsights.newThisMonth}</p>
                  <p className="text-xs font-medium text-muted-foreground">New</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <TodayActivitySection formatMoney={formatMoney} />
      </div>

      <div className="grid gap-2.5 md:grid-cols-2">
        <Card className="bg-muted/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-semibold">Attendance (Last 7 days)</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    width={30}
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '6px', border: '1px solid hsl(var(--border))', fontSize: '12px' }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[3, 3, 0, 0]} 
                    barSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-2">
              {attendanceList.slice(0, 5).map((record: any) => (
                <div key={record.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {record.member?.username?.slice(0, 2).toUpperCase() || '??'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{record.member?.username || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{record.date}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs h-5 shrink-0">
                    {record.verifiedMethod || record.status}
                  </Badge>
                </div>
              ))}
              {attendanceList.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No recent activity.</p>}
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
  const { user } = useAuth();
  // Onboarding state (user-specific key to handle shared browsers)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(`ogym_trainer_onboarding_seen_${user?.id}`);
  });
  
  const completeOnboarding = () => {
    localStorage.setItem(`ogym_trainer_onboarding_seen_${user?.id}`, 'true');
    setShowOnboarding(false);
  };

  const { data: dashboardData, isLoading: trainerLoading } = useQuery<TrainerDashboardData>({
    queryKey: ["/api/trainer/dashboard"],
    staleTime: 1000 * 60 * 2,
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["/api/trainer/members"],
    staleTime: 1000 * 60 * 2,
  });

  const { data: newMembers = [] } = useQuery<any[]>({
    queryKey: ["/api/trainer/new-members"],
    staleTime: 1000 * 60 * 2,
  });

  const totalMembers = dashboardData?.totalMembers || members.length || 0;

  if (showOnboarding) {
    return <TrainerOnboarding onComplete={completeOnboarding} />;
  }

  if (trainerLoading && !dashboardData) {
    return <TrainerDashboardSkeleton />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 md:grid-cols-3">
        <StatCard 
          title="My Members" 
          value={totalMembers} 
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

      <FeatureDiscoveryTips role="trainer" />

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

      <div className="grid gap-2.5 md:grid-cols-2">
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

function MemberDashboard({ greeting, greetingIcon, username }: { greeting: string; greetingIcon: string; username: string }) {
  const { user } = useAuth();
  const { data: trainingModeData } = useTrainingMode();
  const isPersonalMode = user?.role === 'member' && !user?.gymId;
  const isTrainerLed = user?.gymId && trainingModeData?.trainingMode === 'trainer_led';
  const canManageOwnWorkouts = !isTrainerLed;
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [exerciseInputs, setExerciseInputs] = useState<Record<number, { sets: string; reps: string; weight: string; durationMinutes?: string; distanceKm?: string }>>({});
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
  const [showRestDayDialog, setShowRestDayDialog] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [exerciseHelpId, setExerciseHelpId] = useState<number | null>(null);
  const [exerciseHelpData, setExerciseHelpData] = useState<Record<number, any>>({});
  const [exerciseHelpLoading, setExerciseHelpLoading] = useState<number | null>(null);

  // Match logging state
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchStep, setMatchStep] = useState<"timing" | "today-status" | "action" | "details" | "done">("timing");
  const [matchTiming, setMatchTiming] = useState<"today" | "tomorrow" | "yesterday" | "">("");
  const [matchStatus, setMatchStatus] = useState<"going" | "done" | "scheduled" | "recovery" | "">("");
  const [matchAction, setMatchAction] = useState<"rest" | "warmup" | "recovery" | "normal" | "">("");
  const [matchDuration, setMatchDuration] = useState<number>(60);
  const [matchIntensity, setMatchIntensity] = useState<"casual" | "competitive">("casual");
  const [matchExercisesDone, setMatchExercisesDone] = useState<Record<string, boolean>>({});

  const MATCH_EXERCISES: Record<string, Record<string, { warmup: { name: string; duration: string }[]; recovery: { name: string; duration: string }[] }>> = {
    "Football (Soccer)": {
      default: {
        warmup: [
          { name: "Light jog around the pitch", duration: "5 min" },
          { name: "Dynamic leg swings (front & side)", duration: "2 min" },
          { name: "High knees & butt kicks", duration: "3 min" },
          { name: "Lateral shuffles & carioca", duration: "3 min" },
          { name: "Short sprints (50-70%)", duration: "3 min" },
          { name: "Ball control drills", duration: "5 min" },
          { name: "Passing & receiving warm-up", duration: "5 min" },
        ],
        recovery: [
          { name: "Slow walk / cool-down jog", duration: "5 min" },
          { name: "Quad stretch (each leg)", duration: "1 min" },
          { name: "Hamstring stretch (each leg)", duration: "1 min" },
          { name: "Hip flexor stretch", duration: "2 min" },
          { name: "Calf stretch (wall)", duration: "1 min" },
          { name: "Foam roll quads & hamstrings", duration: "5 min" },
          { name: "Glute bridge hold", duration: "2 min" },
        ],
      },
      Goalkeeper: {
        warmup: [
          { name: "Light jog with arm circles", duration: "5 min" },
          { name: "Dynamic leg swings", duration: "2 min" },
          { name: "Lateral shuffles & crossovers", duration: "3 min" },
          { name: "Reaction drills (quick feet)", duration: "3 min" },
          { name: "Diving practice (low shots)", duration: "5 min" },
          { name: "High ball catching", duration: "3 min" },
          { name: "Distribution kicks", duration: "4 min" },
        ],
        recovery: [
          { name: "Slow cool-down walk", duration: "5 min" },
          { name: "Shoulder & wrist stretches", duration: "2 min" },
          { name: "Hip opener stretch", duration: "2 min" },
          { name: "Lower back stretch", duration: "2 min" },
          { name: "Foam roll shoulders & back", duration: "4 min" },
          { name: "Hamstring & quad stretch", duration: "3 min" },
          { name: "Deep breathing & relaxation", duration: "2 min" },
        ],
      },
    },
    "Basketball": {
      default: {
        warmup: [
          { name: "Light court jog (2 laps)", duration: "3 min" },
          { name: "Dynamic arm circles & leg swings", duration: "2 min" },
          { name: "High knees & butt kicks", duration: "2 min" },
          { name: "Defensive slides", duration: "3 min" },
          { name: "Layup lines", duration: "4 min" },
          { name: "Shooting warm-up (close range)", duration: "5 min" },
          { name: "Ball handling drills", duration: "3 min" },
        ],
        recovery: [
          { name: "Slow walk & deep breathing", duration: "3 min" },
          { name: "Calf & Achilles stretch", duration: "2 min" },
          { name: "Quad & hamstring stretch", duration: "3 min" },
          { name: "Shoulder & arm stretch", duration: "2 min" },
          { name: "Foam roll legs & back", duration: "5 min" },
          { name: "Ankle circles & mobility", duration: "2 min" },
          { name: "Wrist & finger stretches", duration: "1 min" },
        ],
      },
    },
    "Tennis": {
      default: {
        warmup: [
          { name: "Light jog (sideline to sideline)", duration: "3 min" },
          { name: "Arm circles & shoulder rotations", duration: "2 min" },
          { name: "Lateral shuffles", duration: "3 min" },
          { name: "Shadow swings (forehand & backhand)", duration: "3 min" },
          { name: "Mini-tennis (service box rallies)", duration: "5 min" },
          { name: "Serve practice (50% power)", duration: "4 min" },
          { name: "Baseline rally warm-up", duration: "5 min" },
        ],
        recovery: [
          { name: "Slow walk around the court", duration: "3 min" },
          { name: "Shoulder & rotator cuff stretch", duration: "3 min" },
          { name: "Forearm & wrist stretch", duration: "2 min" },
          { name: "Hip flexor & groin stretch", duration: "3 min" },
          { name: "Calf & ankle stretch", duration: "2 min" },
          { name: "Foam roll back & shoulders", duration: "4 min" },
          { name: "Gentle full-body stretch", duration: "3 min" },
        ],
      },
    },
    "Swimming": {
      default: {
        warmup: [
          { name: "Arm circles & shoulder stretches", duration: "3 min" },
          { name: "Trunk rotations", duration: "2 min" },
          { name: "Ankle & hip mobility", duration: "2 min" },
          { name: "Easy swim (200m mixed stroke)", duration: "5 min" },
          { name: "Kick drills with board", duration: "4 min" },
          { name: "Pull drills", duration: "4 min" },
          { name: "Race-pace intervals (4x25m)", duration: "5 min" },
        ],
        recovery: [
          { name: "Easy cool-down swim (200m)", duration: "5 min" },
          { name: "Shoulder stretch (doorway)", duration: "2 min" },
          { name: "Lat & upper back stretch", duration: "2 min" },
          { name: "Hip & quad stretch", duration: "3 min" },
          { name: "Ankle circles", duration: "1 min" },
          { name: "Foam roll lats & shoulders", duration: "4 min" },
          { name: "Deep breathing & relaxation", duration: "3 min" },
        ],
      },
    },
    "Boxing": {
      default: {
        warmup: [
          { name: "Jump rope (easy pace)", duration: "5 min" },
          { name: "Arm circles & shoulder rolls", duration: "2 min" },
          { name: "Shadow boxing (light)", duration: "5 min" },
          { name: "Neck rotations", duration: "1 min" },
          { name: "Hip circles & leg swings", duration: "2 min" },
          { name: "Footwork drills", duration: "3 min" },
          { name: "Light pad work / bag work", duration: "5 min" },
        ],
        recovery: [
          { name: "Slow walk & shake out arms", duration: "3 min" },
          { name: "Shoulder & chest stretch", duration: "3 min" },
          { name: "Wrist & forearm stretch", duration: "2 min" },
          { name: "Hip flexor stretch", duration: "2 min" },
          { name: "Neck stretch (gentle)", duration: "2 min" },
          { name: "Foam roll back & arms", duration: "4 min" },
          { name: "Deep breathing", duration: "2 min" },
        ],
      },
    },
    "MMA": {
      default: {
        warmup: [
          { name: "Jump rope", duration: "5 min" },
          { name: "Hip escapes (shrimping)", duration: "3 min" },
          { name: "Shadow boxing", duration: "3 min" },
          { name: "Sprawls & level changes", duration: "3 min" },
          { name: "Guard pull & stand-up drills", duration: "3 min" },
          { name: "Neck bridges (light)", duration: "2 min" },
          { name: "Light sparring / flow rolling", duration: "5 min" },
        ],
        recovery: [
          { name: "Slow walk & deep breathing", duration: "3 min" },
          { name: "Full-body stretch sequence", duration: "5 min" },
          { name: "Hip opener (pigeon pose)", duration: "3 min" },
          { name: "Shoulder & neck stretch", duration: "2 min" },
          { name: "Foam roll full body", duration: "5 min" },
          { name: "Ice bath or cold shower", duration: "3 min" },
        ],
      },
    },
    "Cricket": {
      default: {
        warmup: [
          { name: "Light jog & dynamic stretches", duration: "5 min" },
          { name: "Arm circles & shoulder mobility", duration: "2 min" },
          { name: "Lateral shuffles", duration: "2 min" },
          { name: "Catching practice (high & low)", duration: "5 min" },
          { name: "Batting shadow swings", duration: "3 min" },
          { name: "Throw-downs (short distance)", duration: "5 min" },
          { name: "Sprint drills (pitch length)", duration: "3 min" },
        ],
        recovery: [
          { name: "Slow cool-down walk", duration: "3 min" },
          { name: "Shoulder & rotator cuff stretch", duration: "3 min" },
          { name: "Lower back stretch", duration: "2 min" },
          { name: "Hamstring & quad stretch", duration: "3 min" },
          { name: "Wrist & forearm stretch", duration: "2 min" },
          { name: "Foam roll back & legs", duration: "4 min" },
          { name: "Gentle full-body stretch", duration: "3 min" },
        ],
      },
      Bowler: {
        warmup: [
          { name: "Light jog (increasing pace)", duration: "5 min" },
          { name: "Shoulder & arm circles (both arms)", duration: "3 min" },
          { name: "Trunk rotations", duration: "2 min" },
          { name: "Run-up practice (no ball)", duration: "3 min" },
          { name: "Short-distance bowling (60%)", duration: "5 min" },
          { name: "Yorker & bouncer practice", duration: "5 min" },
          { name: "Fielding drills", duration: "3 min" },
        ],
        recovery: [
          { name: "Slow cool-down walk", duration: "3 min" },
          { name: "Bowling arm shoulder stretch", duration: "3 min" },
          { name: "Lower back decompression", duration: "3 min" },
          { name: "Hip flexor stretch", duration: "2 min" },
          { name: "Hamstring & calf stretch", duration: "3 min" },
          { name: "Foam roll back & shoulder", duration: "4 min" },
          { name: "Ice pack on shoulder (if needed)", duration: "5 min" },
        ],
      },
    },
    "Volleyball": {
      default: {
        warmup: [
          { name: "Light jog (court perimeter)", duration: "3 min" },
          { name: "Arm circles & shoulder stretches", duration: "2 min" },
          { name: "Dynamic leg swings", duration: "2 min" },
          { name: "Vertical jump practice", duration: "3 min" },
          { name: "Passing drills (pepper)", duration: "5 min" },
          { name: "Setting practice", duration: "3 min" },
          { name: "Hitting approach & swing", duration: "5 min" },
        ],
        recovery: [
          { name: "Slow walk & deep breathing", duration: "3 min" },
          { name: "Shoulder & rotator cuff stretch", duration: "3 min" },
          { name: "Quad & knee stretch", duration: "2 min" },
          { name: "Ankle & calf stretch", duration: "2 min" },
          { name: "Lower back stretch", duration: "2 min" },
          { name: "Foam roll legs & shoulders", duration: "4 min" },
          { name: "Wrist & finger stretch", duration: "2 min" },
        ],
      },
    },
  };

  const getMatchExercises = (sport: string, role: string, action: string) => {
    const sportData = MATCH_EXERCISES[sport];
    if (!sportData) return [];
    const roleData = sportData[role] || sportData["default"];
    if (!roleData) return [];
    if (action === "warmup") return roleData.warmup || [];
    if (action === "recovery") return roleData.recovery || [];
    return [];
  };

  const matchExerciseStorageKey = `ogym_match_exercises_${user?.id}_${format(new Date(), 'yyyy-MM-dd')}`;
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem(matchExerciseStorageKey);
      if (saved) setMatchExercisesDone(JSON.parse(saved));
    } catch {}
  }, [matchExerciseStorageKey]);

  const toggleMatchExercise = (idx: number) => {
    setMatchExercisesDone(prev => {
      const next = { ...prev, [idx]: !prev[idx] };
      localStorage.setItem(matchExerciseStorageKey, JSON.stringify(next));
      return next;
    });
  };

  // Onboarding state (user-specific key to handle shared browsers)
  const onboardingKey = isPersonalMode ? `ogym_personal_onboarding_seen_${user?.id}` : `ogym_member_onboarding_seen_${user?.id}`;
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem(onboardingKey);
  });
  
  const completeOnboarding = () => {
    localStorage.setItem(onboardingKey, 'true');
    setShowOnboarding(false);
  };
  
  const { data: attendance = [] } = useMemberAttendance();
  const { data: payments = [] } = useMemberPayments();
  const { data: stats } = useMemberStats();
  const { data: workoutSummary } = useQuery<WorkoutSummary>({
    queryKey: ["/api/member/workout/summary"],
    staleTime: 1000 * 60 * 2,
  });
  const { data: todayWorkout, isLoading: workoutLoading } = useTodayWorkout();
  const { data: profile } = useMemberProfile();

  const { data: sportProfile } = useQuery<any>({
    queryKey: ["/api/sport/profile"],
  });

  const { data: todayMatchLog } = useQuery<any>({
    queryKey: ["/api/match-logs/date", format(new Date(), 'yyyy-MM-dd')],
    queryFn: async () => {
      const res = await fetch(`/api/match-logs/date/${format(new Date(), 'yyyy-MM-dd')}`);
      return res.json();
    },
  });

  const logMatchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/match-logs", data);
      return res.json();
    },
    onSuccess: () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ["/api/match-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/match-logs/date", today] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/calendar/enhanced'] });
      setMatchStep("done");
    },
    onError: () => {
      toast({ title: "Failed to log match", variant: "destructive" });
    },
  });

  const cancelMatchMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/match-logs/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      queryClient.invalidateQueries({ queryKey: ["/api/match-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/match-logs/date", today] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/calendar/enhanced'] });
      toast({ title: "Match day cancelled", description: "Your regular workout is restored." });
    },
  });

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const { data: calorieData } = useQuery<{ 
    summary: { calories: number; protein: number }; 
    goal: { dailyCalorieTarget: number; dailyProteinTarget?: number } | null 
  }>({
    queryKey: ["/api/nutrition/summary", todayDateStr],
    queryFn: async () => {
      const res = await fetch(`/api/nutrition/summary?date=${todayDateStr}`);
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["/api/nutrition/page-data", todayDateStr],
      queryFn: async () => {
        const res = await fetch(`/api/nutrition/page-data?date=${todayDateStr}`);
        return res.json();
      },
      staleTime: 1000 * 60 * 2,
    });
  }, [todayDateStr]);
  
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

  const getMatchDate = () => {
    return format(new Date(), 'yyyy-MM-dd');
  };

  const CALORIE_ESTIMATES: Record<string, Record<string, number>> = {
    "Football (Soccer)": { casual: 400, competitive: 700 },
    "Basketball": { casual: 350, competitive: 600 },
    "Tennis": { casual: 300, competitive: 550 },
    "Swimming": { casual: 350, competitive: 650 },
    "Boxing": { casual: 400, competitive: 750 },
    "MMA": { casual: 450, competitive: 800 },
    "Cricket": { casual: 200, competitive: 350 },
    "Volleyball": { casual: 250, competitive: 450 },
  };

  const handleSubmitMatch = () => {
    if (!sportProfile || !matchTiming || !matchAction) return;
    const sport = sportProfile.sport;
    const est = CALORIE_ESTIMATES[sport] || { casual: 300, competitive: 500 };
    const durationMultiplier = matchDuration / 60;
    const estimatedCalories = Math.round((matchIntensity === "competitive" ? est.competitive : est.casual) * durationMultiplier);

    const statusMap: Record<string, string> = {
      "today-going": "going",
      "today-done": "done",
      "tomorrow-": "scheduled",
      "yesterday-": "done",
    };
    const statusKey = matchTiming === "today" ? `today-${matchStatus}` : `${matchTiming}-`;
    const status = statusMap[statusKey] || "done";

    logMatchMutation.mutate({
      sport,
      sportProfileId: sportProfile.id,
      matchDate: getMatchDate(),
      matchTiming,
      status,
      duration: matchDuration,
      intensity: matchIntensity,
      caloriesBurned: estimatedCalories,
      workoutAction: matchAction,
    });
  };

  const openMatchDialog = () => {
    if (!sportProfile) {
      navigate("/sports-mode");
      return;
    }
    setMatchStep("timing");
    setMatchTiming("");
    setMatchStatus("");
    setMatchAction("");
    setMatchDuration(60);
    setMatchIntensity("casual");
    setShowMatchDialog(true);
  };

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
  
  const restTodayMutation = useMutation({
    mutationFn: async (adjustPlan: "none" | "swap_next_rest" | "push_workout") => {
      const res = await apiRequest("POST", "/api/workouts/rest-today", { adjustPlan });
      return res.json();
    },
    onSuccess: (data) => {
      setShowRestDayDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/schedule'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/missed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/calendar/enhanced'] });
      toast({ title: "Rest Day", description: data.message || "Enjoy your rest day!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed", description: error.message || "Could not mark as rest day", variant: "destructive" });
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

  // Helper to get exercise type styling
  const getExerciseTypeStyle = (item: any) => {
    if (item.exerciseType === 'cardio') {
      return { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'Cardio' };
    }
    if (item.muscleType === 'Core' || item.muscleType === 'Abs') {
      return { icon: Target, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Core' };
    }
    return { icon: Dumbbell, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Strength' };
  };

  const allCompleted = workoutItems.length > 0 && workoutItems.every((i: any) => i.completed);
  const incompleteIds = workoutItems.filter((i: any) => !i.completed).map((i: any) => i.id);
  const completedCount = workoutItems.filter((i: any) => i.completed).length;

  const [showConfetti, setShowConfetti] = useState(false);
  const prevAllCompletedRef = useRef(false);
  useEffect(() => {
    if (allCompleted && !prevAllCompletedRef.current && workoutItems.length > 0) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 100);
      return () => clearTimeout(timer);
    }
    prevAllCompletedRef.current = allCompleted;
  }, [allCompleted, workoutItems.length]);

  const handleMarkAllDone = () => {
    if (incompleteIds.length > 0) {
      completeAllMutation.mutate({ workoutItemIds: incompleteIds });
    }
  };

  const handleInputChange = (itemId: number, field: 'sets' | 'reps' | 'weight' | 'durationMinutes' | 'distanceKm', value: string) => {
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

  const addSet = (itemId: number, item: any) => {
    setPerSetInputs(prev => {
      const current = prev[itemId];
      if (!current) return prev;
      const lastSet = current.setInputs[current.setInputs.length - 1];
      const newSet: PerSetInput = {
        reps: lastSet?.reps || String(item.reps),
        weight: lastSet?.weight || item.weight || '',
        targetReps: lastSet?.targetReps || item.reps,
        targetWeight: lastSet?.targetWeight || item.weight || ''
      };
      return {
        ...prev,
        [itemId]: {
          ...current,
          setInputs: [...current.setInputs, newSet]
        }
      };
    });
  };

  const removeSet = (itemId: number) => {
    setPerSetInputs(prev => {
      const current = prev[itemId];
      if (!current || current.setInputs.length <= 1) return prev;
      return {
        ...prev,
        [itemId]: {
          ...current,
          setInputs: current.setInputs.slice(0, -1)
        }
      };
    });
  };

  // Helper to get local date in YYYY-MM-DD format (same as hooks use)
  const getLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleCompleteExercise = (item: any) => {
    const perSet = perSetInputs[item.id];
    
    // Cardio exercises use duration/distance instead of sets/reps/weight
    if (item.exerciseType === 'cardio') {
      const inputs = exerciseInputs[item.id] || {};
      completeWorkoutMutation.mutate({
        workoutItemId: item.id,
        actualDurationMinutes: inputs.durationMinutes ? parseInt(inputs.durationMinutes) : item.durationMinutes,
        actualDistanceKm: inputs.distanceKm || item.distanceKm || undefined
      });
      setExpandedItem(null);
      return;
    }
    
    // Strength exercises with per-set logging
    if (perSet && !perSet.sameForAll && perSet.setInputs.length > 0) {
      const todayStr = getLocalDate();
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
    if (item.exerciseType === 'cardio') {
      completeWorkoutMutation.mutate({
        workoutItemId: item.id,
        actualDurationMinutes: item.durationMinutes,
        actualDistanceKm: item.distanceKm || undefined
      });
    } else {
      completeWorkoutMutation.mutate({
        workoutItemId: item.id,
        actualSets: item.sets,
        actualReps: item.reps,
        actualWeight: item.weight || undefined
      });
    }
  };

  if (showOnboarding) {
    return isPersonalMode 
      ? <PersonalModeOnboarding onComplete={completeOnboarding} />
      : <MemberOnboarding onComplete={completeOnboarding} />;
  }

  if (workoutLoading && !todayWorkout && !stats) {
    return <MemberDashboardSkeleton />;
  }

  const streak = workoutSummary?.streak || 0;
  const caloriesLogged = calorieData?.summary?.calories || 0;
  const motiveLine = getMotivationalLine(streak, allCompleted, caloriesLogged);

  return (
    <div className="space-y-3 stagger-list">
      <ConfettiBurst trigger={showConfetti} />

      {/* Greeting Banner */}
      <GreetingBanner greeting={greeting} greetingIcon={greetingIcon} username={username} motiveLine={motiveLine} />

      <FeatureDiscoveryTips role="member" isPersonalMode={isPersonalMode} />

      {/* Today's Workout */}
      {todayMatchLog?.id && todayMatchLog.status !== "cancelled" && todayMatchLog.workoutAction && todayMatchLog.workoutAction !== "normal" ? (
        <Card className="card-ambient shadow-lg shadow-primary/5 relative" data-testid="card-today-workout-match">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl shadow-lg ${
                todayMatchLog.workoutAction === "rest" ? "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/25" :
                todayMatchLog.workoutAction === "warmup" ? "bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-500/25" :
                todayMatchLog.workoutAction === "recovery" ? "bg-gradient-to-br from-purple-500 to-pink-600 shadow-purple-500/25" :
                "bg-gradient-to-br from-primary to-indigo-600 shadow-primary/25"
              }`}>
                {todayMatchLog.workoutAction === "rest" && <Moon className="w-5 h-5 text-white" />}
                {todayMatchLog.workoutAction === "warmup" && <Flame className="w-5 h-5 text-white" />}
                {todayMatchLog.workoutAction === "recovery" && <Heart className="w-5 h-5 text-white" />}
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {todayMatchLog.workoutAction === "rest" ? "Rest Day" :
                   todayMatchLog.workoutAction === "warmup" ? "Warm-up Day" :
                   todayMatchLog.workoutAction === "recovery" ? "Recovery Day" : "Match Day"}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {todayMatchLog.sport} {todayMatchLog.matchTiming === "tomorrow" ? "- Match Tomorrow" : todayMatchLog.matchTiming === "yesterday" ? "- Post Match" : "- Match Day"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {(() => {
              const exercises = getMatchExercises(todayMatchLog.sport, sportProfile?.role || "default", todayMatchLog.workoutAction);
              const doneCount = exercises.filter((_: any, i: number) => matchExercisesDone[i]).length;
              const allDone = exercises.length > 0 && doneCount === exercises.length;
              return (
                <div className="space-y-3">
                  {todayMatchLog.workoutAction === "rest" ? (
                    <div className="rounded-xl bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">{todayMatchLog.sport}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your regular workout is paused. Rest up and save energy for the match. Stay hydrated and get a good night's sleep.
                      </p>
                    </div>
                  ) : exercises.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{exercises.length} exercises</span>
                          {allDone && (
                            <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-500 border-0 text-white text-[10px] py-0 px-1.5 no-default-hover-elevate no-default-active-elevate">
                              <Sparkles className="w-3 h-3 mr-0.5" /> Complete
                            </Badge>
                          )}
                        </div>
                        <Badge variant="secondary" className="border-0 bg-muted/60 text-[10px] no-default-hover-elevate no-default-active-elevate">
                          {doneCount}/{exercises.length}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {exercises.map((ex: { name: string; duration: string }, i: number) => (
                          <Button
                            key={i}
                            variant="ghost"
                            className={`w-full justify-start h-auto py-2.5 px-3 ${matchExercisesDone[i] ? 'opacity-60' : ''}`}
                            onClick={() => toggleMatchExercise(i)}
                            data-testid={`match-exercise-${i}`}
                          >
                            <div className="flex items-center gap-3 w-full">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                matchExercisesDone[i] 
                                  ? 'bg-green-500 border-green-500' 
                                  : 'border-muted-foreground/30'
                              }`}>
                                {matchExercisesDone[i] && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className={`text-sm text-left flex-1 ${matchExercisesDone[i] ? 'line-through text-muted-foreground' : ''}`}>
                                {ex.name}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">{ex.duration}</span>
                            </div>
                          </Button>
                        ))}
                      </div>
                      {!allDone && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const all: Record<string, boolean> = {};
                            exercises.forEach((_: any, i: number) => { all[i] = true; });
                            setMatchExercisesDone(all);
                            localStorage.setItem(matchExerciseStorageKey, JSON.stringify(all));
                          }}
                          data-testid="button-mark-all-match-done"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Mark All as Done
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl bg-muted/30 p-4">
                      <p className="text-sm text-muted-foreground">
                        {todayMatchLog.workoutAction === "warmup"
                          ? "Light dynamic stretching and mobility work to prepare for your match."
                          : "Light stretching, foam rolling, and easy cardio to help your body recover."}
                      </p>
                    </div>
                  )}
                  {(todayMatchLog.duration || todayMatchLog.caloriesBurned) && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                      {todayMatchLog.duration > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {todayMatchLog.duration} min
                        </span>
                      )}
                      {todayMatchLog.caloriesBurned > 0 && (
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3" /> ~{todayMatchLog.caloriesBurned} cal
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between px-1 pt-1">
                    <p className="text-[11px] text-muted-foreground/70">Regular workout cycle is not affected</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground h-7"
                      onClick={() => cancelMatchMutation.mutate(todayMatchLog.id)}
                      disabled={cancelMatchMutation.isPending}
                      data-testid="button-cancel-match-workout"
                    >
                      {cancelMatchMutation.isPending ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <X className="w-3 h-3 mr-1" />
                      )}
                      {cancelMatchMutation.isPending ? "Restoring..." : "Restore Workout"}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ) : (
      <Collapsible open={isWorkoutOpen} onOpenChange={setIsWorkoutOpen}>
        <Card className={`card-ambient shadow-lg shadow-primary/5 relative ${allCompleted ? 'card-shine' : ''}`} data-testid="card-today-workout">
          <CollapsibleTrigger asChild>
            <CardHeader className="flex flex-row items-center justify-between gap-2 cursor-pointer group pb-3 relative">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-primary to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-primary/25">
                  <Dumbbell className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Today's Workout</CardTitle>
                  {workoutItems.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {dayLabel ? (
                        <span className="font-medium">{dayLabel}</span>
                      ) : (
                        <span>Day {currentDayIndex + 1} of {cycleLength}</span>
                      )}
                      {muscleTypesDisplay && (
                        <span className="ml-1 text-primary/80 font-medium">{muscleTypesDisplay}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {sportProfile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 rounded-lg text-amber-500"
                    onClick={(e) => { e.stopPropagation(); openMatchDialog(); }}
                    data-testid="button-log-match"
                  >
                    <Trophy className="w-4 h-4" />
                  </Button>
                )}
                {workoutItems.length > 0 && (
                  <Badge 
                    variant={allCompleted ? "default" : "secondary"}
                    className={allCompleted ? "bg-gradient-to-r from-green-500 to-emerald-500 border-0 flex items-center gap-1 text-white shadow-md shadow-green-500/30 no-default-hover-elevate no-default-active-elevate" : "border-0 bg-muted/60"}
                    style={allCompleted ? { animation: 'ringGlow 2.5s ease-in-out infinite' } : undefined}
                  >
                    {allCompleted && <Sparkles className="w-3 h-3" style={{ animation: 'flameFlicker 1.2s ease-in-out infinite' }} />}
                    {allCompleted ? "Done" : `${completedCount}/${workoutItems.length}`}
                  </Badge>
                )}
                <div className="p-1.5 rounded-lg transition-colors">
                  {isWorkoutOpen ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          {workoutItems.length > 0 && !isWorkoutOpen && (
            <div className="px-6 pb-4 -mt-1 space-y-2">
              <WorkoutProgressBar completed={completedCount} total={workoutItems.length} />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground">{workoutItems.length} exercises</span>
                {muscleTypes.slice(0, 3).map((mt: string) => (
                  <Badge key={mt} variant="outline" className="text-[10px] py-0 px-1.5 border-primary/20 text-primary/80 no-default-hover-elevate no-default-active-elevate">{mt}</Badge>
                ))}
                {!allCompleted && (
                  <Button 
                    size="sm"
                    className="ml-auto text-[11px] h-7"
                    onClick={(e) => { e.stopPropagation(); setIsWorkoutOpen(true); }}
                    data-testid="button-start-workout-quick"
                  >
                    {completedCount > 0 ? "Continue" : "Start"}
                    <ChevronsRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}
          {isRestDay && !isWorkoutOpen && workoutItems.length === 0 && (
            <div className="px-6 pb-4 -mt-1">
              <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30" data-testid="rest-day-indicator">
                <BedDouble className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Rest day - recover and recharge</span>
              </div>
            </div>
          )}
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              {workoutLoading ? (
                <p className="text-muted-foreground text-center py-4">Loading...</p>
              ) : !workoutData?.cycleId ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Dumbbell className="w-7 h-7 text-primary" />
                  </div>
                  {canManageOwnWorkouts ? (
                    <>
                      <p className="font-medium mb-1">No Workout Cycle Yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Set up your workout plan to start tracking your exercises and progress.
                      </p>
                      <Link href="/my-workouts">
                        <Button data-testid="button-setup-workout">
                          <Plus className="w-4 h-4 mr-2" />
                          Set Up Workout
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="font-medium mb-1">No Workout Cycle Assigned</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Your trainer hasn't assigned a workout cycle yet. Contact your trainer to get started.
                      </p>
                    </>
                  )}
                </div>
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
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                              item.completed 
                                ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white cursor-default shadow-sm shadow-green-500/30' 
                                : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                            }`}
                            data-testid={`button-quick-complete-${item.id}`}
                          >
                            {item.completed ? (
                              <CheckCircle2 className="w-4 h-4 check-pop" />
                            ) : (
                              <span className="text-xs font-semibold">{index + 1}</span>
                            )}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const style = getExerciseTypeStyle(item);
                                const TypeIcon = style.icon;
                                return (
                                  <TypeIcon className={`w-3.5 h-3.5 ${style.color} flex-shrink-0`} />
                                );
                              })()}
                              <p className={`font-medium text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                                {item.exerciseName}
                              </p>
                              {item.sportProgramId && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 flex-shrink-0" data-testid={`sport-badge-dash-${item.id}`}>
                                  <Zap className="w-2.5 h-2.5 mr-0.5" />Sport
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground ml-5">
                              {item.exerciseType === 'cardio' ? (
                                <>
                                  {item.durationMinutes ? `${item.durationMinutes} min` : ''}
                                  {item.distanceKm ? ` · ${item.distanceKm}` : ''}
                                </>
                              ) : (
                                <>
                                  {item.sets}x{item.reps} {item.weight ? `@ ${item.weight}` : ''}
                                </>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-0.5">
                            {!item.completed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (exerciseHelpId === item.id) {
                                    setExerciseHelpId(null);
                                    return;
                                  }
                                  setExerciseHelpId(item.id);
                                  if (!exerciseHelpData[item.id]) {
                                    setExerciseHelpLoading(item.id);
                                    fetch(`/api/exercise-info?name=${encodeURIComponent(item.exerciseName)}`, { credentials: 'include' })
                                      .then(r => r.json())
                                      .then(data => {
                                        setExerciseHelpData(prev => ({ ...prev, [item.id]: data }));
                                        setExerciseHelpLoading(null);
                                      })
                                      .catch(() => setExerciseHelpLoading(null));
                                  }
                                }}
                                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${exerciseHelpId === item.id ? 'text-amber-600 bg-amber-500/20' : 'text-amber-500 hover:bg-amber-500/10'}`}
                                data-testid={`button-dika-exercise-${item.id}`}
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}
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
                        </div>
                        
                        {exerciseHelpId === item.id && !item.completed && (
                          <div className="px-3 pb-2 pt-1 border-t border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
                            {exerciseHelpLoading === item.id ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">Loading exercise info...</span>
                              </div>
                            ) : exerciseHelpData[item.id]?.found ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{exerciseHelpData[item.id].name}</span>
                                  </div>
                                  <button onClick={() => setExerciseHelpId(null)} className="text-muted-foreground hover:text-foreground" data-testid={`close-exercise-help-${item.id}`}>
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="flex flex-wrap gap-1 text-[10px]">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{exerciseHelpData[item.id].difficulty}</span>
                                  {exerciseHelpData[item.id].equipment?.map((eq: string) => (
                                    <span key={eq} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{eq}</span>
                                  ))}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  <span className="font-medium">Muscles:</span> {exerciseHelpData[item.id].primaryMuscles?.join(', ')}
                                  {exerciseHelpData[item.id].secondaryMuscles?.length > 0 && (
                                    <span> (also: {exerciseHelpData[item.id].secondaryMuscles.join(', ')})</span>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold text-foreground mb-1">How to do it:</p>
                                  <ol className="space-y-0.5 text-[10px] text-muted-foreground list-decimal list-inside">
                                    {exerciseHelpData[item.id].steps?.map((step: string, i: number) => (
                                      <li key={i}>{step}</li>
                                    ))}
                                  </ol>
                                </div>
                                {exerciseHelpData[item.id].tips?.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-foreground mb-0.5">Pro Tips:</p>
                                    <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                                      {exerciseHelpData[item.id].tips.map((tip: string, i: number) => (
                                        <li key={i} className="flex gap-1"><span className="text-amber-500">•</span> {tip}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {exerciseHelpData[item.id].commonMistakes?.length > 0 && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-red-500 dark:text-red-400 mb-0.5">Avoid:</p>
                                    <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                                      {exerciseHelpData[item.id].commonMistakes.map((m: string, i: number) => (
                                        <li key={i} className="flex gap-1"><span className="text-red-400">•</span> {m}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <div className="flex flex-col gap-1.5 pt-2 border-t border-amber-200/50 dark:border-amber-800/30 mt-1">
                                  <a
                                    href={exerciseHelpData[item.id].youtubeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[11px] font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                    data-testid={`youtube-link-${item.id}`}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                                    Watch video tutorial on YouTube
                                  </a>
                                  <button
                                    onClick={() => navigate(`/dika?exercise=${encodeURIComponent(item.exerciseName)}&sets=${item.sets || ''}&reps=${item.reps || ''}&muscle=${encodeURIComponent(item.muscleType || '')}&swap=1`)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 text-[11px] font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                    data-testid={`swap-exercise-${item.id}`}
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5 flex-shrink-0" />
                                    Want an alternative exercise? Swap it
                                  </button>
                                  <button
                                    onClick={() => navigate(`/dika?exercise=${encodeURIComponent(item.exerciseName)}&sets=${item.sets || ''}&reps=${item.reps || ''}&muscle=${encodeURIComponent(item.muscleType || '')}`)}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 text-[11px] font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                    data-testid={`ask-dika-${item.id}`}
                                  >
                                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                                    Have doubts? Ask Dika AI
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="py-3 text-center">
                                <p className="text-xs text-muted-foreground mb-1">No detailed info found for this exercise.</p>
                                <button
                                  onClick={() => navigate(`/dika?exercise=${encodeURIComponent(item.exerciseName)}&sets=${item.sets || ''}&reps=${item.reps || ''}&muscle=${encodeURIComponent(item.muscleType || '')}`)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700"
                                  data-testid={`ask-dika-fallback-${item.id}`}
                                >
                                  <Sparkles className="w-3 h-3" /> Ask Dika AI instead
                                </button>
                              </div>
                            )}
                          </div>
                        )}

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
                                
                                {item.exerciseType === 'cardio' ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-xs text-muted-foreground mb-1 block">Duration (min)</label>
                                      <Input
                                        type="number"
                                        placeholder={item.durationMinutes ? String(item.durationMinutes) : '30'}
                                        value={inputs.durationMinutes || ''}
                                        onChange={(e) => handleInputChange(item.id, 'durationMinutes', e.target.value)}
                                        className="h-9"
                                        data-testid={`input-duration-${item.id}`}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-muted-foreground mb-1 block">Distance</label>
                                      <Input
                                        type="text"
                                        placeholder={item.distanceKm || 'e.g., 5km'}
                                        value={inputs.distanceKm || ''}
                                        onChange={(e) => handleInputChange(item.id, 'distanceKm', e.target.value)}
                                        className="h-9"
                                        data-testid={`input-distance-${item.id}`}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <>
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
                                    
                                    {/* Add/Remove Set Buttons */}
                                    <div className="flex items-center justify-center gap-3 pt-2 border-t border-border/50 mt-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeSet(item.id)}
                                        disabled={(perSetInputs[item.id]?.setInputs?.length || 0) <= 1}
                                        className="h-8 px-3"
                                        data-testid={`button-remove-set-${item.id}`}
                                      >
                                        <Minus className="w-4 h-4 mr-1" />
                                        Remove Set
                                      </Button>
                                      <span className="text-sm text-muted-foreground">
                                        {perSetInputs[item.id]?.setInputs?.length || 0} sets
                                      </span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addSet(item.id, item)}
                                        className="h-8 px-3"
                                        data-testid={`button-add-set-${item.id}`}
                                      >
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add Set
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                  </>
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

                  {!allCompleted && !isRestDay && workoutData?.cycleId && (
                    <Button 
                      variant="ghost"
                      className="w-full mt-1 text-muted-foreground"
                      onClick={() => setShowRestDayDialog(true)}
                      data-testid="button-take-rest-day"
                    >
                      <BedDouble className="w-4 h-4 mr-2" />
                      Take Rest Day
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      )}

      {/* Calorie, Streak & Health */}
      {workoutSummary && (
        <div className="grid grid-cols-2 gap-2.5">
          <Link href="/progress/workouts" className="overflow-hidden rounded-xl">
            <AnimatedStatCard
              value={workoutSummary.streak}
              label="Day Streak"
              icon="flame"
              color="orange"
              delay={100}
            />
          </Link>
          <Link href="/nutrition" className="overflow-hidden rounded-xl">
            <CalorieProgressCard
              current={calorieData?.summary?.calories || 0}
              target={calorieData?.goal?.dailyCalorieTarget || 0}
              currentProtein={calorieData?.summary?.protein || 0}
              targetProtein={calorieData?.goal?.dailyProteinTarget || 0}
              delay={200}
            />
          </Link>
        </div>
      )}
      <div className="mt-1">
        <HealthActivityDashboard />
      </div>

      {/* Calendar */}
      <MemberCalendarWidget />

      {/* Trainer & Membership Info */}
      {memberProfile && (memberProfile.trainerName || memberProfile.cycleEndDate) && (
        <Card className="bg-card/70 backdrop-blur-sm">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {memberProfile.trainerName && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-br from-primary/[0.06] to-transparent">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-sm">
                    <User2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Trainer</p>
                    <p className="font-bold text-sm text-foreground leading-tight">{memberProfile.trainerName}</p>
                  </div>
                </div>
              )}
              {memberProfile.cycleEndDate && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gradient-to-br from-amber-500/[0.06] to-transparent">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Cycle Ends</p>
                    <p className="font-bold text-sm text-foreground leading-tight">{memberProfile.cycleEndDate}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}


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

      <Dialog open={showRestDayDialog} onOpenChange={setShowRestDayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-indigo-500" />
              Take Rest Day
            </DialogTitle>
            <DialogDescription>
              {dayLabel ? `Skip "${dayLabel}" today.` : "Skip today's workout."} How should we adjust your schedule?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <button
              onClick={() => restTodayMutation.mutate("swap_next_rest")}
              disabled={restTodayMutation.isPending}
              className="w-full text-left p-3 rounded-lg border border-border bg-muted/30 hover-elevate transition-colors"
              data-testid="button-rest-swap"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Swap with Next Rest Day</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Today's workout moves to the next rest day slot</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => restTodayMutation.mutate("push_workout")}
              disabled={restTodayMutation.isPending}
              className="w-full text-left p-3 rounded-lg border border-border bg-muted/30 hover-elevate transition-colors"
              data-testid="button-rest-push"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <ChevronsRight className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Push Workout Forward</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Today's workout shifts to tomorrow, others move forward</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => restTodayMutation.mutate("none")}
              disabled={restTodayMutation.isPending}
              className="w-full text-left p-3 rounded-lg border border-border bg-muted/30 hover-elevate transition-colors"
              data-testid="button-rest-skip"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-500/10">
                  <SkipForward className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Just Skip Today</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rest today, schedule stays the same</p>
                </div>
              </div>
            </button>
          </div>
          {restTodayMutation.isPending && (
            <div className="flex items-center justify-center gap-2 py-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Updating schedule...</span>
            </div>
          )}
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

      {/* Log a Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={(open) => { if (!open) { setShowMatchDialog(false); setMatchStep("timing"); } }}>
        <DialogContent className="sm:max-w-md">
          {matchStep === "timing" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Log a Match
                </DialogTitle>
                <DialogDescription>
                  {sportProfile?.sport} - {sportProfile?.role}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Button
                  variant="outline"
                  onClick={() => { setMatchTiming("tomorrow"); setMatchStep("action"); }}
                  className="w-full justify-start h-auto p-3"
                  data-testid="match-timing-tomorrow"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Calendar className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Tomorrow is Match</p>
                      <p className="text-xs text-muted-foreground font-normal">Prepare for tomorrow's game</p>
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setMatchTiming("today"); setMatchStep("today-status"); }}
                  className="w-full justify-start h-auto p-3"
                  data-testid="match-timing-today"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Zap className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Match Day</p>
                      <p className="text-xs text-muted-foreground font-normal">Playing a match today</p>
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setMatchTiming("yesterday"); setMatchStatus("done"); setMatchStep("action"); }}
                  className="w-full justify-start h-auto p-3"
                  data-testid="match-timing-yesterday"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Yesterday was Match</p>
                      <p className="text-xs text-muted-foreground font-normal">Log yesterday's game</p>
                    </div>
                  </div>
                </Button>
              </div>
            </>
          )}

          {matchStep === "today-status" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-green-500" />
                  Match Day
                </DialogTitle>
                <DialogDescription>
                  Are you heading to the match or already done?
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                <Button
                  variant="outline"
                  onClick={() => { setMatchStatus("going"); setMatchAction("normal"); setMatchStep("details"); }}
                  className="w-full justify-start h-auto p-3"
                  data-testid="match-status-going"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <ArrowRight className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Going for the Match</p>
                      <p className="text-xs text-muted-foreground font-normal">Today's workout replaced with match activity</p>
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setMatchStatus("done"); setMatchStep("action"); }}
                  className="w-full justify-start h-auto p-3"
                  data-testid="match-status-done"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Check className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Done with the Match</p>
                      <p className="text-xs text-muted-foreground font-normal">Log your match and get recovery suggestions</p>
                    </div>
                  </div>
                </Button>
              </div>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setMatchStep("timing")} data-testid="match-back-timing">
                Back
              </Button>
            </>
          )}

          {matchStep === "action" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {matchTiming === "tomorrow" && <Calendar className="w-5 h-5 text-blue-500" />}
                  {matchTiming === "today" && <Activity className="w-5 h-5 text-green-500" />}
                  {matchTiming === "yesterday" && <Clock className="w-5 h-5 text-amber-500" />}
                  {matchTiming === "tomorrow" ? "Prepare for Tomorrow" : matchTiming === "yesterday" ? "Post-Match Recovery" : "After the Match"}
                </DialogTitle>
                <DialogDescription>
                  {matchTiming === "tomorrow" 
                    ? "How would you like to prepare for your match?" 
                    : "What would you like to do for today's workout?"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-2">
                {matchTiming === "tomorrow" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => { setMatchAction("rest"); setMatchStep("details"); }}
                      className="w-full justify-start h-auto p-3"
                      data-testid="match-action-rest"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                          <BedDouble className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Rest Today</p>
                          <p className="text-xs text-muted-foreground font-normal">Save energy for tomorrow's match</p>
                        </div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setMatchAction("warmup"); setMatchStep("details"); }}
                      className="w-full justify-start h-auto p-3"
                      data-testid="match-action-warmup"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <Flame className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Light Warm-up</p>
                          <p className="text-xs text-muted-foreground font-normal">Dynamic stretching and mobility work</p>
                        </div>
                      </div>
                    </Button>
                  </>
                )}
                {(matchTiming === "yesterday" || (matchTiming === "today" && matchStatus === "done")) && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => { setMatchAction("recovery"); setMatchStep("details"); }}
                      className="w-full justify-start h-auto p-3"
                      data-testid="match-action-recovery"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Heart className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Recovery Workout</p>
                          <p className="text-xs text-muted-foreground font-normal">Light stretching, foam rolling, easy cardio</p>
                        </div>
                      </div>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setMatchAction("rest"); setMatchStep("details"); }}
                      className="w-full justify-start h-auto p-3"
                      data-testid="match-action-rest-after"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                          <BedDouble className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">Full Rest</p>
                          <p className="text-xs text-muted-foreground font-normal">Take a complete rest day to recover</p>
                        </div>
                      </div>
                    </Button>
                  </>
                )}
              </div>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setMatchStep(matchTiming === "today" ? "today-status" : "timing")} data-testid="match-back-action">
                Back
              </Button>
            </>
          )}

          {matchStep === "details" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  Match Details
                </DialogTitle>
                <DialogDescription>
                  {sportProfile?.sport} - {matchTiming === "tomorrow" ? "Tomorrow" : matchTiming === "yesterday" ? "Yesterday" : "Today"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {(matchTiming !== "tomorrow" || matchAction === "warmup") && (
                  <>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Duration (minutes)</Label>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => setMatchDuration(Math.max(15, matchDuration - 15))} data-testid="match-duration-minus">
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="text-lg font-bold w-16 text-center">{matchDuration}</span>
                        <Button variant="outline" size="sm" onClick={() => setMatchDuration(Math.min(300, matchDuration + 15))} data-testid="match-duration-plus">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Intensity</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setMatchIntensity("casual")}
                          className={`p-3 rounded-lg border text-center transition-colors ${matchIntensity === "casual" ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                          data-testid="match-intensity-casual"
                        >
                          <p className="text-sm font-medium">Casual</p>
                          <p className="text-xs text-muted-foreground">Friendly game</p>
                        </button>
                        <button
                          onClick={() => setMatchIntensity("competitive")}
                          className={`p-3 rounded-lg border text-center transition-colors ${matchIntensity === "competitive" ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50'}`}
                          data-testid="match-intensity-competitive"
                        >
                          <p className="text-sm font-medium">Competitive</p>
                          <p className="text-xs text-muted-foreground">Serious match</p>
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {matchAction && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Today's plan</p>
                    <p className="text-sm font-medium">
                      {matchAction === "rest" && "Full Rest Day - No workout, save your energy"}
                      {matchAction === "warmup" && "Light Warm-up - Dynamic stretching and mobility"}
                      {matchAction === "recovery" && "Recovery Session - Foam rolling, stretching, light cardio"}
                      {matchAction === "normal" && `${sportProfile?.sport} Match - Counts as today's workout`}
                    </p>
                    {matchTiming !== "tomorrow" && (
                      <p className="text-xs text-primary mt-1">
                        ~{Math.round(((CALORIE_ESTIMATES[sportProfile?.sport || ""] || { casual: 300, competitive: 500 })[matchIntensity] || 300) * (matchDuration / 60))} cal estimated
                      </p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setMatchStep(matchTiming === "today" && matchStatus === "going" ? "today-status" : "action")} data-testid="match-back-details">
                  Back
                </Button>
                <Button onClick={handleSubmitMatch} disabled={logMatchMutation.isPending} data-testid="match-confirm">
                  {logMatchMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Logging...
                    </>
                  ) : "Confirm"}
                </Button>
              </DialogFooter>
            </>
          )}

          {matchStep === "done" && (
            <>
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-bold mb-1">Match Logged!</h3>
                <p className="text-sm text-muted-foreground">
                  {matchAction === "rest" && "Enjoy your rest day. Your regular workout cycle is unchanged."}
                  {matchAction === "warmup" && "Do some light stretching and mobility work. Good luck tomorrow!"}
                  {matchAction === "recovery" && "Take it easy with some foam rolling and light stretching."}
                  {matchAction === "normal" && "Your match counts as today's activity. Great game!"}
                </p>
              </div>
              <Button className="w-full" onClick={() => setShowMatchDialog(false)} data-testid="match-done-close">
                Done
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
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
    staleTime: 1000 * 60 * 5,
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
    const baseStyles = "p-2 text-sm rounded-2xl transition-all duration-200 relative font-medium";
    const todayRing = isTodayDate ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "";
    
    switch (status) {
      case "present":
        return `${baseStyles} bg-green-500/15 text-green-700 dark:text-green-400 cursor-pointer hover:bg-green-500/25 ${todayRing}`;
      case "absent":
        return `${baseStyles} bg-red-500/15 text-red-700 dark:text-red-400 cursor-pointer hover:bg-red-500/25 ${todayRing}`;
      case "rest":
        return `${baseStyles} bg-blue-500/10 text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-500/15 ${todayRing}`;
      case "future":
        return `${baseStyles} text-muted-foreground/40 cursor-default ${todayRing}`;
      default:
        return `${baseStyles} text-muted-foreground/60 ${todayRing}`;
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
    <Card className="card-ambient backdrop-blur-sm relative" data-testid="card-calendar">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 relative z-10">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="p-1.5 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg shadow-sm" style={{ boxShadow: '0 2px 8px hsl(var(--primary) / 0.15)' }}>
            <Calendar className="w-3.5 h-3.5 text-primary" />
          </div>
          Calendar
        </CardTitle>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-semibold min-w-[90px] text-center tabular-nums">
            {format(currentMonth, "MMM yyyy")}
          </span>
          <Button variant="ghost" size="icon" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-[10px] text-muted-foreground font-medium">Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-red-400 rounded-full" />
            <span className="text-[10px] text-muted-foreground font-medium">Missed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-blue-400 rounded-full" />
            <span className="text-[10px] text-muted-foreground font-medium">Rest</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <div key={`${day}-${i}`} className="text-[10px] text-muted-foreground/60 font-semibold py-1 uppercase tracking-wider">
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
