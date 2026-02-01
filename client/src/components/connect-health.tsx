import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Heart, Footprints, Moon, Flame, Clock } from 'lucide-react';
import { SiApple } from 'react-icons/si';
import { Capacitor } from '@capacitor/core';

// Feature flag - set to true when ready to enable health integration
const HEALTH_FEATURE_ENABLED = false;

export function ConnectHealth() {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  const sourceName = platform === 'ios' ? 'Apple Health' : 'Google Fit';
  const sourceIcon = platform === 'ios' 
    ? <SiApple className="w-5 h-5" /> 
    : <Activity className="w-5 h-5" />;

  // Show Coming Soon state when feature is disabled
  if (!HEALTH_FEATURE_ENABLED) {
    return (
      <Card data-testid="card-connect-health" className="opacity-90">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isNative ? sourceIcon : <Activity className="w-5 h-5" />}
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {isNative ? sourceName : 'Fitness Device'}
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    Coming Soon
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Sync steps, calories, heart rate & sleep
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We're working on bringing fitness device integration to OGym. Soon you'll be able to automatically sync your health data.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Footprints className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Daily steps</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Flame className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Calories burned</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Heart className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Heart rate</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sleep duration</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full functionality will be enabled when HEALTH_FEATURE_ENABLED = true
  return null;
}
