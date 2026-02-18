import { Capacitor } from '@capacitor/core';
import { apiRequest } from './queryClient';

export type HealthSource = 'apple_health' | 'google_fit';

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
  sleepMinutes?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
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
        'READ_WORKOUTS'
      ];

      await this.healthPlugin.requestHealthPermissions({ permissions });
      return true;
    } catch (error) {
      console.error('Failed to request health permissions:', error);
      return false;
    }
  }

  async fetchTodayData(): Promise<HealthDataPayload | null> {
    if (!this.healthPlugin) {
      await this.initialize();
    }
    
    if (!this.healthPlugin) {
      console.log('[HealthService] Plugin not available');
      return null;
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const source = this.getAvailableSource();
    if (!source) return null;

    try {
      const data: HealthDataPayload = {
        date: today.toISOString().split('T')[0],
        source,
      };

      console.log('[HealthService] Fetching today data...');

      // Fetch steps
      try {
        const stepsResult = await this.healthPlugin.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          dataType: 'steps',
          bucket: 'day'
        });
        console.log('[HealthService] Steps result:', JSON.stringify(stepsResult));
        if (stepsResult?.aggregatedData?.[0]?.value) {
          data.steps = Math.round(stepsResult.aggregatedData[0].value);
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch steps:', e);
      }

      // Fetch active calories
      try {
        const caloriesResult = await this.healthPlugin.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          dataType: 'active-calories',
          bucket: 'day'
        });
        console.log('[HealthService] Calories result:', JSON.stringify(caloriesResult));
        if (caloriesResult?.aggregatedData?.[0]?.value) {
          data.activeCalories = Math.round(caloriesResult.aggregatedData[0].value);
          data.caloriesBurned = data.activeCalories;
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch calories:', e);
      }

      // Fetch workouts to get heart rate, duration, and other data
      try {
        const workoutsResult = await this.healthPlugin.queryWorkouts({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          includeHeartRate: true,
          includeRoute: false,
          includeSteps: true
        });
        console.log('[HealthService] Workouts result:', JSON.stringify(workoutsResult));
        
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
            data.avgHeartRate = Math.round(heartRates.reduce((a, b) => a + b, 0) / heartRates.length);
            data.maxHeartRate = Math.round(Math.max(...heartRates));
          }
        }
      } catch (e) {
        console.log('[HealthService] Could not fetch workouts:', e);
      }

      console.log('[HealthService] Final data to sync:', JSON.stringify(data));
      return data;
    } catch (error) {
      console.error('[HealthService] Failed to fetch health data:', error);
      return null;
    }
  }

  async syncToBackend(): Promise<boolean> {
    const data = await this.fetchTodayData();
    if (!data) return false;

    try {
      await apiRequest('POST', '/api/health/sync', data);
      return true;
    } catch (error) {
      console.error('Failed to sync health data to backend:', error);
      return false;
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
