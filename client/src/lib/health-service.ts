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

    try {
      const { CapacitorHealth } = await import('capacitor-health');
      this.healthPlugin = CapacitorHealth;
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
      const result = await this.healthPlugin.isAvailable();
      return result.available;
    } catch (error) {
      console.error('Failed to check health permissions:', error);
      return false;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (!this.healthPlugin) {
      await this.initialize();
    }
    
    if (!this.healthPlugin) return false;

    try {
      const datatypes = [
        { read: ['steps', 'calories', 'activity', 'heart_rate', 'sleep'] }
      ];

      const result = await this.healthPlugin.requestAuthorization(datatypes);
      return result.authorized;
    } catch (error) {
      console.error('Failed to request health permissions:', error);
      return false;
    }
  }

  async fetchTodayData(): Promise<HealthDataPayload | null> {
    if (!this.healthPlugin) {
      await this.initialize();
    }
    
    if (!this.healthPlugin) return null;

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

      try {
        const stepsResult = await this.healthPlugin.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          dataType: 'steps',
          bucket: 'day'
        });
        if (stepsResult?.value) {
          data.steps = Math.round(stepsResult.value);
        }
      } catch (e) {
        console.log('Could not fetch steps:', e);
      }

      try {
        const caloriesResult = await this.healthPlugin.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          dataType: 'calories',
          bucket: 'day'
        });
        if (caloriesResult?.value) {
          data.caloriesBurned = Math.round(caloriesResult.value);
        }
      } catch (e) {
        console.log('Could not fetch calories:', e);
      }

      try {
        const activeResult = await this.healthPlugin.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          dataType: 'activity',
          bucket: 'day'
        });
        if (activeResult?.value) {
          data.activeMinutes = Math.round(activeResult.value);
        }
      } catch (e) {
        console.log('Could not fetch activity:', e);
      }

      try {
        const heartRateResult = await this.healthPlugin.query({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          dataType: 'heart_rate',
          limit: 100
        });
        if (heartRateResult?.data?.length > 0) {
          const values = heartRateResult.data.map((d: any) => d.value);
          data.avgHeartRate = Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length);
          data.maxHeartRate = Math.round(Math.max(...values));
          const restingValues = heartRateResult.data
            .filter((d: any) => d.sourceName?.toLowerCase().includes('resting') || d.value < 80)
            .map((d: any) => d.value);
          if (restingValues.length > 0) {
            data.restingHeartRate = Math.round(Math.min(...restingValues));
          }
        }
      } catch (e) {
        console.log('Could not fetch heart rate:', e);
      }

      try {
        const sleepResult = await this.healthPlugin.query({
          startDate: new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: endOfDay.toISOString(),
          dataType: 'sleep',
          limit: 50
        });
        if (sleepResult?.data?.length > 0) {
          let totalSleepMinutes = 0;
          for (const sleepEntry of sleepResult.data) {
            if (sleepEntry.startDate && sleepEntry.endDate) {
              const start = new Date(sleepEntry.startDate).getTime();
              const end = new Date(sleepEntry.endDate).getTime();
              totalSleepMinutes += (end - start) / (1000 * 60);
            }
          }
          data.sleepMinutes = Math.round(totalSleepMinutes);
          
          const sleepHours = totalSleepMinutes / 60;
          if (sleepHours < 5) data.sleepQuality = 'poor';
          else if (sleepHours < 6) data.sleepQuality = 'fair';
          else if (sleepHours < 8) data.sleepQuality = 'good';
          else data.sleepQuality = 'excellent';
        }
      } catch (e) {
        console.log('Could not fetch sleep:', e);
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch health data:', error);
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

    const authorized = await this.requestPermissions();
    if (!authorized) return false;

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
