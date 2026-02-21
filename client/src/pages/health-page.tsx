import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import {
  useHealthStatus,
  useHealthDataToday,
  useHealthDataRange,
  useConnectHealth,
  useDisconnectHealth,
  useSyncHealth,
  useHealthServiceInfo,
} from '@/hooks/use-health-data';
import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import {
  Footprints,
  Flame,
  Heart,
  Moon,
  Activity,
  Watch,
  TrendingUp,
  TrendingDown,
  Zap,
  RefreshCw,
  Loader2,
  Smartphone,
  Utensils,
  ArrowUpDown,
  Timer,
  BarChart3,
  Sparkles,
  Unplug,
  Plug,
  Info,
  Eye,
  Shield,
  Trophy,
  Calendar,
  X,
  Crown,
  Target,
  Brain,
} from 'lucide-react';
import { SiApple, SiGoogle } from 'react-icons/si';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { HealthData, FoodLog, UserGoal } from '@shared/schema';

function useCountUp(target: number, duration: number = 1200, enabled: boolean = true) {
  const [value, setValue] = useState(0);
  const prevTargetRef = useRef(target);
  
  useEffect(() => {
    if (!enabled || target <= 0) {
      setValue(target <= 0 ? 0 : target);
      return;
    }
    const from = prevTargetRef.current !== target ? 0 : 0;
    prevTargetRef.current = target;
    const startTime = performance.now();
    let rafId: number;
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, enabled]);
  
  return value;
}

function AnimatedRing({ value, max, size = 58, strokeWidth = 5, color, glowColor, icon: Icon, label, displayValue, unit, hasData = true, goalReached = false }: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  glowColor: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  displayValue: string;
  unit?: string;
  hasData?: boolean;
  goalReached?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = hasData ? Math.min(value / max, 1) : 0;
  const progress = pct * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {hasData && pct > 0.5 && (
          <div className="absolute inset-0 rounded-full" style={{ 
            boxShadow: `0 0 20px ${glowColor}`,
            transition: 'box-shadow 1s ease'
          }} />
        )}
        {goalReached && (
          <div className="absolute inset-0 rounded-full animate-pulse" style={{ 
            boxShadow: `0 0 25px ${glowColor}, 0 0 50px ${glowColor}`,
          }} />
        )}
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            className="text-muted/10"
          />
          {hasData && (
            <circle
              cx={center} cy={center} r={radius}
              fill="none" stroke={color} strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {goalReached ? (
            <Crown className="w-3 h-3 mb-0.5 text-amber-500" />
          ) : (
            <Icon className="w-3 h-3 mb-0.5" style={{ color: hasData ? color : 'hsl(var(--muted-foreground))' }} />
          )}
          <span className={`text-xs font-bold tracking-tight ${!hasData ? 'text-muted-foreground' : ''}`}>{displayValue}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-foreground/80">{label}</p>
        {unit && <p className="text-[10px] text-muted-foreground">{unit}</p>}
      </div>
    </div>
  );
}

function RecoveryGauge({ score, dataPoints }: { score: number; dataPoints: number }) {
  const getConfig = (s: number) => {
    if (s >= 80) return { color: '#22c55e', glow: 'rgba(34,197,94,0.15)', label: 'Excellent' };
    if (s >= 60) return { color: '#3b82f6', glow: 'rgba(59,130,246,0.15)', label: 'Good' };
    if (s >= 40) return { color: '#f59e0b', glow: 'rgba(245,158,11,0.15)', label: 'Fair' };
    return { color: '#ef4444', glow: 'rgba(239,68,68,0.15)', label: 'Low' };
  };

  const config = getConfig(score);
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const center = size / 2;

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full" style={{
          boxShadow: `0 0 30px ${config.glow}, 0 0 60px ${config.glow}`,
        }} />
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/10" />
          <circle cx={center} cy={center} r={radius} fill="none" stroke={config.color} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 6px ${config.color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black tracking-tighter" data-testid="text-recovery-score">{score}</span>
          <span className="text-[11px] font-medium text-muted-foreground">{config.label}</span>
        </div>
      </div>
      {dataPoints < 4 && (
        <div className="flex items-center gap-1 mt-2">
          <Info className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">{dataPoints}/4 metrics</span>
        </div>
      )}
    </div>
  );
}

function DataSourceBadge({ label }: { label: string }) {
  return (
    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/30 text-[9px] text-muted-foreground font-medium">
      <Shield className="w-2.5 h-2.5" />
      {label}
    </div>
  );
}

function DayDetailSheet({ data, date, onClose }: { data: any; date: string; onClose: () => void }) {
  const d = new Date(date + 'T12:00:00');
  const dayLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  
  const formatSleep = (mins: number) => {
    if (!mins) return '--';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose} data-testid="sheet-day-detail">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div 
        className="relative w-full max-w-lg bg-card rounded-t-3xl p-5 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold">{dayLabel}</h3>
            <p className="text-xs text-muted-foreground">{data ? 'Daily breakdown' : 'No data synced'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose} data-testid="button-close-sheet">
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {data ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Footprints className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Steps</span>
              </div>
              <p className="text-xl font-bold">{data.steps ? data.steps.toLocaleString() : '--'}</p>
            </div>
            <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Burned</span>
              </div>
              <p className="text-xl font-bold">{data.calories ? `${data.calories} cal` : '--'}</p>
            </div>
            <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Avg HR</span>
              </div>
              <p className="text-xl font-bold">{data.hr ? `${data.hr} bpm` : '--'}</p>
            </div>
            <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/10">
              <div className="flex items-center gap-2 mb-1">
                <Moon className="w-4 h-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Sleep</span>
              </div>
              <p className="text-xl font-bold">{data.sleep > 0 ? formatSleep(data.sleepMinutes) : '--'}</p>
            </div>
            {data.activeMinutes > 0 && (
              <div className="col-span-2 p-3 bg-green-500/5 rounded-xl border border-green-500/10">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Active Minutes</span>
                </div>
                <p className="text-xl font-bold">{data.activeMinutes} min</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Moon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No health data was synced on this day</p>
          </div>
        )}
      </div>
    </div>
  );
}

function computeRecoveryScore(healthData: HealthData | null): { score: number; factors: { label: string; value: string; impact: 'positive' | 'neutral' | 'negative'; source: string }[]; dataPoints: number; hasEnoughData: boolean } {
  if (!healthData) return { score: 0, factors: [], dataPoints: 0, hasEnoughData: false };

  const factors: { label: string; value: string; impact: 'positive' | 'neutral' | 'negative'; source: string }[] = [];
  let totalWeight = 0;
  let weightedScore = 0;
  let dataPoints = 0;

  if (healthData.sleepMinutes && healthData.sleepMinutes > 0) {
    dataPoints++;
    const hours = healthData.sleepMinutes / 60;
    const weight = 35;
    totalWeight += weight;
    if (hours >= 7.5) {
      weightedScore += weight;
      factors.push({ label: 'Sleep', value: `${hours.toFixed(1)}h`, impact: 'positive', source: 'Device' });
    } else if (hours >= 6) {
      weightedScore += weight * 0.6;
      factors.push({ label: 'Sleep', value: `${hours.toFixed(1)}h`, impact: 'neutral', source: 'Device' });
    } else {
      weightedScore += weight * 0.2;
      factors.push({ label: 'Sleep', value: `${hours.toFixed(1)}h`, impact: 'negative', source: 'Device' });
    }
  }

  if (healthData.restingHeartRate && healthData.restingHeartRate > 0) {
    dataPoints++;
    const weight = 25;
    totalWeight += weight;
    if (healthData.restingHeartRate < 60) {
      weightedScore += weight;
      factors.push({ label: 'Resting HR', value: `${healthData.restingHeartRate} bpm`, impact: 'positive', source: 'Device' });
    } else if (healthData.restingHeartRate <= 75) {
      weightedScore += weight * 0.6;
      factors.push({ label: 'Resting HR', value: `${healthData.restingHeartRate} bpm`, impact: 'neutral', source: 'Device' });
    } else {
      weightedScore += weight * 0.2;
      factors.push({ label: 'Resting HR', value: `${healthData.restingHeartRate} bpm`, impact: 'negative', source: 'Device' });
    }
  }

  if (healthData.activeMinutes && healthData.activeMinutes > 0) {
    dataPoints++;
    const weight = 20;
    totalWeight += weight;
    if (healthData.activeMinutes > 90) {
      weightedScore += weight * 0.3;
      factors.push({ label: 'Activity', value: `${healthData.activeMinutes}min`, impact: 'negative', source: 'Device' });
    } else if (healthData.activeMinutes >= 30) {
      weightedScore += weight;
      factors.push({ label: 'Activity', value: `${healthData.activeMinutes}min`, impact: 'positive', source: 'Device' });
    } else {
      weightedScore += weight * 0.5;
      factors.push({ label: 'Activity', value: `${healthData.activeMinutes}min`, impact: 'neutral', source: 'Device' });
    }
  }

  if (healthData.steps && healthData.steps > 0) {
    dataPoints++;
    const weight = 20;
    totalWeight += weight;
    if (healthData.steps >= 8000) {
      weightedScore += weight;
      factors.push({ label: 'Steps', value: healthData.steps >= 1000 ? `${(healthData.steps / 1000).toFixed(1)}k` : `${healthData.steps}`, impact: 'positive', source: 'Device' });
    } else if (healthData.steps >= 4000) {
      weightedScore += weight * 0.6;
      factors.push({ label: 'Steps', value: healthData.steps >= 1000 ? `${(healthData.steps / 1000).toFixed(1)}k` : `${healthData.steps}`, impact: 'neutral', source: 'Device' });
    } else {
      weightedScore += weight * 0.3;
      factors.push({ label: 'Steps', value: `${healthData.steps}`, impact: 'negative', source: 'Device' });
    }
  }

  const hasEnoughData = dataPoints >= 1;
  const score = totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 0;

  return { score, factors, dataPoints, hasEnoughData };
}

function generateInsights(healthData: HealthData | null, caloriesEaten: number, recoveryScore: number, stepGoal: number): string[] {
  const insights: string[] = [];
  if (!healthData) return [];

  if (recoveryScore >= 80) {
    insights.push('Your recovery is excellent today \u2014 perfect for a challenging workout');
  } else if (recoveryScore >= 60) {
    insights.push('Good recovery \u2014 you can handle moderate intensity training');
  } else if (recoveryScore >= 40) {
    insights.push('Recovery is fair \u2014 consider lighter exercises or active recovery');
  } else if (recoveryScore > 0) {
    insights.push('Low recovery detected \u2014 rest day recommended for best results');
  }

  if (healthData.steps && healthData.steps > 0) {
    if (healthData.steps >= stepGoal) {
      insights.push(`You hit your ${stepGoal >= 1000 ? `${(stepGoal / 1000).toFixed(0)}k` : stepGoal} step goal!`);
    } else if (healthData.steps >= stepGoal * 0.7) {
      const remaining = stepGoal - healthData.steps;
      insights.push(`Almost there! ${remaining.toLocaleString()} more steps to hit your ${stepGoal >= 1000 ? `${(stepGoal / 1000).toFixed(0)}k` : stepGoal} goal`);
    }
  }

  if (healthData.sleepMinutes && healthData.sleepMinutes > 0) {
    if (healthData.sleepMinutes >= 420 && healthData.sleepMinutes <= 540) {
      insights.push('Great sleep duration \u2014 your body had optimal recovery time');
    } else if (healthData.sleepMinutes < 360) {
      insights.push('Sleep was below 6 hours \u2014 try to get more rest for better recovery');
    }
  }

  if (caloriesEaten > 0 && healthData.caloriesBurned && healthData.caloriesBurned > 0) {
    const balance = caloriesEaten - healthData.caloriesBurned;
    if (balance < -500) {
      insights.push('Large calorie deficit \u2014 make sure you\'re eating enough to fuel recovery');
    }
  }

  if (healthData.restingHeartRate && healthData.restingHeartRate > 80) {
    insights.push('Resting heart rate is elevated \u2014 could be stress or dehydration');
  }

  return insights.slice(0, 3);
}

function getRecoveryBgClass(score: number): string {
  if (score >= 80) return 'from-emerald-500/[0.04] via-emerald-500/[0.01]';
  if (score >= 60) return 'from-blue-500/[0.04] via-blue-500/[0.01]';
  if (score >= 40) return 'from-amber-500/[0.04] via-amber-500/[0.01]';
  if (score > 0) return 'from-red-500/[0.04] via-red-500/[0.01]';
  return '';
}

interface HealthStats {
  bestStepsDay: { date: string; steps: number };
  bestCaloriesDay: { date: string; calories: number };
  totalSteps: number;
  totalCalories: number;
  daysTracked: number;
  stepGoalDays: number;
  currentStreak: number;
  maxStreak: number;
  weeklyStepChange: number;
  thisWeekSteps: number;
  prevWeekSteps: number;
}

export default function HealthPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isNativePlatform = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const { data: status, isLoading: statusLoading } = useHealthStatus();
  const { data: todayData, isLoading: todayLoading } = useHealthDataToday();
  const connectHealth = useConnectHealth();
  const disconnectHealth = useDisconnectHealth();
  const syncHealth = useSyncHealth();
  const { isAvailable, availableSource } = useHealthServiceInfo();

  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');
  const [selectedDay, setSelectedDay] = useState<{ date: string; data: any } | null>(null);

  const today = new Date();
  const rangeDays = chartRange === '7d' ? 6 : 29;
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - rangeDays);
  const startDate = rangeStart.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const { data: rangeData } = useHealthDataRange(startDate, endDate);

  const todayDateStr = today.toISOString().split('T')[0];
  const { data: todayFoodLogs } = useQuery<FoodLog[]>({
    queryKey: ['/api/food-logs', todayDateStr],
  });

  const { data: userGoals } = useQuery<UserGoal>({
    queryKey: ['/api/user/goals'],
  });

  const { data: healthStats } = useQuery<HealthStats>({
    queryKey: ['/api/health/stats'],
  });

  const stepGoal = 10000;
  const calorieGoal = userGoals?.dailyCalorieTarget || 500;

  const caloriesEaten = useMemo(() => {
    if (!todayFoodLogs || !Array.isArray(todayFoodLogs)) return 0;
    return todayFoodLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
  }, [todayFoodLogs]);

  const recovery = useMemo(() => computeRecoveryScore(todayData || null), [todayData]);
  const insights = useMemo(() => generateInsights(todayData || null, caloriesEaten, recovery.score, stepGoal), [todayData, caloriesEaten, recovery.score, stepGoal]);

  const animSteps = useCountUp(todayData?.steps || 0, 1200, !!(todayData?.steps && todayData.steps > 0));
  const animCals = useCountUp(todayData?.caloriesBurned || 0, 1000, !!(todayData?.caloriesBurned && todayData.caloriesBurned > 0));
  const animHR = useCountUp(todayData?.avgHeartRate || 0, 800, !!(todayData?.avgHeartRate && todayData.avgHeartRate > 0));

  const chartData = useMemo(() => {
    const days: { date: string; label: string; steps: number; calories: number; hr: number; sleep: number; sleepMinutes: number; activeMinutes: number; hasData: boolean }[] = [];
    for (let i = rangeDays; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const match = rangeData?.find((wd) => wd.date === dateStr);
      const label = chartRange === '30d' 
        ? `${monthNames[d.getMonth()]} ${d.getDate()}`
        : dayNames[d.getDay()];
      days.push({
        date: dateStr,
        label,
        steps: match?.steps || 0,
        calories: match?.caloriesBurned || 0,
        hr: match?.avgHeartRate || 0,
        sleep: match?.sleepMinutes ? Math.round(match.sleepMinutes / 60 * 10) / 10 : 0,
        sleepMinutes: match?.sleepMinutes || 0,
        activeMinutes: match?.activeMinutes || 0,
        hasData: !!match,
      });
    }
    return days;
  }, [rangeData, chartRange, rangeDays]);

  const isConnected = status?.connected || (user as any)?.healthConnected || !!todayData;
  const isLoading = statusLoading || todayLoading;
  const caloriesBurned = todayData?.caloriesBurned || 0;
  const calorieBalance = caloriesEaten - caloriesBurned;
  const healthSource = status?.source || (user as any)?.healthSource;
  const sourceName = healthSource === 'apple_health' ? 'Apple Health' : healthSource === 'google_fit' ? 'Google Fit' : 'Health';

  const hasSteps = !!todayData?.steps && todayData.steps > 0;
  const hasCals = !!todayData?.caloriesBurned && todayData.caloriesBurned > 0;
  const hasHR = !!todayData?.avgHeartRate && todayData.avgHeartRate > 0;
  const hasSleep = !!todayData?.sleepMinutes && todayData.sleepMinutes > 0;
  const hasActiveMinutes = !!todayData?.activeMinutes && todayData.activeMinutes > 0;
  const trackedMetrics = [hasSteps, hasCals, hasHR, hasSleep].filter(Boolean).length;
  const stepGoalReached = hasSteps && todayData!.steps! >= stepGoal;

  const handleConnect = async () => {
    try {
      await connectHealth.mutateAsync();
      toast({ title: 'Connected', description: `Successfully connected to ${platform === 'ios' ? 'Apple Health' : 'Google Fit'}` });
    } catch (error: any) {
      const message = platform === 'ios' 
        ? 'Could not connect to Apple Health. Please make sure Health is enabled in Settings > Privacy > Health.'
        : 'Could not connect to Google Fit. Please make sure Google Fit is installed and permissions are granted.';
      toast({ title: 'Connection failed', description: message, variant: 'destructive' });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectHealth.mutateAsync();
      toast({ title: 'Disconnected', description: 'Health service disconnected' });
    } catch {
      toast({ title: 'Error', description: 'Could not disconnect', variant: 'destructive' });
    }
  };

  const handleSync = async () => {
    try {
      await syncHealth.mutateAsync();
      toast({ title: 'Synced', description: 'Health data updated' });
    } catch {
      toast({ title: 'Sync failed', description: 'Could not sync health data', variant: 'destructive' });
    }
  };

  const handleBarClick = useCallback((data: any) => {
    if (data?.activePayload?.[0]?.payload) {
      const entry = data.activePayload[0].payload;
      setSelectedDay({
        date: entry.date,
        data: entry.hasData ? entry : null,
      });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold font-display">Health & Activity</h1>
        </div>
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!isNativePlatform && !isConnected && !todayData && !(rangeData && rangeData.length > 0)) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold font-display">Health & Activity</h1>
        </div>
        <Card className="border-dashed border-2 overflow-hidden relative" data-testid="card-health-web-notice">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
          <CardContent className="pt-8 pb-8 relative">
            <div className="text-center space-y-5">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Smartphone className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg">Connect via Mobile App</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Open OGym on your iPhone or Android to connect Apple Health or Google Fit
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 max-w-xs mx-auto">
                <div className="flex items-center gap-2.5 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                  <Footprints className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Steps</span>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">Calories</span>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">Heart Rate</span>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                  <Moon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Sleep</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isNativePlatform && !isConnected) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold font-display">Health & Activity</h1>
        </div>
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                {platform === 'ios' ? <SiApple className="w-8 h-8" /> : <SiGoogle className="w-8 h-8" />}
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">Connect {platform === 'ios' ? 'Apple Health' : 'Google Fit'}</h3>
                <p className="text-sm text-muted-foreground">Track your steps, heart rate, sleep quality and more</p>
              </div>
              <Button onClick={handleConnect} disabled={connectHealth.isPending} className="w-full rounded-xl h-12 text-base font-semibold" data-testid="button-connect-health">
                {connectHealth.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plug className="w-5 h-5 mr-2" />}
                Connect Now
              </Button>
            </div>
          </div>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl"><Footprints className="w-4 h-4 text-blue-500" /><span className="text-sm">Steps & Distance</span></div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl"><Flame className="w-4 h-4 text-orange-500" /><span className="text-sm">Calories Burned</span></div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl"><Heart className="w-4 h-4 text-red-500" /><span className="text-sm">Heart Rate</span></div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl"><Moon className="w-4 h-4 text-purple-500" /><span className="text-sm">Sleep Tracking</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatSleep = (mins: number) => {
    if (!mins) return '--';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const daysWithData = chartData.filter(d => d.hasData).length;
  const avgSteps = chartData.filter(d => d.steps > 0).reduce((sum, d) => sum + d.steps, 0) / Math.max(chartData.filter(d => d.steps > 0).length, 1);
  const avgCals = chartData.filter(d => d.calories > 0).reduce((sum, d) => sum + d.calories, 0) / Math.max(chartData.filter(d => d.calories > 0).length, 1);

  const noDataAtAll = !todayData || trackedMetrics === 0;

  const bestDayThisWeek = chartData.filter(d => d.hasData && d.steps > 0).sort((a, b) => b.steps - a.steps)[0];

  const recoveryBg = recovery.hasEnoughData ? getRecoveryBgClass(recovery.score) : '';

  const formatBestDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const stepsDisplay = hasSteps ? (animSteps >= 1000 ? `${(animSteps / 1000).toFixed(1)}k` : `${animSteps}`) : '--';
  const calsDisplay = hasCals ? `${animCals}` : '--';
  const hrDisplay = hasHR ? `${animHR}` : '--';

  return (
    <div className={`p-4 space-y-4 max-w-lg mx-auto pb-24 bg-gradient-to-b ${recoveryBg} to-transparent min-h-screen transition-colors duration-1000`} data-testid="page-health">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10">
            <Activity className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Health & Activity</h1>
            <p className="text-[11px] text-muted-foreground">Today's overview</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px] gap-1 rounded-lg px-2 py-1 bg-muted/50">
            {status?.source === 'apple_health' ? <SiApple className="w-2.5 h-2.5" /> : status?.source === 'google_fit' ? <SiGoogle className="w-2.5 h-2.5" /> : <Watch className="w-2.5 h-2.5" />}
            {sourceName}
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleSync} disabled={syncHealth.isPending} data-testid="button-sync-health">
            <RefreshCw className={`w-4 h-4 ${syncHealth.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {noDataAtAll && (
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-amber-500/5 via-card to-card shadow-lg">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 mt-0.5">
                <Info className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium mb-1">No data synced yet today</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Open the OGym app on your phone to sync today's data from {sourceName}. Your data updates each time you open the app.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {healthStats && healthStats.currentStreak > 0 && (
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-red-500/10" data-testid="card-step-streak">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔥</div>
              <div className="flex-1">
                <p className="text-sm font-bold">
                  {healthStats.currentStreak} day step streak!
                </p>
                <p className="text-[11px] text-muted-foreground">
                  You've hit your 10k step goal {healthStats.currentStreak} day{healthStats.currentStreak > 1 ? 's' : ''} in a row
                </p>
              </div>
              {healthStats.maxStreak > healthStats.currentStreak && (
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Best</p>
                  <p className="text-sm font-bold text-amber-600">{healthStats.maxStreak}d</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {healthStats && healthStats.weeklyStepChange !== 0 && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-weekly-comparison">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${healthStats.weeklyStepChange > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                {healthStats.weeklyStepChange > 0 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  You walked <span className={`font-bold ${healthStats.weeklyStepChange > 0 ? 'text-green-500' : 'text-red-500'}`}>{Math.abs(healthStats.weeklyStepChange)}% {healthStats.weeklyStepChange > 0 ? 'more' : 'less'}</span> than last week
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {healthStats.thisWeekSteps.toLocaleString()} vs {healthStats.prevWeekSteps.toLocaleString()} steps
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/20 shadow-lg" data-testid="section-daily-overview">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-4 gap-4">
            <AnimatedRing
              value={todayData?.steps || 0} max={stepGoal}
              color="#3b82f6" glowColor="rgba(59,130,246,0.15)"
              icon={Footprints} label="Steps"
              displayValue={stepsDisplay}
              unit={hasSteps ? `/ ${stepGoal >= 1000 ? `${(stepGoal / 1000).toFixed(0)}k` : stepGoal}` : undefined}
              hasData={hasSteps}
              goalReached={stepGoalReached}
            />
            <AnimatedRing
              value={todayData?.caloriesBurned || 0} max={calorieGoal}
              color="#f97316" glowColor="rgba(249,115,22,0.15)"
              icon={Flame} label="Burned"
              displayValue={calsDisplay}
              unit={hasCals ? 'cal' : undefined}
              hasData={hasCals}
              goalReached={hasCals && todayData!.caloriesBurned! >= calorieGoal}
            />
            <AnimatedRing
              value={todayData?.avgHeartRate || 0} max={200}
              color="#ef4444" glowColor="rgba(239,68,68,0.15)"
              icon={Heart} label="Avg HR"
              displayValue={hrDisplay}
              unit={hasHR ? 'bpm' : undefined}
              hasData={hasHR}
            />
            <AnimatedRing
              value={todayData?.sleepMinutes ? todayData.sleepMinutes / 60 : 0} max={9}
              color="#a855f7" glowColor="rgba(168,85,247,0.15)"
              icon={Moon} label="Sleep"
              displayValue={hasSleep ? formatSleep(todayData!.sleepMinutes!) : '--'}
              unit={hasSleep ? 'hours' : undefined}
              hasData={hasSleep}
            />
          </div>

          {(hasActiveMinutes || (todayData?.distanceMeters && todayData.distanceMeters > 0)) && (
            <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t border-border/30">
              {hasActiveMinutes && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Timer className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-muted-foreground text-xs">Active</span>
                  <span className="font-semibold text-xs">{todayData!.activeMinutes} min</span>
                </div>
              )}
              {todayData?.distanceMeters && todayData.distanceMeters > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Footprints className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-muted-foreground text-xs">Distance</span>
                  <span className="font-semibold text-xs">{(todayData.distanceMeters / 1000).toFixed(1)} km</span>
                </div>
              )}
            </div>
          )}

          {trackedMetrics > 0 && (
            <div className="flex items-center justify-center gap-1 mt-3 pt-2">
              <Eye className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {trackedMetrics} of 4 metrics tracked from {sourceName}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {recovery.hasEnoughData && (
        <div className="grid grid-cols-5 gap-3">
          <Card className="col-span-3 overflow-hidden border-0 shadow-lg" data-testid="card-recovery-score">
            <div className="h-full bg-gradient-to-br from-emerald-500/[0.03] via-card to-card">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold">Recovery Score</span>
                  {recovery.dataPoints < 4 && (
                    <Badge variant="outline" className="text-[9px] ml-auto px-1.5 py-0 h-4 rounded-md border-amber-500/30 text-amber-600">Partial</Badge>
                  )}
                </div>
                <div className="flex items-start gap-4">
                  <RecoveryGauge score={recovery.score} dataPoints={recovery.dataPoints} />
                  {recovery.factors.length > 0 && (
                    <div className="flex-1 space-y-2 pt-2">
                      {recovery.factors.map((f, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{f.label}</span>
                          <span className={`text-[11px] font-semibold ${f.impact === 'positive' ? 'text-green-500' : f.impact === 'negative' ? 'text-red-400' : 'text-amber-500'}`}>{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-2 border-t border-border/20">
                  <DataSourceBadge label="Based on device data" />
                </div>
              </CardContent>
            </div>
          </Card>

          <Card className="col-span-2 overflow-hidden border-0 shadow-lg" data-testid="card-calorie-balance">
            <div className="h-full bg-gradient-to-br from-orange-500/[0.03] via-card to-card">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <ArrowUpDown className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold">Calories</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center"><Utensils className="w-3 h-3 text-green-500" /></div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">Eaten</p>
                      <p className="text-sm font-bold">{caloriesEaten > 0 ? caloriesEaten.toLocaleString() : '--'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center"><Flame className="w-3 h-3 text-orange-500" /></div>
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">Burned</p>
                      <p className="text-sm font-bold">{hasCals ? caloriesBurned.toLocaleString() : '--'}</p>
                    </div>
                  </div>
                  {(caloriesEaten > 0 || hasCals) && (
                    <>
                      <Separator className="opacity-30" />
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {calorieBalance < 0 ? <TrendingDown className="w-3.5 h-3.5 text-blue-500" /> : <TrendingUp className="w-3.5 h-3.5 text-amber-500" />}
                          <span className={`text-xl font-black tabular-nums ${calorieBalance < 0 ? 'text-blue-500' : 'text-amber-500'}`}>
                            {calorieBalance > 0 ? '+' : ''}{calorieBalance.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{calorieBalance < 0 ? 'Deficit' : calorieBalance > 0 ? 'Surplus' : 'Balanced'}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </div>
          </Card>
        </div>
      )}

      {!recovery.hasEnoughData && (caloriesEaten > 0 || hasCals) && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-calorie-balance-alt">
          <div className="bg-gradient-to-br from-orange-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowUpDown className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold">Calorie Balance</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <Utensils className="w-3.5 h-3.5 text-green-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">{caloriesEaten > 0 ? caloriesEaten.toLocaleString() : '--'}</p>
                  <p className="text-[10px] text-muted-foreground">Eaten</p>
                </div>
                <div>
                  <Flame className="w-3.5 h-3.5 text-orange-500 mx-auto mb-1" />
                  <p className="text-lg font-bold">{hasCals ? caloriesBurned.toLocaleString() : '--'}</p>
                  <p className="text-[10px] text-muted-foreground">Burned</p>
                </div>
                <div>
                  {calorieBalance < 0 ? <TrendingDown className="w-3.5 h-3.5 text-blue-500 mx-auto mb-1" /> : <TrendingUp className="w-3.5 h-3.5 text-amber-500 mx-auto mb-1" />}
                  <p className={`text-lg font-bold ${calorieBalance < 0 ? 'text-blue-500' : 'text-amber-500'}`}>{calorieBalance > 0 ? '+' : ''}{calorieBalance.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{calorieBalance < 0 ? 'Deficit' : calorieBalance > 0 ? 'Surplus' : 'Balanced'}</p>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {insights.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-smart-insights">
          <div className="bg-gradient-to-br from-amber-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Brain className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold">AI Insights</span>
                <DataSourceBadge label="Based on today's data" />
              </div>
              <div className="space-y-2.5">
                {insights.map((insight, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" style={{ boxShadow: '0 0 4px rgba(245,158,11,0.5)' }} />
                    <p className="text-[13px] text-foreground/80 leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {hasActiveMinutes && todayData?.watchWorkouts && Array.isArray(todayData.watchWorkouts) && todayData.watchWorkouts.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-today-workouts">
          <div className="bg-gradient-to-br from-violet-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Activity className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-semibold">Today's Workouts</span>
                <DataSourceBadge label={sourceName} />
              </div>
              <div className="space-y-2">
                {(todayData.watchWorkouts as Array<any>).map((rawW: any, i: number) => {
                  const w = {
                    type: typeof rawW?.type === 'string' ? rawW.type : 'workout',
                    duration: typeof rawW?.duration === 'number' ? rawW.duration : 0,
                    calories: typeof rawW?.calories === 'number' ? rawW.calories : 0,
                  };
                  const workoutType = w.type.replace(/_/g, ' ');
                  const durationMin = w.duration > 0 ? `${Math.round(w.duration / 60)} min` : '';
                  const calsBurned = w.calories > 0 ? `${Math.round(w.calories)} cal` : '';
                  const detail = [durationMin, calsBurned].filter(Boolean).join(' \u00b7 ');
                  return (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <Activity className="w-4 h-4 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{workoutType}</p>
                          {detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {chartData.some(d => d.steps > 0) && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-chart-steps">
          <div className="bg-gradient-to-br from-blue-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold">Steps</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">avg {Math.round(avgSteps).toLocaleString()}</span>
                  <div className="flex bg-muted/50 rounded-lg p-0.5" data-testid="toggle-chart-range">
                    <button
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${chartRange === '7d' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                      onClick={() => setChartRange('7d')}
                    >7D</button>
                    <button
                      className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${chartRange === '30d' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                      onClick={() => setChartRange('30d')}
                    >30D</button>
                  </div>
                </div>
              </div>
              {bestDayThisWeek && (
                <p className="text-[10px] text-muted-foreground mb-2">
                  Best: <span className="font-medium text-blue-500">{bestDayThisWeek.steps.toLocaleString()}</span> steps on {bestDayThisWeek.label}
                </p>
              )}
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: -25 }} onClick={handleBarClick}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/15" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: chartRange === '30d' ? 8 : 11, fill: 'hsl(var(--muted-foreground))' }} 
                      axisLine={false} tickLine={false}
                      interval={chartRange === '30d' ? 4 : 0}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                      formatter={(value: number, name: string, props: any) => {
                        const entry = props.payload;
                        if (!entry.hasData) return ['No data', 'Steps'];
                        return [value.toLocaleString(), 'Steps'];
                      }}
                      labelFormatter={(label: string, payload: any) => {
                        if (payload?.[0]?.payload) {
                          return `Tap for details`;
                        }
                        return label;
                      }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3, radius: 4 }}
                    />
                    <Bar dataKey="steps" radius={[6, 6, 0, 0]} maxBarSize={chartRange === '30d' ? 16 : 32}>
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={index} 
                          fill={!entry.hasData ? 'hsl(var(--muted))' : entry.date === todayDateStr ? '#3b82f6' : '#3b82f640'} 
                          opacity={!entry.hasData ? 0.3 : 1}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {chartData.some(d => d.sleep > 0) && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-chart-sleep">
          <div className="bg-gradient-to-br from-purple-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Moon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-semibold">Sleep Pattern</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  avg {(chartData.filter(d => d.sleep > 0).reduce((s, d) => s + d.sleep, 0) / Math.max(chartData.filter(d => d.sleep > 0).length, 1)).toFixed(1)}h
                </span>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/15" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: chartRange === '30d' ? 8 : 11, fill: 'hsl(var(--muted-foreground))' }} 
                      axisLine={false} tickLine={false}
                      interval={chartRange === '30d' ? 4 : 0}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={[0, 10]} tickFormatter={(v) => `${v}h`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                      formatter={(value: number) => [`${value}h`, 'Sleep']}
                    />
                    <Bar dataKey="sleep" radius={[6, 6, 0, 0]} maxBarSize={chartRange === '30d' ? 16 : 32}>
                      {chartData.map((entry, index) => {
                        const sleepColor = entry.sleep >= 7 ? '#a855f7' : entry.sleep >= 6 ? '#c084fc' : '#e9d5ff';
                        return <Cell key={index} fill={entry.sleep > 0 ? sleepColor : 'hsl(var(--muted))'} opacity={entry.sleep > 0 ? 1 : 0.3} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {chartData.some(d => d.calories > 0) && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-chart-calories">
          <div className="bg-gradient-to-br from-orange-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold">Calories Burned</span>
                </div>
                <span className="text-[11px] text-muted-foreground">avg {Math.round(avgCals).toLocaleString()} cal</span>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/15" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: chartRange === '30d' ? 8 : 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={chartRange === '30d' ? 4 : 0} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} formatter={(value: number) => [value.toLocaleString(), 'Calories']} />
                    <defs>
                      <linearGradient id="calorieGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="calories" stroke="#f97316" fill="url(#calorieGradient)" strokeWidth={2.5} dot={{ fill: '#f97316', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f97316', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {chartData.some(d => d.hr > 0) && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-chart-hr">
          <div className="bg-gradient-to-br from-red-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold">Heart Rate Trend</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  avg {Math.round(chartData.filter(d => d.hr > 0).reduce((s, d) => s + d.hr, 0) / Math.max(chartData.filter(d => d.hr > 0).length, 1))} bpm
                </span>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/15" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: chartRange === '30d' ? 8 : 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={chartRange === '30d' ? 4 : 0} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }} formatter={(value: number) => [`${value} bpm`, 'Avg HR']} />
                    <defs>
                      <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="hr" stroke="#ef4444" fill="url(#hrGradient)" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {healthStats && healthStats.daysTracked > 0 && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-personal-records">
          <div className="bg-gradient-to-br from-amber-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold">Personal Records</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {healthStats.bestStepsDay.steps > 0 && (
                  <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] text-muted-foreground">Best Steps</span>
                    </div>
                    <p className="text-lg font-bold text-blue-500">{healthStats.bestStepsDay.steps.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBestDate(healthStats.bestStepsDay.date)}</p>
                  </div>
                )}
                {healthStats.bestCaloriesDay.calories > 0 && (
                  <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/10">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Crown className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] text-muted-foreground">Most Burned</span>
                    </div>
                    <p className="text-lg font-bold text-orange-500">{healthStats.bestCaloriesDay.calories.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBestDate(healthStats.bestCaloriesDay.date)}</p>
                  </div>
                )}
                <div className="p-3 bg-green-500/5 rounded-xl border border-green-500/10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-muted-foreground">Goal Days</span>
                  </div>
                  <p className="text-lg font-bold text-green-500">{healthStats.stepGoalDays}</p>
                  <p className="text-[10px] text-muted-foreground">of {healthStats.daysTracked} tracked</p>
                </div>
                <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/10">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar className="w-3 h-3 text-purple-500" />
                    <span className="text-[10px] text-muted-foreground">Best Streak</span>
                  </div>
                  <p className="text-lg font-bold text-purple-500">{healthStats.maxStreak}</p>
                  <p className="text-[10px] text-muted-foreground">days in a row</p>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between pt-2 pb-2">
        <p className="text-[11px] text-muted-foreground">
          Last synced: {todayData?.lastSyncedAt ? new Date(todayData.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not yet today'}
        </p>
        <Button variant="ghost" size="sm" className="text-[11px] text-destructive/70 hover:text-destructive h-7 px-2" onClick={handleDisconnect} disabled={disconnectHealth.isPending} data-testid="button-disconnect-health">
          <Unplug className="w-3 h-3 mr-1" />
          Disconnect
        </Button>
      </div>

      {selectedDay && (
        <DayDetailSheet
          data={selectedDay.data}
          date={selectedDay.date}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}
