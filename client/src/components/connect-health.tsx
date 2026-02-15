import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Heart, Footprints, Moon, Flame, HeartPulse, ChevronRight, Watch } from 'lucide-react';
import { SiApple } from 'react-icons/si';
import { Capacitor } from '@capacitor/core';
import { useHealthStatus } from '@/hooks/use-health-data';
import { Link } from 'wouter';

export function ConnectHealth() {
  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();
  const { data: status } = useHealthStatus();

  const sourceName = platform === 'ios' ? 'Apple Health' : platform === 'android' ? 'Google Fit' : 'Fitness Device';
  const sourceIcon = platform === 'ios' 
    ? <SiApple className="w-5 h-5" /> 
    : <Activity className="w-5 h-5" />;

  const isConnected = status?.connected;

  return (
    <Link href="/health">
      <Card data-testid="card-connect-health" className="cursor-pointer hover:bg-accent/50 transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <HeartPulse className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Health & Activity
                  {isConnected && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Watch className="w-3 h-3" />
                      {status?.source === 'apple_health' ? 'Apple Health' : 'Google Fit'}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {isConnected ? 'View your fitness data and insights' : 'Connect your device to track health metrics'}
                </CardDescription>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/30 rounded-lg">
              <Footprints className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] text-muted-foreground">Steps</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/30 rounded-lg">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-[10px] text-muted-foreground">Calories</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/30 rounded-lg">
              <Heart className="w-4 h-4 text-red-500" />
              <span className="text-[10px] text-muted-foreground">Heart Rate</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/30 rounded-lg">
              <Moon className="w-4 h-4 text-purple-500" />
              <span className="text-[10px] text-muted-foreground">Sleep</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
