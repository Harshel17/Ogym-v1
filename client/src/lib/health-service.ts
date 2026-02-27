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
        'READ_SLEEP',
        'READ_RESTING_HEART_RATE',
        'READ_HEART_RATE_VARIABILITY',
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

      // Fix 1: Fetch steps
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

      // Fix 5: Fetch active calories with fallback data type names
      try {
        let caloriesResult = await this.healthPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'active-calories',
          bucket: 'day'
        });
        if (!caloriesResult?.aggregatedData?.[0]?.value) {
          caloriesResult = await this.healthPlugin.queryAggregated({
            startDate: startISO,
            endDate: endISO,
            dataType: 'activeEnergyBurned',
            bucket: 'day'
          });
        }
        if (caloriesResult?.aggregatedData?.[0]?.value) {
          data.activeCalories = Math.round(caloriesResult.aggregatedData[0].value);
          data.caloriesBurned = data.activeCalories;
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch calories:', e);
      }

      // Fix 5: Fetch distance with fallback
      try {
        let distResult = await this.healthPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'distance',
          bucket: 'day'
        });
        if (!distResult?.aggregatedData?.[0]?.value) {
          distResult = await this.healthPlugin.queryAggregated({
            startDate: startISO,
            endDate: endISO,
            dataType: 'distanceWalkingRunning',
            bucket: 'day'
          });
        }
        if (distResult?.aggregatedData?.[0]?.value) {
          data.distanceMeters = Math.round(distResult.aggregatedData[0].value);
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch distance:', e);
      }

      // Fix 2: Fetch resting heart rate separately (not from workouts)
      try {
        const rhrResult = await this.healthPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'restingHeartRate',
          bucket: 'day'
        });
        if (rhrResult?.aggregatedData?.[0]?.value) {
          data.restingHeartRate = Math.round(rhrResult.aggregatedData[0].value);
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch resting HR:', e);
      }

      // Fix 6: Fetch HRV (Heart Rate Variability)
      try {
        const hrvResult = await this.healthPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'heartRateVariability',
          bucket: 'day'
        });
        if (hrvResult?.aggregatedData?.[0]?.value) {
          data.hrv = Math.round(hrvResult.aggregatedData[0].value);
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch HRV:', e);
      }

      // Fix 1 (Sleep): Query sleep data from device
      try {
        const sleepResult = await this.healthPlugin.querySleep({
          startDate: new Date(new Date(dateStr + 'T00:00:00').getTime() - 12 * 60 * 60 * 1000).toISOString(),
          endDate: endISO,
        });
        
        if (sleepResult?.sleepData?.length > 0) {
          let totalSleepMinutes = 0;
          const stages: SleepStage[] = [];
          let earliestBedtime: Date | null = null;
          let latestWakeTime: Date | null = null;

          for (const session of sleepResult.sleepData) {
            if (session.startDate && session.endDate) {
              const start = new Date(session.startDate);
              const end = new Date(session.endDate);
              
              if (!earliestBedtime || start < earliestBedtime) earliestBedtime = start;
              if (!latestWakeTime || end > latestWakeTime) latestWakeTime = end;
            }

            // Fix 7: Parse sleep stages
            if (session.samples?.length > 0) {
              for (const sample of session.samples) {
                const sampleStart = new Date(sample.startDate);
                const sampleEnd = new Date(sample.endDate);
                const mins = Math.round((sampleEnd.getTime() - sampleStart.getTime()) / 60000);
                
                let stage: SleepStage['stage'] = 'light';
                const val = (sample.value || sample.stage || '').toString().toLowerCase();
                if (val.includes('deep')) stage = 'deep';
                else if (val.includes('rem')) stage = 'rem';
                else if (val.includes('awake') || val.includes('inbed')) stage = 'awake';
                else if (val.includes('core')) stage = 'core';
                else stage = 'light';

                if (stage !== 'awake') {
                  totalSleepMinutes += mins;
                }
                
                const existing = stages.find(s => s.stage === stage);
                if (existing) {
                  existing.minutes += mins;
                } else {
                  stages.push({ stage, minutes: mins });
                }
              }
            } else if (session.duration) {
              totalSleepMinutes += Math.round(session.duration / 60);
            } else if (session.startDate && session.endDate) {
              const durMs = new Date(session.endDate).getTime() - new Date(session.startDate).getTime();
              totalSleepMinutes += Math.round(durMs / 60000);
            }
          }

          if (totalSleepMinutes > 0) {
            data.sleepMinutes = totalSleepMinutes;
            
            const hours = totalSleepMinutes / 60;
            if (hours >= 7.5) data.sleepQuality = 'excellent';
            else if (hours >= 6.5) data.sleepQuality = 'good';
            else if (hours >= 5) data.sleepQuality = 'fair';
            else data.sleepQuality = 'poor';
          }

          if (stages.length > 0) {
            data.sleepStages = stages;
          }

          if (earliestBedtime) {
            data.bedtime = earliestBedtime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          }
          if (latestWakeTime) {
            data.wakeTime = latestWakeTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          }
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch sleep:', e);
        // Fallback: try aggregated sleep query
        try {
          const sleepAgg = await this.healthPlugin.queryAggregated({
            startDate: new Date(new Date(dateStr + 'T00:00:00').getTime() - 12 * 60 * 60 * 1000).toISOString(),
            endDate: endISO,
            dataType: 'sleep',
            bucket: 'day'
          });
          if (sleepAgg?.aggregatedData?.[0]?.value) {
            data.sleepMinutes = Math.round(sleepAgg.aggregatedData[0].value);
            const hours = data.sleepMinutes / 60;
            if (hours >= 7.5) data.sleepQuality = 'excellent';
            else if (hours >= 6.5) data.sleepQuality = 'good';
            else if (hours >= 5) data.sleepQuality = 'fair';
            else data.sleepQuality = 'poor';
          }
        } catch (e2) {
          console.log('[HealthService] Could not fetch aggregated sleep either:', e2);
        }
      }

      // Fetch workouts (heart rate from workouts as secondary source)
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
          let totalActiveMinutes = 0;
          let totalCalories = 0;
          const heartRates: number[] = [];
          
          for (const workout of workoutsResult.workouts) {
            workouts.push({
              type: workout.workoutType || workout.type || 'unknown',
              duration: workout.duration || 0,
              calories: workout.calories || 0
            });
            totalActiveMinutes += (workout.duration || 0);
            totalCalories += (workout.calories || 0);
            
            if (workout.heartRate?.length > 0) {
              for (const hr of workout.heartRate) {
                if (hr.bpm) heartRates.push(hr.bpm);
              }
            }
          }
          
          data.watchWorkouts = workouts;
          if (totalActiveMinutes > 0) {
            data.activeMinutes = Math.round(totalActiveMinutes / 60);
          }
          if (totalCalories > 0 && !data.caloriesBurned) {
            data.caloriesBurned = totalCalories;
          }
          
          if (heartRates.length > 0) {
            if (!data.avgHeartRate) {
              data.avgHeartRate = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
            }
            data.maxHeartRate = Math.round(Math.max(...heartRates));
          }
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch workouts:', e);
      }

      // Try to get avgHeartRate from aggregated query if workouts didn't provide it
      if (!data.avgHeartRate) {
        try {
          const hrResult = await this.healthPlugin.queryAggregated({
            startDate: startISO,
            endDate: endISO,
            dataType: 'heartRate',
            bucket: 'day'
          });
          if (hrResult?.aggregatedData?.[0]?.value) {
            data.avgHeartRate = Math.round(hrResult.aggregatedData[0].value);
          }
        } catch (e) {
          console.log('[HealthService] Could not fetch aggregated HR:', e);
        }
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
