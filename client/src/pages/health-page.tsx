import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Battery,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  RefreshCw,
  Loader2,
  Smartphone,
  Brain,
  Utensils,
  ArrowUpDown,
  Target,
  Timer,
  BarChart3,
  Dumbbell,
  Sparkles,
  AlertCircle,
  ChevronRight,
  Unplug,
  Plug,
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
import type { HealthData, FoodLog } from '@shared/schema';

function RecoveryScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const center = size / 2;

  const getColor = (s: number) => {
    if (s >= 80) return { stroke: '#22c55e', bg: 'from-green-500/10 to-green-500/5', label: 'Excellent', icon: BatteryFull };
    if (s >= 60) return { stroke: '#3b82f6', bg: 'from-blue-500/10 to-blue-500/5', label: 'Good', icon: BatteryMedium };
    if (s >= 40) return { stroke: '#f59e0b', bg: 'from-amber-500/10 to-amber-500/5', label: 'Fair', icon: Battery };
    return { stroke: '#ef4444', bg: 'from-red-500/10 to-red-500/5', label: 'Low', icon: BatteryLow };
  };

  const config = getColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={config.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" data-testid="text-recovery-score">{score}</span>
        <span className="text-xs text-muted-foreground">{config.label}</span>
      </div>
    </div>
  );
}

function MetricRing({ value, max, size = 80, color, icon: Icon, label, unit }: {
  value: number;
  max: number;
  size?: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  unit?: string;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const progress = pct * circumference;
  const center = size / 2;

  const formatValue = (v: number) => {
    if (v >= 10000) return `${(v / 1000).toFixed(1)}k`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v.toLocaleString();
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={center} cy={center} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/15" />
          <circle cx={center} cy={center} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={circumference - progress} strokeLinecap="round" className="transition-all duration-700 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-4 h-4 mb-0.5" style={{ color }}><Icon className="w-4 h-4" /></div>
          <span className="text-sm font-bold">{formatValue(value)}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium">{label}</p>
        {unit && <p className="text-[10px] text-muted-foreground">{unit}</p>}
      </div>
    </div>
  );
}

function HRZoneBar({ zones }: { zones: { name: string; minutes: number; color: string; range: string }[] }) {
  const total = zones.reduce((sum, z) => sum + z.minutes, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden">
        {zones.map((zone) => {
          const pct = (zone.minutes / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={zone.name}
              className="h-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: zone.color }}
              title={`${zone.name}: ${zone.minutes}min`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {zones.map((zone) => (
          <div key={zone.name} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color }} />
            <span className="text-muted-foreground">{zone.name}</span>
            <span className="font-medium ml-auto">{zone.minutes}m</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeRecoveryScore(healthData: HealthData | null): { score: number; factors: { label: string; value: string; impact: 'positive' | 'neutral' | 'negative' }[] } {
  if (!healthData) return { score: 0, factors: [] };

  const factors: { label: string; value: string; impact: 'positive' | 'neutral' | 'negative' }[] = [];
  let totalScore = 50;

  if (healthData.sleepMinutes) {
    const hours = healthData.sleepMinutes / 60;
    if (hours >= 7.5) {
      totalScore += 20;
      factors.push({ label: 'Sleep', value: `${hours.toFixed(1)}h`, impact: 'positive' });
    } else if (hours >= 6) {
      totalScore += 10;
      factors.push({ label: 'Sleep', value: `${hours.toFixed(1)}h`, impact: 'neutral' });
    } else {
      totalScore -= 15;
      factors.push({ label: 'Sleep', value: `${hours.toFixed(1)}h`, impact: 'negative' });
    }
  }

  if (healthData.restingHeartRate) {
    const rhr = healthData.restingHeartRate;
    if (rhr < 60) {
      totalScore += 15;
      factors.push({ label: 'Resting HR', value: `${rhr} bpm`, impact: 'positive' });
    } else if (rhr < 75) {
      totalScore += 5;
      factors.push({ label: 'Resting HR', value: `${rhr} bpm`, impact: 'neutral' });
    } else {
      totalScore -= 10;
      factors.push({ label: 'Resting HR', value: `${rhr} bpm`, impact: 'negative' });
    }
  }

  if (healthData.activeMinutes) {
    const mins = healthData.activeMinutes;
    if (mins > 90) {
      totalScore -= 10;
      factors.push({ label: 'Activity', value: `${mins}min`, impact: 'negative' });
    } else if (mins > 30) {
      totalScore += 10;
      factors.push({ label: 'Activity', value: `${mins}min`, impact: 'positive' });
    } else {
      totalScore += 5;
      factors.push({ label: 'Activity', value: `${mins}min`, impact: 'neutral' });
    }
  }

  if (healthData.steps) {
    if (healthData.steps >= 8000) {
      totalScore += 5;
      factors.push({ label: 'Steps', value: `${(healthData.steps / 1000).toFixed(1)}k`, impact: 'positive' });
    } else if (healthData.steps < 3000) {
      totalScore -= 5;
      factors.push({ label: 'Steps', value: `${(healthData.steps / 1000).toFixed(1)}k`, impact: 'negative' });
    }
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(totalScore))),
    factors,
  };
}

function computeHRZones(healthData: HealthData | null): { name: string; minutes: number; color: string; range: string }[] {
  const avgHR = healthData?.avgHeartRate;
  const maxHR = healthData?.maxHeartRate;
  const activeMin = healthData?.activeMinutes || 0;

  if (!avgHR || activeMin === 0) {
    return [
      { name: 'Rest', minutes: 0, color: '#94a3b8', range: '<100 bpm' },
      { name: 'Fat Burn', minutes: 0, color: '#22c55e', range: '100-130 bpm' },
      { name: 'Cardio', minutes: 0, color: '#f59e0b', range: '130-160 bpm' },
      { name: 'Peak', minutes: 0, color: '#ef4444', range: '160+ bpm' },
    ];
  }

  let restMin = 0, fatBurnMin = 0, cardioMin = 0, peakMin = 0;

  if (maxHR && maxHR > 160) {
    peakMin = Math.round(activeMin * 0.1);
    cardioMin = Math.round(activeMin * 0.3);
    fatBurnMin = Math.round(activeMin * 0.4);
    restMin = activeMin - peakMin - cardioMin - fatBurnMin;
  } else if (avgHR > 130) {
    cardioMin = Math.round(activeMin * 0.4);
    fatBurnMin = Math.round(activeMin * 0.4);
    restMin = activeMin - cardioMin - fatBurnMin;
  } else if (avgHR > 100) {
    fatBurnMin = Math.round(activeMin * 0.5);
    restMin = activeMin - fatBurnMin;
  } else {
    restMin = activeMin;
  }

  return [
    { name: 'Rest', minutes: Math.max(0, restMin), color: '#94a3b8', range: '<100 bpm' },
    { name: 'Fat Burn', minutes: fatBurnMin, color: '#22c55e', range: '100-130 bpm' },
    { name: 'Cardio', minutes: cardioMin, color: '#f59e0b', range: '130-160 bpm' },
    { name: 'Peak', minutes: peakMin, color: '#ef4444', range: '160+ bpm' },
  ];
}

function generateInsights(healthData: HealthData | null, caloriesEaten: number, recoveryScore: number): string[] {
  const insights: string[] = [];
  if (!healthData) return ['Connect your fitness device to get personalized health insights'];

  if (recoveryScore >= 80) {
    insights.push('Your recovery is excellent today — perfect for a challenging workout');
  } else if (recoveryScore >= 60) {
    insights.push('Recovery looks good — you can train normally today');
  } else if (recoveryScore >= 40) {
    insights.push('Recovery is moderate — consider going lighter or focusing on mobility');
  } else {
    insights.push('Recovery is low — prioritize rest or do light active recovery');
  }

  if (healthData.sleepMinutes) {
    const hrs = healthData.sleepMinutes / 60;
    if (hrs < 6) {
      insights.push(`Only ${hrs.toFixed(1)}h sleep last night — hydrate well and avoid heavy lifts`);
    } else if (hrs >= 8) {
      insights.push(`Great sleep at ${hrs.toFixed(1)}h — your body is well rested for performance`);
    }
  }

  const burned = healthData.caloriesBurned || 0;
  if (burned > 0 && caloriesEaten > 0) {
    const balance = caloriesEaten - burned;
    if (balance < -500) {
      insights.push(`You're in a ${Math.abs(balance)} cal deficit — make sure to fuel up if training later`);
    } else if (balance > 300) {
      insights.push(`You're ${balance} cal over your burn — a good walk or workout would help balance it`);
    }
  }

  if (healthData.steps && healthData.steps < 4000) {
    insights.push('Step count is low today — try a 15-min walk to boost circulation and recovery');
  }

  if (healthData.restingHeartRate && healthData.restingHeartRate > 80) {
    insights.push('Resting heart rate is elevated — could be stress or dehydration, take it easy');
  }

  return insights.slice(0, 3);
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

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const { data: weeklyData } = useHealthDataRange(startDate, endDate);

  const todayDateStr = today.toISOString().split('T')[0];
  const { data: todayFoodLogs } = useQuery<FoodLog[]>({
    queryKey: ['/api/food-logs', todayDateStr],
  });

  const caloriesEaten = useMemo(() => {
    if (!todayFoodLogs || !Array.isArray(todayFoodLogs)) return 0;
    return todayFoodLogs.reduce((sum, log) => sum + (log.calories || 0), 0);
  }, [todayFoodLogs]);

  const recovery = useMemo(() => computeRecoveryScore(todayData || null), [todayData]);
  const hrZones = useMemo(() => computeHRZones(todayData || null), [todayData]);
  const insights = useMemo(() => generateInsights(todayData || null, caloriesEaten, recovery.score), [todayData, caloriesEaten, recovery.score]);

  const weeklyChartData = useMemo(() => {
    const days: { date: string; label: string; steps: number; calories: number; hr: number; sleep: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const match = weeklyData?.find((wd) => wd.date === dateStr);
      days.push({
        date: dateStr,
        label: dayNames[d.getDay()],
        steps: match?.steps || 0,
        calories: match?.caloriesBurned || 0,
        hr: match?.avgHeartRate || 0,
        sleep: match?.sleepMinutes ? Math.round(match.sleepMinutes / 60 * 10) / 10 : 0,
      });
    }
    return days;
  }, [weeklyData]);

  const isConnected = status?.connected;
  const isLoading = statusLoading || todayLoading;
  const caloriesBurned = todayData?.caloriesBurned || 0;
  const calorieBalance = caloriesEaten - caloriesBurned;
  const sourceName = status?.source === 'apple_health' ? 'Apple Health' : status?.source === 'google_fit' ? 'Google Fit' : 'Device';

  const handleConnect = async () => {
    try {
      await connectHealth.mutateAsync();
      toast({ title: 'Connected', description: `Successfully connected to ${platform === 'ios' ? 'Apple Health' : 'Google Fit'}` });
    } catch {
      toast({ title: 'Connection failed', description: 'Could not connect to health service. Please check permissions.', variant: 'destructive' });
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

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Health & Activity</h1>
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!isNativePlatform && !isConnected) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Health & Activity</h1>
        </div>

        <Card className="border-dashed" data-testid="card-health-web-notice">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Connect via Mobile App</h3>
                <p className="text-sm text-muted-foreground">
                  Open OGym on your iPhone or Android device to connect Apple Health or Google Fit. Your health data will sync automatically and appear here.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Footprints className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Steps</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-muted-foreground">Calories</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Heart Rate</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Moon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Sleep</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {weeklyData && weeklyData.length > 0 && (
          <>
            <Separator />
            <p className="text-sm text-muted-foreground">Previously synced data is still viewable below.</p>
          </>
        )}
      </div>
    );
  }

  if (isNativePlatform && !isConnected) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Health & Activity</h1>
        </div>

        <Card data-testid="card-health-connect">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                {platform === 'ios' ? <SiApple className="w-8 h-8 text-primary" /> : <SiGoogle className="w-8 h-8 text-primary" />}
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">
                  Connect {platform === 'ios' ? 'Apple Health' : 'Google Fit'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sync your steps, heart rate, calories, and sleep data for a complete fitness picture. Your data stays private and is only used to personalize your experience.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleConnect}
                disabled={connectHealth.isPending}
                data-testid="button-connect-health"
              >
                {connectHealth.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plug className="w-4 h-4 mr-2" />}
                Connect
              </Button>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Footprints className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Steps & Distance</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm">Calories Burned</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm">Heart Rate</span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <Moon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">Sleep Tracking</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24" data-testid="page-health">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Health & Activity</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-xs gap-1">
            <Watch className="w-3 h-3" />
            {sourceName}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSync}
            disabled={syncHealth.isPending}
            data-testid="button-sync-health"
          >
            <RefreshCw className={`w-4 h-4 ${syncHealth.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2" data-testid="section-daily-overview">
        <MetricRing
          value={todayData?.steps || 0}
          max={10000}
          color="#3b82f6"
          icon={Footprints}
          label="Steps"
          unit="/ 10k"
        />
        <MetricRing
          value={todayData?.caloriesBurned || 0}
          max={2500}
          color="#f97316"
          icon={Flame}
          label="Burned"
          unit="cal"
        />
        <MetricRing
          value={todayData?.avgHeartRate || 0}
          max={200}
          color="#ef4444"
          icon={Heart}
          label="Avg HR"
          unit="bpm"
        />
        <MetricRing
          value={todayData?.sleepMinutes ? Math.round(todayData.sleepMinutes / 60 * 10) / 10 : 0}
          max={9}
          size={80}
          color="#a855f7"
          icon={Moon}
          label="Sleep"
          unit="hours"
        />
      </div>

      {todayData?.activeMinutes || todayData?.distanceMeters ? (
        <div className="flex gap-4 px-2">
          {todayData.activeMinutes ? (
            <div className="flex items-center gap-2 text-sm">
              <Timer className="w-4 h-4 text-green-500" />
              <span className="text-muted-foreground">Active:</span>
              <span className="font-medium">{todayData.activeMinutes} min</span>
            </div>
          ) : null}
          {todayData.distanceMeters ? (
            <div className="flex items-center gap-2 text-sm">
              <Footprints className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Distance:</span>
              <span className="font-medium">{(todayData.distanceMeters / 1000).toFixed(1)} km</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/10" data-testid="card-recovery-score">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-medium">Recovery</span>
              </div>
              <RecoveryScoreRing score={recovery.score} size={100} />
              {recovery.factors.length > 0 && (
                <div className="w-full space-y-1 mt-1">
                  {recovery.factors.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className={f.impact === 'positive' ? 'text-green-500' : f.impact === 'negative' ? 'text-red-500' : 'text-amber-500'}>
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/10" data-testid="card-calorie-balance">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpDown className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium">Calorie Balance</span>
              </div>
              <div className="text-center space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Utensils className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-muted-foreground">Eaten:</span>
                  <span className="font-semibold">{caloriesEaten.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-muted-foreground">Burned:</span>
                  <span className="font-semibold">{caloriesBurned.toLocaleString()}</span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex items-center justify-center gap-1.5">
                  {calorieBalance < 0 ? (
                    <TrendingDown className="w-4 h-4 text-blue-500" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                  )}
                  <span className={`text-lg font-bold ${calorieBalance < 0 ? 'text-blue-500' : 'text-amber-500'}`}>
                    {calorieBalance > 0 ? '+' : ''}{calorieBalance.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {calorieBalance < 0 ? 'Deficit' : calorieBalance > 0 ? 'Surplus' : 'Balanced'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(todayData?.activeMinutes ?? 0) > 0 && (
        <Card data-testid="card-hr-zones">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              Heart Rate Zones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HRZoneBar zones={hrZones} />
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-smart-insights">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Smart Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {insights.map((insight, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">{insight}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {weeklyChartData.some(d => d.steps > 0) && (
        <Card data-testid="card-weekly-steps">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Weekly Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [value.toLocaleString(), 'Steps']}
                  />
                  <Bar dataKey="steps" radius={[4, 4, 0, 0]}>
                    {weeklyChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.date === todayDateStr ? '#3b82f6' : '#3b82f640'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {weeklyChartData.some(d => d.calories > 0) && (
        <Card data-testid="card-weekly-calories">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              Weekly Calories Burned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [value.toLocaleString(), 'Calories']}
                  />
                  <defs>
                    <linearGradient id="calorieGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="calories" stroke="#f97316" fill="url(#calorieGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {weeklyChartData.some(d => d.hr > 0) && (
        <Card data-testid="card-weekly-hr">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              Weekly Heart Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                  <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`${value} bpm`, 'Avg HR']}
                  />
                  <defs>
                    <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="hr" stroke="#ef4444" fill="url(#hrGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          Last synced: {todayData?.lastSyncedAt ? new Date(todayData.lastSyncedAt).toLocaleTimeString() : 'Never'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-destructive"
          onClick={handleDisconnect}
          disabled={disconnectHealth.isPending}
          data-testid="button-disconnect-health"
        >
          <Unplug className="w-3 h-3 mr-1" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
