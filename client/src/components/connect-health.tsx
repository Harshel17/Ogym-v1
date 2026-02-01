import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Activity, Heart, Footprints, Moon, Flame, Watch, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { SiApple } from 'react-icons/si';
import { useHealthStatus, useConnectHealth, useDisconnectHealth, useSyncHealth, useHealthServiceInfo } from '@/hooks/use-health-data';
import { Capacitor } from '@capacitor/core';

export function ConnectHealth() {
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useHealthStatus();
  const { isAvailable, availableSource } = useHealthServiceInfo();
  const connectMutation = useConnectHealth();
  const disconnectMutation = useDisconnectHealth();
  const syncMutation = useSyncHealth();
  const [showDetails, setShowDetails] = useState(false);

  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  const handleToggle = async () => {
    if (status?.connected) {
      try {
        await disconnectMutation.mutateAsync();
        toast({
          title: 'Disconnected',
          description: 'Health tracking has been disabled.'
        });
      } catch {
        toast({
          title: 'Failed to disconnect',
          variant: 'destructive'
        });
      }
    } else {
      try {
        await connectMutation.mutateAsync();
        toast({
          title: 'Connected!',
          description: 'Health data will now sync automatically.'
        });
      } catch {
        toast({
          title: 'Failed to connect',
          description: 'Please check your device settings and try again.',
          variant: 'destructive'
        });
      }
    }
  };

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync();
      toast({
        title: 'Synced!',
        description: 'Your health data has been updated.'
      });
    } catch {
      toast({
        title: 'Sync failed',
        description: 'Please try again later.',
        variant: 'destructive'
      });
    }
  };

  if (!isNative) {
    return (
      <Card data-testid="card-connect-health">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Fitness Device
          </CardTitle>
          <CardDescription>
            Connect your Apple Watch or Android wearable to sync health data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <Smartphone className="w-8 h-8 text-muted-foreground" />
            <div className="flex-1">
              <p className="font-medium">Mobile App Required</p>
              <p className="text-sm text-muted-foreground">
                Download the OGym mobile app to connect your fitness device and sync health data automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sourceName = platform === 'ios' ? 'Apple Health' : 'Google Fit';
  const sourceIcon = platform === 'ios' 
    ? <SiApple className="w-5 h-5" /> 
    : <Activity className="w-5 h-5" />;

  const isPending = connectMutation.isPending || disconnectMutation.isPending;

  return (
    <Card data-testid="card-connect-health">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {sourceIcon}
            <div>
              <CardTitle className="text-lg">{sourceName}</CardTitle>
              <CardDescription>
                Sync steps, calories, heart rate & sleep
              </CardDescription>
            </div>
          </div>
          {statusLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <div className="flex items-center gap-3">
              {status?.connected && (
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Connected
                </Badge>
              )}
              <Switch
                data-testid="switch-health-connection"
                checked={status?.connected || false}
                onCheckedChange={handleToggle}
                disabled={isPending}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.connected && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Footprints className="w-5 h-5 text-blue-500" />
                <span className="text-sm">Steps</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-sm">Calories</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Heart className="w-5 h-5 text-red-500" />
                <span className="text-sm">Heart Rate</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Moon className="w-5 h-5 text-purple-500" />
                <span className="text-sm">Sleep</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSync}
              disabled={syncMutation.isPending}
              data-testid="button-sync-health"
            >
              {syncMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Watch className="w-4 h-4 mr-2" />
              )}
              Sync Now
            </Button>
          </>
        )}
        {!status?.connected && (
          <div className="text-sm text-muted-foreground">
            <p>Connecting will allow OGym to read:</p>
            <ul className="mt-2 space-y-1">
              <li className="flex items-center gap-2">
                <Footprints className="w-4 h-4" /> Daily steps
              </li>
              <li className="flex items-center gap-2">
                <Flame className="w-4 h-4" /> Calories burned
              </li>
              <li className="flex items-center gap-2">
                <Heart className="w-4 h-4" /> Heart rate data
              </li>
              <li className="flex items-center gap-2">
                <Moon className="w-4 h-4" /> Sleep duration
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
