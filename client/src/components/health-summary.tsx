import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Footprints, Flame, Heart, Moon, Activity, Watch, TrendingUp, AlertCircle } from 'lucide-react';
import { useHealthStatus, useHealthDataToday } from '@/hooks/use-health-data';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';

const HEALTH_FEATURE_ENABLED = true;

interface HealthSummaryProps {
  compact?: boolean;
  className?: string;
}

export function HealthSummary({ compact = false, className = '' }: HealthSummaryProps) {
  const { data: status, isLoading: statusLoading } = useHealthStatus();
  const { data: healthData, isLoading: dataLoading } = useHealthDataToday();

  const isNative = Capacitor.isNativePlatform();

  // Hide when feature is disabled
  if (!HEALTH_FEATURE_ENABLED) {
    return null;
  }

  if (statusLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!status?.connected) {
    return (
      <Link href="/health">
        <Card className={`${className} cursor-pointer hover:bg-accent/50 transition-colors`} data-testid="card-health-promo">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="p-2.5 rounded-full bg-gradient-to-br from-green-500/15 to-emerald-500/15">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Health & Activity</p>
              <p className="text-xs text-muted-foreground">
                {isNative ? 'Connect Apple Health or Google Fit' : 'Track steps, calories, heart rate & sleep'}
              </p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="m9 18 6-6-6-6"/></svg>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const isLoading = dataLoading;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!healthData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Watch className="w-4 h-4" />
            Health Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No health data for today. Open your watch app to sync.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  const formatSleep = (minutes: number | null | undefined) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getSourceLabel = () => {
    if (status.source === 'apple_health') return 'Apple Health';
    if (status.source === 'google_fit') return 'Google Fit';
    return 'Device';
  };

  if (compact) {
    return (
      <div className={`grid grid-cols-4 gap-3 ${className}`}>
        <div className="flex flex-col items-center gap-1 p-3 bg-muted/50 rounded-lg">
          <Footprints className="w-5 h-5 text-blue-500" />
          <span className="text-lg font-bold">{formatNumber(healthData.steps)}</span>
          <span className="text-xs text-muted-foreground">Steps</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 bg-muted/50 rounded-lg">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="text-lg font-bold">{formatNumber(healthData.caloriesBurned)}</span>
          <span className="text-xs text-muted-foreground">Burned</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 bg-muted/50 rounded-lg">
          <Heart className="w-5 h-5 text-red-500" />
          <span className="text-lg font-bold">{healthData.avgHeartRate || '-'}</span>
          <span className="text-xs text-muted-foreground">Avg HR</span>
        </div>
        <div className="flex flex-col items-center gap-1 p-3 bg-muted/50 rounded-lg">
          <Moon className="w-5 h-5 text-purple-500" />
          <span className="text-lg font-bold">{formatSleep(healthData.sleepMinutes)}</span>
          <span className="text-xs text-muted-foreground">Sleep</span>
        </div>
      </div>
    );
  }

  return (
    <Link href="/health">
    <Card className={`${className} cursor-pointer hover:bg-accent/50 transition-colors`} data-testid="card-health-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Today's Activity
          </CardTitle>
          <Badge variant="outline" className="text-xs gap-1">
            <Watch className="w-3 h-3" />
            {getSourceLabel()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 p-3 bg-gradient-to-br from-blue-500/5 to-blue-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-blue-500/15">
                <Footprints className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground">Steps</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-steps-count">
              {formatNumber(healthData.steps)}
            </p>
          </div>

          <div className="space-y-1 p-3 bg-gradient-to-br from-orange-500/5 to-orange-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-orange-500/15">
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <span className="text-xs text-muted-foreground">Calories</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-calories-burned">
              {formatNumber(healthData.caloriesBurned)}
            </p>
          </div>

          <div className="space-y-1 p-3 bg-gradient-to-br from-red-500/5 to-red-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-red-500/15">
                <Heart className="w-4 h-4 text-red-500" />
              </div>
              <span className="text-xs text-muted-foreground">Avg Heart Rate</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-heart-rate">
              {healthData.avgHeartRate || '-'} 
              <span className="text-sm font-normal text-muted-foreground ml-1">bpm</span>
            </p>
          </div>

          <div className="space-y-1 p-3 bg-gradient-to-br from-purple-500/5 to-purple-500/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-purple-500/15">
                <Moon className="w-4 h-4 text-purple-500" />
              </div>
              <span className="text-xs text-muted-foreground">Sleep</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-sleep-duration">
              {formatSleep(healthData.sleepMinutes)}
            </p>
            {healthData.sleepQuality && (
              <Badge variant="secondary" className="text-xs capitalize">
                {healthData.sleepQuality}
              </Badge>
            )}
          </div>
        </div>

        {(healthData.activeMinutes || healthData.distanceMeters) && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            {healthData.activeMinutes && (
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-muted-foreground">Active:</span>
                <span className="font-medium">{healthData.activeMinutes} min</span>
              </div>
            )}
            {healthData.distanceMeters && (
              <div className="flex items-center gap-2 text-sm">
                <Footprints className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-medium">{(healthData.distanceMeters / 1000).toFixed(1)} km</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </Link>
  );
}

export function HealthCaloriesBurned() {
  const { data: status } = useHealthStatus();
  const { data: healthData } = useHealthDataToday();

  if (!status?.connected || !healthData?.caloriesBurned) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg">
      <Flame className="w-4 h-4 text-orange-500" />
      <span className="text-sm">
        <span className="font-medium">{healthData.caloriesBurned.toLocaleString()}</span>
        <span className="text-muted-foreground ml-1">burned today</span>
      </span>
    </div>
  );
}
