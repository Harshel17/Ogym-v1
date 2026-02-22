import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { healthService, type HealthSource } from '@/lib/health-service';
import type { HealthData } from '@shared/schema';

export interface HealthConnectionStatus {
  connected: boolean;
  source: HealthSource | null;
}

export function useHealthStatus() {
  return useQuery<HealthConnectionStatus>({
    queryKey: ['/api/health/status'],
    staleTime: 1000 * 30,
  });
}

export function useHealthDataToday() {
  return useQuery<HealthData | null>({
    queryKey: ['/api/health/today'],
    staleTime: 1000 * 60 * 5,
  });
}

export function useHealthDataByDate(date: string) {
  return useQuery<HealthData | null>({
    queryKey: ['/api/health', date],
    enabled: !!date,
  });
}

export function useHealthDataRange(startDate: string, endDate: string) {
  return useQuery<HealthData[]>({
    queryKey: ['/api/health/range', startDate, endDate],
    enabled: !!startDate && !!endDate,
  });
}

export function useConnectHealth() {
  return useMutation({
    mutationFn: async () => {
      const success = await healthService.connect();
      if (!success) {
        throw new Error('Failed to connect health service');
      }
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/health/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/health/range'] });
    },
  });
}

export function useDisconnectHealth() {
  return useMutation({
    mutationFn: async () => {
      const success = await healthService.disconnect();
      if (!success) {
        throw new Error('Failed to disconnect health service');
      }
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/health/today'] });
    },
  });
}

export function useSyncHealth() {
  return useMutation({
    mutationFn: async () => {
      const success = await healthService.syncToBackend();
      if (!success) {
        throw new Error('Failed to sync health data');
      }
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/health/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/health/range'] });
      queryClient.invalidateQueries({ queryKey: ['/api/health/stats'] });
    },
  });
}

export function useHealthServiceInfo() {
  return {
    isAvailable: healthService.isAvailable(),
    availableSource: healthService.getAvailableSource(),
  };
}
