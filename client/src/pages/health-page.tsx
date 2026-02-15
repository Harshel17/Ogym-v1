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
  Droplets,
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

function AnimatedRing({ value, max, size = 58, strokeWidth = 5, color, glowColor, icon: Icon, label, displayValue, unit }: {
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
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const progress = pct * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full" style={{ 
          boxShadow: pct > 0.5 ? `0 0 20px ${glowColor}` : 'none',
          transition: 'box-shadow 1s ease'
        }} />
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            className="text-muted/10"
          />
          <circle
            cx={center} cy={center} r={radius}
            fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-3 h-3 mb-0.5" style={{ color }} />
          <span className="text-xs font-bold tracking-tight">{displayValue}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-semibold text-foreground/80">{label}</p>
        {unit && <p className="text-[10px] text-muted-foreground">{unit}</p>}
      </div>
    </div>
  );
}

function RecoveryGauge({ score }: { score: number }) {
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
    </div>
  );
}

function HRZoneBar({ zones }: { zones: { name: string; minutes: number; color: string; range: string }[] }) {
  const total = zones.reduce((sum, z) => sum + z.minutes, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {zones.map((zone) => {
          const pct = (zone.minutes / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={zone.name}
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: zone.color, boxShadow: `0 0 8px ${zone.color}40` }}
              title={`${zone.name}: ${zone.minutes}min`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {zones.map((zone) => (
          <div key={zone.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: zone.color, boxShadow: `0 0 4px ${zone.color}60` }} />
            <span className="text-xs text-muted-foreground flex-1">{zone.name}</span>
            <span className="text-xs font-semibold tabular-nums">{zone.minutes}m</span>
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
    if (healthData.restingHeartRate < 60) {
      totalScore += 15;
      factors.push({ label: 'Resting HR', value: `${healthData.restingHeartRate} bpm`, impact: 'positive' });
    } else if (healthData.restingHeartRate <= 75) {
      totalScore += 5;
      factors.push({ label: 'Resting HR', value: `${healthData.restingHeartRate} bpm`, impact: 'neutral' });
    } else {
      totalScore -= 10;
      factors.push({ label: 'Resting HR', value: `${healthData.restingHeartRate} bpm`, impact: 'negative' });
    }
  }

  if (healthData.activeMinutes) {
    if (healthData.activeMinutes > 90) {
      totalScore -= 10;
      factors.push({ label: 'Activity', value: `${healthData.activeMinutes}min`, impact: 'negative' });
    } else if (healthData.activeMinutes >= 30) {
      totalScore += 10;
      factors.push({ label: 'Activity', value: `${healthData.activeMinutes}min`, impact: 'positive' });
    } else {
      totalScore += 5;
      factors.push({ label: 'Activity', value: `${healthData.activeMinutes}min`, impact: 'neutral' });
    }
  }

  if (healthData.steps) {
    if (healthData.steps >= 8000) {
      totalScore += 5;
      factors.push({ label: 'Steps', value: healthData.steps >= 1000 ? `${(healthData.steps / 1000).toFixed(1)}k` : `${healthData.steps}`, impact: 'positive' });
    } else if (healthData.steps < 3000) {
      totalScore -= 5;
      factors.push({ label: 'Steps', value: `${healthData.steps}`, impact: 'negative' });
    }
  }

  return { score: Math.max(0, Math.min(100, totalScore)), factors };
}

function computeHRZones(healthData: HealthData | null) {
  const defaultZones = [
    { name: 'Rest', minutes: 0, color: '#22c55e', range: '<100 bpm' },
    { name: 'Fat Burn', minutes: 0, color: '#3b82f6', range: '100-140 bpm' },
    { name: 'Cardio', minutes: 0, color: '#f59e0b', range: '140-170 bpm' },
    { name: 'Peak', minutes: 0, color: '#ef4444', range: '170+ bpm' },
  ];

  if (!healthData?.activeMinutes) return defaultZones;

  const totalMins = healthData.activeMinutes;
  const maxHR = healthData.maxHeartRate || 150;
  const avgHR = healthData.avgHeartRate || 70;

  if (maxHR > 170) {
    const peakMins = Math.round(totalMins * 0.1);
    const cardioMins = Math.round(totalMins * 0.3);
    const fatBurnMins = Math.round(totalMins * 0.2);
    const restMins = totalMins - peakMins - cardioMins - fatBurnMins;
    return [
      { ...defaultZones[0], minutes: restMins },
      { ...defaultZones[1], minutes: fatBurnMins },
      { ...defaultZones[2], minutes: cardioMins },
      { ...defaultZones[3], minutes: peakMins },
    ];
  } else if (maxHR > 140) {
    const cardioMins = Math.round(totalMins * 0.25);
    const fatBurnMins = Math.round(totalMins * 0.35);
    const restMins = totalMins - cardioMins - fatBurnMins;
    return [
      { ...defaultZones[0], minutes: restMins },
      { ...defaultZones[1], minutes: fatBurnMins },
      { ...defaultZones[2], minutes: cardioMins },
      { ...defaultZones[3], minutes: 0 },
    ];
  } else {
    const restMins = Math.round(totalMins * 0.7);
    const fatBurnMins = totalMins - restMins;
    return [
      { ...defaultZones[0], minutes: restMins },
      { ...defaultZones[1], minutes: fatBurnMins },
      { ...defaultZones[2], minutes: 0 },
      { ...defaultZones[3], minutes: 0 },
    ];
  }
}

function generateInsights(healthData: HealthData | null, caloriesEaten: number, recoveryScore: number): string[] {
  const insights: string[] = [];
  if (!healthData) return ['Connect your health device to get personalized insights'];

  if (recoveryScore >= 80) {
    insights.push('Your recovery is excellent today — perfect for a challenging workout');
  } else if (recoveryScore >= 60) {
    insights.push('Good recovery — you can handle moderate intensity training');
  } else if (recoveryScore >= 40) {
    insights.push('Recovery is fair — consider lighter exercises or active recovery');
  } else {
    insights.push('Low recovery detected — rest day recommended for best results');
  }

  if (healthData.steps && healthData.steps >= 10000) {
    insights.push('Amazing step count! You\'ve surpassed your 10k goal today');
  } else if (healthData.steps && healthData.steps >= 7000) {
    insights.push(`Almost there! ${(10000 - healthData.steps).toLocaleString()} more steps to hit your 10k goal`);
  }

  if (healthData.sleepMinutes && healthData.sleepMinutes >= 420 && healthData.sleepMinutes <= 540) {
    insights.push('Great sleep duration — your body had optimal recovery time');
  } else if (healthData.sleepMinutes && healthData.sleepMinutes < 360) {
    insights.push('Sleep was below 6 hours — try to get more rest for better recovery');
  }

  if (caloriesEaten > 0 && healthData.caloriesBurned) {
    const balance = caloriesEaten - healthData.caloriesBurned;
    if (balance < -500) {
      insights.push('Large calorie deficit — make sure you\'re eating enough to fuel recovery');
    }
  }

  if (healthData.restingHeartRate && healthData.restingHeartRate > 80) {
    insights.push('Resting heart rate is elevated — could be stress or dehydration');
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

  const isConnected = status?.connected || !!todayData;
  const isLoading = statusLoading || todayLoading;
  const caloriesBurned = todayData?.caloriesBurned || 0;
  const calorieBalance = caloriesEaten - caloriesBurned;
  const sourceName = status?.source === 'apple_health' ? 'Apple Health' : status?.source === 'google_fit' ? 'Google Fit' : 'Health';

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
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!isNativePlatform && !isConnected && !todayData && !(weeklyData && weeklyData.length > 0)) {
    return (
      <div className="p-4 space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">Health & Activity</h1>
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
          <h1 className="text-xl font-bold">Health & Activity</h1>
        </div>

        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                {platform === 'ios' ? <SiApple className="w-8 h-8" /> : <SiGoogle className="w-8 h-8" />}
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">
                  Connect {platform === 'ios' ? 'Apple Health' : 'Google Fit'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Track your steps, heart rate, sleep quality and more
                </p>
              </div>
              <Button
                onClick={handleConnect}
                disabled={connectHealth.isPending}
                className="w-full rounded-xl h-12 text-base font-semibold"
                data-testid="button-connect-health"
              >
                {connectHealth.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plug className="w-5 h-5 mr-2" />}
                Connect Now
              </Button>
            </div>
          </div>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
                <Footprints className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Steps & Distance</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-sm">Calories Burned</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm">Heart Rate</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl">
                <Moon className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Sleep Tracking</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatSleep = (mins: number) => {
    if (!mins) return '0h';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const weeklyAvgSteps = weeklyChartData.filter(d => d.steps > 0).reduce((sum, d) => sum + d.steps, 0) / Math.max(weeklyChartData.filter(d => d.steps > 0).length, 1);
  const weeklyAvgCals = weeklyChartData.filter(d => d.calories > 0).reduce((sum, d) => sum + d.calories, 0) / Math.max(weeklyChartData.filter(d => d.calories > 0).length, 1);

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto pb-24" data-testid="page-health">
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={handleSync}
            disabled={syncHealth.isPending}
            data-testid="button-sync-health"
          >
            <RefreshCw className={`w-4 h-4 ${syncHealth.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-0 bg-gradient-to-br from-card via-card to-muted/20 shadow-lg" data-testid="section-daily-overview">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-4 gap-4">
            <AnimatedRing
              value={todayData?.steps || 0} max={10000}
              color="#3b82f6" glowColor="rgba(59,130,246,0.15)"
              icon={Footprints} label="Steps"
              displayValue={todayData?.steps ? (todayData.steps >= 1000 ? `${(todayData.steps / 1000).toFixed(1)}k` : `${todayData.steps}`) : '0'}
              unit="/ 10k"
            />
            <AnimatedRing
              value={todayData?.caloriesBurned || 0} max={500}
              color="#f97316" glowColor="rgba(249,115,22,0.15)"
              icon={Flame} label="Burned"
              displayValue={`${todayData?.caloriesBurned || 0}`}
              unit="cal"
            />
            <AnimatedRing
              value={todayData?.avgHeartRate || 0} max={200}
              color="#ef4444" glowColor="rgba(239,68,68,0.15)"
              icon={Heart} label="Avg HR"
              displayValue={`${todayData?.avgHeartRate || 0}`}
              unit="bpm"
            />
            <AnimatedRing
              value={todayData?.sleepMinutes ? todayData.sleepMinutes / 60 : 0} max={9}
              color="#a855f7" glowColor="rgba(168,85,247,0.15)"
              icon={Moon} label="Sleep"
              displayValue={formatSleep(todayData?.sleepMinutes || 0)}
              unit="hours"
            />
          </div>

          {(todayData?.activeMinutes || todayData?.distanceMeters) && (
            <div className="flex items-center justify-center gap-5 mt-4 pt-3 border-t border-border/30">
              {todayData.activeMinutes ? (
                <div className="flex items-center gap-1.5 text-sm">
                  <Timer className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-muted-foreground text-xs">Active</span>
                  <span className="font-semibold text-xs">{todayData.activeMinutes} min</span>
                </div>
              ) : null}
              {todayData.distanceMeters ? (
                <div className="flex items-center gap-1.5 text-sm">
                  <Footprints className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-muted-foreground text-xs">Distance</span>
                  <span className="font-semibold text-xs">{(todayData.distanceMeters / 1000).toFixed(1)} km</span>
                </div>
              ) : null}
              {todayData.sleepQuality ? (
                <div className="flex items-center gap-1.5 text-sm">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-muted-foreground text-xs">Sleep</span>
                  <span className="font-semibold text-xs capitalize">{todayData.sleepQuality}</span>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-5 gap-3">
        <Card className="col-span-3 overflow-hidden border-0 shadow-lg" data-testid="card-recovery-score">
          <div className="h-full bg-gradient-to-br from-emerald-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Zap className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold">Recovery Score</span>
              </div>
              <div className="flex items-start gap-4">
                <RecoveryGauge score={recovery.score} />
                {recovery.factors.length > 0 && (
                  <div className="flex-1 space-y-2 pt-2">
                    {recovery.factors.map((f, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">{f.label}</span>
                        <span className={`text-[11px] font-semibold ${f.impact === 'positive' ? 'text-green-500' : f.impact === 'negative' ? 'text-red-400' : 'text-amber-500'}`}>
                          {f.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                  <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Utensils className="w-3 h-3 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground">Eaten</p>
                    <p className="text-sm font-bold">{caloriesEaten.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Flame className="w-3 h-3 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-muted-foreground">Burned</p>
                    <p className="text-sm font-bold">{caloriesBurned.toLocaleString()}</p>
                  </div>
                </div>
                <Separator className="opacity-30" />
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {calorieBalance < 0 ? (
                      <TrendingDown className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span className={`text-xl font-black tabular-nums ${calorieBalance < 0 ? 'text-blue-500' : 'text-amber-500'}`}>
                      {calorieBalance > 0 ? '+' : ''}{calorieBalance.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {calorieBalance < 0 ? 'Deficit' : calorieBalance > 0 ? 'Surplus' : 'Balanced'}
                  </p>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>

      {insights.length > 0 && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-smart-insights">
          <div className="bg-gradient-to-br from-amber-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold">Smart Insights</span>
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

      {(todayData?.activeMinutes ?? 0) > 0 && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-hr-zones">
          <div className="bg-gradient-to-br from-red-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-sm font-semibold">Heart Rate Zones</span>
                {todayData?.maxHeartRate && (
                  <Badge variant="secondary" className="ml-auto text-[10px] rounded-md px-1.5 py-0.5">
                    Max {todayData.maxHeartRate} bpm
                  </Badge>
                )}
              </div>
              <HRZoneBar zones={hrZones} />
            </CardContent>
          </div>
        </Card>
      )}

      {weeklyChartData.some(d => d.steps > 0) && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-weekly-steps">
          <div className="bg-gradient-to-br from-blue-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold">Weekly Steps</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  avg {Math.round(weeklyAvgSteps).toLocaleString()}
                </span>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyChartData} margin={{ top: 8, right: 0, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/15" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                      formatter={(value: number) => [value.toLocaleString(), 'Steps']}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3, radius: 4 }}
                    />
                    <Bar dataKey="steps" radius={[6, 6, 0, 0]} maxBarSize={32}>
                      {weeklyChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.date === todayDateStr ? '#3b82f6' : '#3b82f630'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {weeklyChartData.some(d => d.calories > 0) && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-weekly-calories">
          <div className="bg-gradient-to-br from-orange-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold">Weekly Calories</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  avg {Math.round(weeklyAvgCals).toLocaleString()} cal
                </span>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyChartData} margin={{ top: 8, right: 0, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/15" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                      formatter={(value: number) => [value.toLocaleString(), 'Calories']}
                    />
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

      {weeklyChartData.some(d => d.hr > 0) && (
        <Card className="overflow-hidden border-0 shadow-lg" data-testid="card-weekly-hr">
          <div className="bg-gradient-to-br from-red-500/[0.03] via-card to-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-semibold">Heart Rate Trend</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  avg {Math.round(weeklyChartData.filter(d => d.hr > 0).reduce((s, d) => s + d.hr, 0) / Math.max(weeklyChartData.filter(d => d.hr > 0).length, 1))} bpm
                </span>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyChartData} margin={{ top: 8, right: 0, bottom: 0, left: -25 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/15" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                      formatter={(value: number) => [`${value} bpm`, 'Avg HR']}
                    />
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

      <div className="flex items-center justify-between pt-2 pb-2">
        <p className="text-[11px] text-muted-foreground">
          Last synced: {todayData?.lastSyncedAt ? new Date(todayData.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-[11px] text-destructive/70 hover:text-destructive h-7 px-2"
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
