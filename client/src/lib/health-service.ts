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
  private oldPlugin: any = null;
  private capgoPlugin: any = null;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    this.platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
  }

  async initialize(): Promise<boolean> {
    if (!this.isNative) {
      console.log('Health service not available on web');
      return false;
    }

    if (this.capgoPlugin) return true;

    try {
      const capgoMod = await import('@capgo/capacitor-health');
      this.capgoPlugin = capgoMod.CapacitorHealth || capgoMod.Health || capgoMod.default;
      console.log('[HealthService] @capgo/capacitor-health loaded');
    } catch (error) {
      console.error('[HealthService] Failed to load @capgo/capacitor-health:', error);
    }

    try {
      const oldMod = await import('capacitor-health');
      this.oldPlugin = oldMod.Health || oldMod.default?.Health || oldMod.default;
      console.log('[HealthService] capacitor-health (old) loaded');
    } catch (error) {
      console.error('[HealthService] Failed to load capacitor-health:', error);
    }

    if (!this.capgoPlugin && !this.oldPlugin) {
      console.error('[HealthService] No health plugin available');
      return false;
    }

    return true;
  }

  getAvailableSource(): HealthSource | null {
    if (!this.isNative) return null;
    return this.platform === 'ios' ? 'apple_health' : 'google_fit';
  }

  isAvailable(): boolean {
    return this.isNative && (this.platform === 'ios' || this.platform === 'android');
  }

  async checkPermissions(): Promise<boolean> {
    await this.initialize();

    if (this.capgoPlugin) {
      try {
        const result = await this.capgoPlugin.isAvailable();
        return result.available;
      } catch (e) {
        console.log('[HealthService] capgo isAvailable failed:', e);
      }
    }

    if (this.oldPlugin) {
      try {
        const result = await this.oldPlugin.isHealthAvailable();
        return result.available;
      } catch (e) {
        console.log('[HealthService] old isHealthAvailable failed:', e);
      }
    }

    return false;
  }

  async requestPermissions(): Promise<boolean> {
    await this.initialize();

    if (this.capgoPlugin) {
      try {
        await this.capgoPlugin.requestAuthorization({
          read: ['steps', 'distance', 'calories', 'heartRate', 'weight'],
        });
        console.log('[HealthService] capgo permissions granted');
      } catch (error) {
        console.error('[HealthService] capgo permissions failed:', error);
      }
    }

    if (this.oldPlugin) {
      try {
        await this.oldPlugin.requestHealthPermissions({
          permissions: [
            'READ_STEPS',
            'READ_ACTIVE_CALORIES',
            'READ_TOTAL_CALORIES',
            'READ_HEART_RATE',
            'READ_DISTANCE',
            'READ_WORKOUTS',
          ],
        });
        console.log('[HealthService] old plugin permissions granted');
      } catch (error) {
        console.error('[HealthService] old plugin permissions failed:', error);
      }
    }

    return true;
  }

  private getDayRange(dateStr: string): { startISO: string; endISO: string } {
    const d = new Date(dateStr + 'T00:00:00');
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { startISO: startOfDay.toISOString(), endISO: endOfDay.toISOString() };
  }

  async fetchDataForDate(dateStr: string): Promise<HealthDataPayload | null> {
    await this.initialize();

    if (!this.capgoPlugin && !this.oldPlugin) {
      console.log('[HealthService] No plugin available');
      return null;
    }

    const source = this.getAvailableSource();
    if (!source) return null;

    const { startISO, endISO } = this.getDayRange(dateStr);

    const data: HealthDataPayload = {
      date: dateStr,
      source,
    };

    console.log(`[HealthService] Fetching data for ${dateStr} (range: ${startISO} to ${endISO})`);

    if (this.capgoPlugin) {
      try {
        const stepsResult = await this.capgoPlugin.readSamples({
          dataType: 'steps',
          startDate: startISO,
          endDate: endISO,
          limit: 1000,
        });
        if (stepsResult?.samples?.length > 0) {
          const totalSteps = stepsResult.samples.reduce((sum: number, s: any) => sum + (s.value || 0), 0);
          if (totalSteps > 0) {
            data.steps = Math.round(totalSteps);
            console.log(`[HealthService] capgo steps: ${data.steps}`);
          }
        }
      } catch (e) {
        console.log('[HealthService] capgo steps failed:', e);
      }

      try {
        const calResult = await this.capgoPlugin.readSamples({
          dataType: 'calories',
          startDate: startISO,
          endDate: endISO,
          limit: 1000,
        });
        if (calResult?.samples?.length > 0) {
          const totalCal = calResult.samples.reduce((sum: number, s: any) => sum + (s.value || 0), 0);
          if (totalCal > 0) {
            data.caloriesBurned = Math.round(totalCal);
            data.activeCalories = Math.round(totalCal);
            console.log(`[HealthService] capgo calories: ${data.caloriesBurned}`);
          }
        }
      } catch (e) {
        console.log('[HealthService] capgo calories failed:', e);
      }

      try {
        const hrResult = await this.capgoPlugin.readSamples({
          dataType: 'heartRate',
          startDate: startISO,
          endDate: endISO,
          limit: 5000,
        });
        if (hrResult?.samples?.length > 0) {
          const validHR = hrResult.samples
            .map((s: any) => s.value)
            .filter((v: number) => v > 30 && v < 250);
          if (validHR.length > 0) {
            validHR.sort((a: number, b: number) => a - b);
            data.avgHeartRate = Math.round(validHR.reduce((a: number, b: number) => a + b, 0) / validHR.length);
            data.maxHeartRate = Math.round(validHR[validHR.length - 1]);
            const lowestTenPct = validHR.slice(0, Math.max(1, Math.floor(validHR.length * 0.10)));
            data.restingHeartRate = Math.round(lowestTenPct.reduce((a: number, b: number) => a + b, 0) / lowestTenPct.length);
            console.log(`[HealthService] capgo HR: avg=${data.avgHeartRate}, rest=${data.restingHeartRate}, max=${data.maxHeartRate} from ${validHR.length} samples`);
          }
        }
      } catch (e) {
        console.log('[HealthService] capgo heartRate failed:', e);
      }

      try {
        const distResult = await this.capgoPlugin.readSamples({
          dataType: 'distance',
          startDate: startISO,
          endDate: endISO,
          limit: 1000,
        });
        if (distResult?.samples?.length > 0) {
          const totalDist = distResult.samples.reduce((sum: number, s: any) => sum + (s.value || 0), 0);
          if (totalDist > 0) {
            data.distanceMeters = Math.round(totalDist);
            console.log(`[HealthService] capgo distance: ${data.distanceMeters}m`);
          }
        }
      } catch (e) {
        console.log('[HealthService] capgo distance failed:', e);
      }
    }

    if (!data.steps && this.oldPlugin) {
      try {
        const stepsResult = await this.oldPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'steps',
          bucket: 'day',
        });
        if (stepsResult?.aggregatedData?.[0]?.value) {
          data.steps = Math.round(stepsResult.aggregatedData[0].value);
          console.log(`[HealthService] old plugin steps fallback: ${data.steps}`);
        }
      } catch (e) {
        console.log('[HealthService] old plugin steps failed:', e);
      }
    }

    if (!data.caloriesBurned && this.oldPlugin) {
      try {
        const calResult = await this.oldPlugin.queryAggregated({
          startDate: startISO,
          endDate: endISO,
          dataType: 'active-calories',
          bucket: 'day',
        });
        if (calResult?.aggregatedData?.[0]?.value) {
          data.activeCalories = Math.round(calResult.aggregatedData[0].value);
          data.caloriesBurned = data.activeCalories;
          console.log(`[HealthService] old plugin calories fallback: ${data.caloriesBurned}`);
        }
      } catch (e) {
        console.log('[HealthService] old plugin calories failed:', e);
      }
    }

    if (this.oldPlugin) {
      try {
        const workoutsResult = await this.oldPlugin.queryWorkouts({
          startDate: startISO,
          endDate: endISO,
          includeHeartRate: true,
          includeRoute: false,
          includeSteps: true,
        });

        if (workoutsResult?.workouts?.length > 0) {
          const workouts: Array<{ type: string; duration: number; calories: number }> = [];
          let totalDurationSeconds = 0;
          let totalCalories = 0;
          let totalDistance = 0;
          const heartRates: number[] = [];

          for (const workout of workoutsResult.workouts) {
            const wType = (workout.workoutType || '').toLowerCase();
            if (wType.includes('sleep') || wType === 'sleeping' || wType === 'inbed') continue;

            const durationSec = workout.duration || 0;
            workouts.push({
              type: workout.workoutType || 'unknown',
              duration: Math.round(durationSec / 60),
              calories: Math.round(workout.calories || 0),
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

          if (workouts.length > 0) data.watchWorkouts = workouts;

          if (totalDurationSeconds > 0) {
            data.activeMinutes = Math.round(totalDurationSeconds / 60);
          }

          if (totalCalories > 0 && (!data.caloriesBurned || totalCalories > data.caloriesBurned)) {
            data.caloriesBurned = Math.round(totalCalories);
          }

          if (totalDistance > 0 && !data.distanceMeters) {
            data.distanceMeters = Math.round(totalDistance);
          }

          if (heartRates.length > 0 && !data.avgHeartRate) {
            heartRates.sort((a, b) => a - b);
            data.avgHeartRate = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
            data.maxHeartRate = Math.round(heartRates[heartRates.length - 1]);
            const lowestQuartile = heartRates.slice(0, Math.max(1, Math.floor(heartRates.length * 0.25)));
            data.restingHeartRate = Math.round(lowestQuartile.reduce((a, b) => a + b, 0) / lowestQuartile.length);
          }
        }
      } catch (e) {
        console.log('[HealthService] workouts query failed:', e);
      }

      try {
        const sleepWindow = 20 * 60 * 60 * 1000;
        const sleepStartISO = new Date(new Date(dateStr + 'T00:00:00').getTime() - sleepWindow).toISOString();

        const sleepWorkouts = await this.oldPlugin.queryWorkouts({
          startDate: sleepStartISO,
          endDate: endISO,
          includeHeartRate: true,
          includeRoute: false,
          includeSteps: false,
        });

        if (sleepWorkouts?.workouts?.length > 0) {
          let totalSleepMinutes = 0;
          let earliestBedtime: Date | null = null;
          let latestWakeTime: Date | null = null;
          const sleepHeartRates: number[] = [];

          for (const workout of sleepWorkouts.workouts) {
            const wType = (workout.workoutType || '').toLowerCase();
            const isSleep = wType.includes('sleep') || wType === 'sleeping' || wType === 'inbed';

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
              const bottomTenPct = sleepHeartRates.slice(0, Math.max(1, Math.floor(sleepHeartRates.length * 0.1)));
              const restingFromSleep = Math.round(bottomTenPct.reduce((a, b) => a + b, 0) / bottomTenPct.length);
              if (!data.restingHeartRate || restingFromSleep < data.restingHeartRate) {
                data.restingHeartRate = restingFromSleep;
              }
            }
          }
        }
      } catch (e) {
        console.log('[HealthService] sleep workouts query failed:', e);
      }
    }

    console.log('[HealthService] Final data to sync:', JSON.stringify(data));
    return data;
  }

  async fetchTodayData(): Promise<HealthDataPayload | null> {
    return this.fetchDataForDate(getLocalDate());
  }

  async backfillMissedDays(): Promise<number> {
    await this.initialize();
    if (!this.capgoPlugin && !this.oldPlugin) return 0;

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
          if (dayData && (dayData.steps || dayData.sleepMinutes || dayData.caloriesBurned || dayData.avgHeartRate)) {
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

      this.backfillMissedDays().catch(e =>
        console.log('[HealthService] Background backfill error:', e)
      );

      return true;
    } catch (error) {
      console.error('Failed to sync health data to backend:', error);
      return false;
    }
  }

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
      console.error('Health permissions request failed:', error);
      return false;
    }

    try {
      await apiRequest('POST', '/api/health/connect', {
        connected: true,
        source,
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
        source: null,
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
