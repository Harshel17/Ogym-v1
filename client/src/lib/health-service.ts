import { Capacitor } from '@capacitor/core';
import { apiRequest } from './queryClient';
import { getLocalDate } from './timezone';

export type HealthSource = 'apple_health' | 'google_fit';

export interface SleepStage {
  stage: 'awake' | 'light' | 'deep' | 'rem' | 'core';
  minutes: number;
}

export interface HealthDataPayload {
  date: string;
  steps?: number;
  caloriesBurned?: number;
  activeCalories?: number;
  activeMinutes?: number;
  distanceMeters?: number;
  restingHeartRate?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  hrv?: number;
  sleepMinutes?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  bedtime?: string;
  wakeTime?: string;
  sleepStages?: SleepStage[];
  watchWorkouts?: Array<{ type: string; duration: number; calories: number }>;
  source: HealthSource;
}

export interface HealthConnectionStatus {
  connected: boolean;
  source: HealthSource | null;
}

class HealthService {
  private isNative: boolean;
  private platform: 'ios' | 'android' | 'web';
  private healthPlugin: any = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
  }

  async initialize(): Promise<boolean> {
    if (!this.isNative) {
      console.log('Health service not available on web');
      return false;
    }

    if (this.healthPlugin) return true;

    try {
      const mod = await import('capacitor-health');
      this.healthPlugin = mod.Health || mod.default?.Health || mod.default;
      if (!this.healthPlugin) {
        console.error('Health plugin loaded but Health class not found');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to initialize health plugin:', error);
      return false;
    }
  }

  getAvailableSource(): HealthSource | null {
    if (!this.isNative) return null;
    return this.platform === 'ios' ? 'apple_health' : 'google_fit';
  }

  isAvailable(): boolean {
    return this.isNative && (this.platform === 'ios' || this.platform === 'android');
  }

  async checkPermissions(): Promise<boolean> {
    if (!this.healthPlugin) {
      await this.initialize();
    }
    
    if (!this.healthPlugin) return false;

    try {
      const result = await this.healthPlugin.isHealthAvailable();
      return result.available;
    } catch (error) {
      console.error('Failed to check health permissions:', error);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (!this.healthPlugin) {
        const initialized = await this.initialize();
        if (!initialized) return false;
      }
      
      if (!this.healthPlugin) return false;

      const permissions = [
        'READ_STEPS',
        'READ_ACTIVE_CALORIES', 
        'READ_TOTAL_CALORIES',
        'READ_HEART_RATE',
        'READ_DISTANCE',
        'READ_WORKOUTS',
      ];

      await this.healthPlugin.requestHealthPermissions({ permissions });
      return true;
    } catch (error) {
      console.error('Failed to request health permissions:', error);
      return false;
    }
  }

  private getDayRange(dateStr: string): { startISO: string; endISO: string } {
    const d = new Date(dateStr + 'T00:00:00');
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { startISO: startOfDay.toISOString(), endISO: endOfDay.toISOString() };
  }

  async fetchDataForDate(dateStr: string): Promise<HealthDataPayload | null> {
    if (!this.healthPlugin) {
      await this.initialize();
    }
    
    if (!this.healthPlugin) {
      console.log('[HealthService] Plugin not available');
      return null;
    }

    const source = this.getAvailableSource();
    if (!source) return null;

    const { startISO, endISO } = this.getDayRange(dateStr);

    try {
      const data: HealthDataPayload = {
        date: dateStr,
        source,
      };

      console.log(`[HealthService] Fetching data for ${dateStr} (range: ${startISO} to ${endISO})`);

      try {
        const stepsResult = await this.healthPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'steps',
          bucket: 'day'
        });
        if (stepsResult?.aggregatedData?.[0]?.value) {
          data.steps = Math.round(stepsResult.aggregatedData[0].value);
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch steps:', e);
      }

      try {
        const caloriesResult = await this.healthPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'active-calories',
          bucket: 'day'
        });
        if (caloriesResult?.aggregatedData?.[0]?.value) {
          data.activeCalories = Math.round(caloriesResult.aggregatedData[0].value);
          data.caloriesBurned = data.activeCalories;
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch calories:', e);
      }

      try {
        const mindfulnessResult = await this.healthPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'mindfulness',
          bucket: 'day'
        });
        if (mindfulnessResult?.aggregatedData?.[0]?.value) {
          const mindfulMinutes = Math.round(mindfulnessResult.aggregatedData[0].value / 60);
          console.log(`[HealthService] Mindfulness: ${mindfulMinutes} minutes`);
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch mindfulness:', e);
      }

      try {
        const workoutsResult = await this.healthPlugin.queryWorkouts({
          startDate: startISO,
          endDate: endISO,
          includeHeartRate: true,
          includeRoute: false,
          includeSteps: true
        });
        
        if (workoutsResult?.workouts?.length > 0) {
          const workouts: Array<{ type: string; duration: number; calories: number }> = [];
          let totalDurationSeconds = 0;
          let totalCalories = 0;
          let totalDistance = 0;
          const heartRates: number[] = [];
          
          for (const workout of workoutsResult.workouts) {
            const durationSec = workout.duration || 0;
            const durationMin = Math.round(durationSec / 60);
            
            workouts.push({
              type: workout.workoutType || 'unknown',
              duration: durationMin,
              calories: Math.round(workout.calories || 0)
            });
            totalDurationSeconds += durationSec;
            totalCalories += (workout.calories || 0);
            if (workout.distance) totalDistance += workout.distance;
            
            if (workout.heartRate?.length > 0) {
              for (const hr of workout.heartRate) {
                if (hr.bpm && hr.bpm > 30 && hr.bpm < 250) {
                  heartRates.push(hr.bpm);
                }
              }
            }
          }
          
          data.watchWorkouts = workouts;
          
          if (totalDurationSeconds > 0) {
            data.activeMinutes = Math.round(totalDurationSeconds / 60);
          }
          
          if (totalCalories > 0) {
            if (!data.caloriesBurned || totalCalories > data.caloriesBurned) {
              data.caloriesBurned = Math.round(totalCalories);
            }
          }
          
          if (totalDistance > 0 && !data.distanceMeters) {
            data.distanceMeters = Math.round(totalDistance);
          }
          
          if (heartRates.length > 0) {
            heartRates.sort((a, b) => a - b);
            data.avgHeartRate = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
            data.maxHeartRate = Math.round(heartRates[heartRates.length - 1]);
            
            const lowestQuartile = heartRates.slice(0, Math.max(1, Math.floor(heartRates.length * 0.25)));
            data.restingHeartRate = Math.round(lowestQuartile.reduce((a, b) => a + b, 0) / lowestQuartile.length);
          }
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch workouts:', e);
      }

      try {
        const sleepWindow = 20 * 60 * 60 * 1000;
        const sleepStartISO = new Date(new Date(dateStr + 'T00:00:00').getTime() - sleepWindow).toISOString();
        
        const sleepWorkouts = await this.healthPlugin.queryWorkouts({
          startDate: sleepStartISO,
          endDate: endISO,
          includeHeartRate: true,
          includeRoute: false,
          includeSteps: false
        });
        
        if (sleepWorkouts?.workouts?.length > 0) {
          let totalSleepMinutes = 0;
          let earliestBedtime: Date | null = null;
          let latestWakeTime: Date | null = null;
          const sleepHeartRates: number[] = [];
          
          for (const workout of sleepWorkouts.workouts) {
            const wType = (workout.workoutType || '').toLowerCase();
            const isSleep = wType.includes('sleep') || wType === 'sleeping' || wType === 'inbed' || wType === 'sleep';
            
            if (isSleep) {
              const durationMin = Math.round((workout.duration || 0) / 60);
              if (durationMin > 0) {
                totalSleepMinutes += durationMin;
                
                const start = new Date(workout.startDate);
                const end = new Date(workout.endDate);
                if (!earliestBedtime || start < earliestBedtime) earliestBedtime = start;
                if (!latestWakeTime || end > latestWakeTime) latestWakeTime = end;
                
                if (workout.heartRate?.length > 0) {
                  for (const hr of workout.heartRate) {
                    if (hr.bpm && hr.bpm > 30 && hr.bpm < 200) {
                      sleepHeartRates.push(hr.bpm);
                    }
                  }
                }
              }
            }
          }
          
          if (totalSleepMinutes > 0) {
            data.sleepMinutes = totalSleepMinutes;
            const hours = totalSleepMinutes / 60;
            if (hours >= 7.5) data.sleepQuality = 'excellent';
            else if (hours >= 6.5) data.sleepQuality = 'good';
            else if (hours >= 5) data.sleepQuality = 'fair';
            else data.sleepQuality = 'poor';
            
            if (earliestBedtime) {
              data.bedtime = earliestBedtime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            if (latestWakeTime) {
              data.wakeTime = latestWakeTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            }
            
            if (sleepHeartRates.length > 0) {
              sleepHeartRates.sort((a, b) => a - b);
              const restingFromSleep = Math.round(sleepHeartRates.slice(0, Math.max(1, Math.floor(sleepHeartRates.length * 0.1))).reduce((a, b) => a + b, 0) / Math.max(1, Math.floor(sleepHeartRates.length * 0.1)));
              if (!data.restingHeartRate || restingFromSleep < data.restingHeartRate) {
                data.restingHeartRate = restingFromSleep;
              }
            }
          }
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch sleep workouts:', e);
      }

      console.log('[HealthService] Final data to sync:', JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('[HealthService] Failed to fetch health data:', error);
      return null;
    }
  }

  async fetchTodayData(): Promise<HealthDataPayload | null> {
    return this.fetchDataForDate(getLocalDate());
  }

  // Fix 4: Backfill missed days when app opens
  async backfillMissedDays(): Promise<number> {
    if (!this.healthPlugin) {
      await this.initialize();
    }
    if (!this.healthPlugin) return 0;

    try {
      const response = await fetch('/api/health/last-sync-date', { credentials: 'include' });
      if (!response.ok) return 0;
      const { lastSyncDate } = await response.json();
      
      const today = getLocalDate();
      if (!lastSyncDate || lastSyncDate === today) return 0;

      const lastSync = new Date(lastSyncDate + 'T12:00:00');
      const todayDate = new Date(today + 'T12:00:00');
      const daysDiff = Math.floor((todayDate.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24));
      
      const maxBackfill = Math.min(daysDiff - 1, 7);
      if (maxBackfill <= 0) return 0;

      let synced = 0;
      for (let i = maxBackfill; i >= 1; i--) {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        try {
          const dayData = await this.fetchDataForDate(dateStr);
          if (dayData && (dayData.steps || dayData.sleepMinutes || dayData.caloriesBurned)) {
            await apiRequest('POST', '/api/health/sync', dayData);
            synced++;
          }
        } catch (e) {
          console.log(`[HealthService] Could not backfill ${dateStr}:`, e);
        }
      }
      
      console.log(`[HealthService] Backfilled ${synced} missed days`);
      return synced;
    } catch (error) {
      console.error('[HealthService] Backfill failed:', error);
      return 0;
    }
  }

  async syncToBackend(): Promise<boolean> {
    const data = await this.fetchTodayData();
    if (!data) return false;

    try {
      await apiRequest('POST', '/api/health/sync', data);
      
      // Fix 4: Also backfill any missed days
      this.backfillMissedDays().catch(e => 
        console.log('[HealthService] Background backfill error:', e)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to sync health data to backend:', error);
      return false;
    }
  }

  // Fix 3: Setup background sync (call this on app start)
  async setupBackgroundSync(): Promise<void> {
    if (!this.isNative) return;

    try {
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', async ({ isActive }) => {
        if (isActive) {
          console.log('[HealthService] App became active, syncing health data...');
          await this.syncToBackend();
        }
      });
      console.log('[HealthService] Background sync listener registered');
    } catch (e) {
      console.log('[HealthService] Could not setup app state listener:', e);
    }

    try {
      const moduleName = '@nicepkg/capacitor-background-runner';
      const mod = await import(/* @vite-ignore */ moduleName);
      const BackgroundRunner = mod.BackgroundRunner;
      await BackgroundRunner.registerBackgroundTask({
        taskId: 'com.ogym.healthsync',
        delay: 900000,
        periodic: true,
      } as any);
      console.log('[HealthService] Background runner registered (15min interval)');
    } catch (e) {
      console.log('[HealthService] BackgroundRunner not available, using app-state sync only:', e);
    }
  }

  async connect(): Promise<boolean> {
    const source = this.getAvailableSource();
    if (!source) return false;

    try {
      const authorized = await this.requestPermissions();
      if (!authorized) return false;
    } catch (error) {
      console.error('Health permissions request failed (plugin may not be configured):', error);
      return false;
    }

    try {
      await apiRequest('POST', '/api/health/connect', {
        connected: true,
        source
      });

      await this.syncToBackend();
      await this.setupBackgroundSync();
      return true;
    } catch (error) {
      console.error('Failed to connect health service:', error);
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      await apiRequest('POST', '/api/health/connect', {
        connected: false,
        source: null
      });
      return true;
    } catch (error) {
      console.error('Failed to disconnect health service:', error);
      return false;
    }
  }

  async getConnectionStatus(): Promise<HealthConnectionStatus> {
    try {
      const response = await fetch('/api/health/status', { credentials: 'include' });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to get health connection status:', error);
    }
    return { connected: false, source: null };
  }
}

export const healthService = new HealthService();
