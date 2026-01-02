import { apiClient } from './client';

export interface WorkoutSummary {
  streak: number;
  totalWorkouts: number;
  last7DaysCount: number;
  thisMonthCount: number;
  calendarDays: { date: string; focusLabel: string }[];
}

export interface TodayWorkout {
  dayIndex: number;
  dayLabel: string;
  cycleName: string;
  message?: string;
  items?: {
    id: number;
    exerciseName: string;
    muscleType: string;
    sets: number;
    reps: number;
    weight: string | null;
    completed: boolean;
  }[];
}

export interface AttendanceRecord {
  id: number;
  date: string;
  status: string;
  verifiedMethod: string;
}

export const memberApi = {
  async getWorkoutSummary(): Promise<WorkoutSummary> {
    const response = await apiClient.get('/api/member/workout/summary');
    return response.data;
  },

  async getTodayWorkout(): Promise<TodayWorkout> {
    const response = await apiClient.get('/api/workouts/today');
    return response.data;
  },

  async completeExercise(data: {
    workoutItemId: number;
    actualSets?: number;
    actualReps?: number;
    actualWeight?: string;
  }): Promise<void> {
    await apiClient.post('/api/workouts/complete', data);
  },

  async getMyAttendance(): Promise<AttendanceRecord[]> {
    const response = await apiClient.get('/api/attendance/my');
    return response.data;
  },

  async checkin(gymCode: string): Promise<void> {
    await apiClient.post('/api/attendance/checkin', { gymCode });
  },

  async getMySubscription(): Promise<any> {
    const response = await apiClient.get('/api/member/subscription');
    return response.data;
  },

  async getAnnouncements(): Promise<any[]> {
    const response = await apiClient.get('/api/announcements');
    return response.data;
  },
};
