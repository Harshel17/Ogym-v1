import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Helper to get client's local date in YYYY-MM-DD format
function getClientLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useTrainerCycles() {
  return useQuery({
    queryKey: ['/api/trainer/cycles'],
  });
}

export function useTrainerMembers() {
  return useQuery({
    queryKey: ['/api/trainer/members'],
  });
}

export function useTrainerActivity() {
  return useQuery({
    queryKey: ['/api/trainer/activity'],
  });
}

export function useCreateCycle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { memberId: number; name: string; cycleLength: number; startDate: string; endDate: string; progressionMode?: "calendar" | "completion" }) => {
      return apiRequest("POST", "/api/trainer/cycles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/cycles'] });
      toast({ title: "Success", description: "Workout cycle created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create cycle", variant: "destructive" });
    },
  });
}

export function useAddWorkoutItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { cycleId: number; dayIndex: number; muscleType?: string; bodyPart?: string; exerciseName: string; sets: number; reps: number; weight?: string; orderIndex?: number }) => {
      const { cycleId, ...rest } = data;
      const response = await apiRequest("POST", `/api/trainer/cycles/${cycleId}/items`, rest);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/cycles'] });
      toast({ title: "Success", description: "Exercise added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to add exercise", variant: "destructive" });
    },
  });
}

export function useUpdateDayLabels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { cycleId: number; dayLabels: string[] }) => {
      const { cycleId, dayLabels } = data;
      return apiRequest("PATCH", `/api/trainer/cycles/${cycleId}/labels`, { dayLabels });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/cycles'] });
      toast({ title: "Saved", description: "Day names updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update day names", variant: "destructive" });
    },
  });
}

export function useUpdateRestDays() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { cycleId: number; restDays: number[] }) => {
      const { cycleId, restDays } = data;
      return apiRequest("PATCH", `/api/trainer/cycles/${cycleId}/rest-days`, { restDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/cycles'] });
      toast({ title: "Saved", description: "Rest days updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update rest days", variant: "destructive" });
    },
  });
}

export function useSwapRestDay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/workouts/rest-day-swap", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      toast({ title: "Swapped", description: "Tomorrow's workout is now available today" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to swap rest day", variant: "destructive" });
    },
  });
}

export function useUndoRestDaySwap() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (swapId: number) => {
      return apiRequest("DELETE", `/api/workouts/rest-day-swap/${swapId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      toast({ title: "Cancelled", description: "Rest day swap cancelled" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to cancel swap", variant: "destructive" });
    },
  });
}

export function useMemberCycle() {
  return useQuery({
    queryKey: ['/api/workouts/cycles/my'],
  });
}

export function useTodayWorkout() {
  return useQuery({
    queryKey: ['/api/workouts/today'],
  });
}

export function useMemberStats() {
  return useQuery({
    queryKey: ['/api/workouts/stats/my'],
  });
}

export function useMemberHistory() {
  return useQuery({
    queryKey: ['/api/workouts/history/my'],
  });
}

export function useCompleteWorkout(onAskToShare?: (focusLabel: string) => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { workoutItemId: number; actualSets?: number; actualReps?: number; actualWeight?: string }) => {
      // Include client's local date to ensure correct timezone handling
      const response = await apiRequest("POST", "/api/workouts/complete", {
        ...data,
        clientDate: getClientLocalDate()
      });
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/stats/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/daily-points'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/calendar/enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/summary'] });
      toast({ title: "Done!", description: "Workout completed and attendance marked" });
      
      // If server says to ask about sharing, trigger the callback
      if (result?.askToShare && onAskToShare) {
        onAskToShare(result.focusLabel || "Workout");
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to complete workout", variant: "destructive" });
    },
  });
}

export type ShareableAchievement = {
  type: string;
  label: string;
  metadata: Record<string, unknown>;
};

export function useShareWorkout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (achievement: ShareableAchievement) => {
      const response = await apiRequest("POST", "/api/feed/share-achievement", achievement);
      return response.json();
    },
    onSuccess: (_result, achievement) => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/posts'] });
      const messages: Record<string, string> = {
        workout_completed: "Your workout was posted to the gym feed",
        streak_milestone: "Your streak achievement was shared!",
        achievement: "Your achievement was shared with your gym!"
      };
      toast({ title: "Shared!", description: messages[achievement.type] || "Posted to feed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to share", variant: "destructive" });
    },
  });
}

export function useCompleteAllWorkouts(onAskToShare?: (achievements: ShareableAchievement[]) => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { workoutItemIds: number[] }) => {
      // Include client's local date to ensure correct timezone handling
      const response = await apiRequest("POST", "/api/workouts/complete-all", {
        ...data,
        clientDate: getClientLocalDate()
      });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/stats/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/daily-points'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/calendar/enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/summary'] });
      toast({ title: "All Done!", description: "All workouts completed and attendance marked" });
      
      // Trigger share popup if there are achievements to share
      if (result?.shareableAchievements?.length > 0 && onAskToShare) {
        onAskToShare(result.shareableAchievements);
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to complete workouts", variant: "destructive" });
    },
  });
}

export function useMemberProfile() {
  return useQuery({
    queryKey: ['/api/member/profile'],
  });
}

export function useMemberProgress() {
  return useQuery({
    queryKey: ['/api/member/progress'],
  });
}

export function useMemberRequests() {
  return useQuery({
    queryKey: ['/api/member/requests'],
  });
}

export function useTrainerRequests() {
  return useQuery({
    queryKey: ['/api/trainer/requests'],
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { type: string; message: string }) => {
      return apiRequest("POST", "/api/member/requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/member/requests'] });
      toast({ title: "Sent!", description: "Your request has been sent to your trainer" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to send request", variant: "destructive" });
    },
  });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { requestId: number; response: string }) => {
      return apiRequest("PATCH", `/api/trainer/requests/${data.requestId}/respond`, { response: data.response });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/requests'] });
      toast({ title: "Responded!", description: "Your response has been sent" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to respond", variant: "destructive" });
    },
  });
}

export type DailyPoints = {
  date: string;
  plannedPoints: number;
  earnedPoints: number;
  status: "REST" | "NOT_STARTED" | "IN_PROGRESS" | "DONE_FULL" | "DONE_PARTIAL";
  completionPercent: number;
  missedPoints: number;
  missedExercises: string[];
};

export function useDailyPoints(from?: string, to?: string) {
  const queryParams = new URLSearchParams();
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  const queryString = queryParams.toString();
  
  return useQuery<DailyPoints[]>({
    queryKey: ['/api/member/daily-points', from, to],
    queryFn: async () => {
      const url = queryString 
        ? `/api/member/daily-points?${queryString}`
        : '/api/member/daily-points';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch daily points');
      return res.json();
    },
  });
}

// Per-set workout plan hooks (trainer)
export type WorkoutPlanSet = {
  id: number;
  workoutItemId: number;
  setNumber: number;
  targetReps: number;
  targetWeight: string | null;
};

export function useWorkoutPlanSets(cycleId: number, itemId: number) {
  return useQuery<WorkoutPlanSet[]>({
    queryKey: ['/api/trainer/cycles', cycleId, 'items', itemId, 'sets'],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/cycles/${cycleId}/items/${itemId}/sets`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch plan sets');
      return res.json();
    },
    enabled: !!cycleId && !!itemId,
  });
}

export function useUpdateWorkoutPlanSets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { cycleId: number; itemId: number; sets: { setNumber: number; targetReps: number; targetWeight?: string | null }[] }) => {
      return apiRequest("POST", `/api/trainer/cycles/${data.cycleId}/items/${data.itemId}/sets`, { sets: data.sets });
    },
    onSuccess: (_result, data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/cycles'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trainer/cycles', data.cycleId, 'items', data.itemId, 'sets'] });
      toast({ title: "Saved", description: "Per-set targets updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update per-set targets", variant: "destructive" });
    },
  });
}

// Per-set workout logging hooks (member)
export type WorkoutLogSet = {
  id: number;
  logExerciseId: number;
  setNumber: number;
  targetReps: number | null;
  targetWeight: string | null;
  actualReps: number | null;
  actualWeight: string | null;
  completed: boolean;
};

export type WorkoutLogExercise = {
  id: number;
  workoutLogId: number;
  workoutItemId: number | null;
  exerciseName: string;
  muscleType: string | null;
  bodyPart: string | null;
  orderIndex: number | null;
  sets: WorkoutLogSet[];
};

export type WorkoutLog = {
  log: {
    id: number;
    gymId: number;
    memberId: number;
    cycleId: number | null;
    dayIndex: number;
    completedDate: string;
    completedAt: string | null;
  };
  exercises: WorkoutLogExercise[];
};

export function useMemberPlanSets(itemId: number) {
  return useQuery<WorkoutPlanSet[]>({
    queryKey: ['/api/workouts/items', itemId, 'plan-sets'],
    queryFn: async () => {
      const res = await fetch(`/api/workouts/items/${itemId}/plan-sets`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch plan sets');
      return res.json();
    },
    enabled: !!itemId,
  });
}

export function useWorkoutLog(date: string) {
  return useQuery<WorkoutLog | null>({
    queryKey: ['/api/workouts/log', date],
    queryFn: async () => {
      const res = await fetch(`/api/workouts/log/${date}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch workout log');
      return res.json();
    },
    enabled: !!date,
  });
}

export function useLogWorkoutSets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { 
      workoutItemId: number; 
      date: string;
      sets: { 
        setNumber: number; 
        targetReps?: number; 
        targetWeight?: string | null; 
        actualReps?: number; 
        actualWeight?: string | null;
        completed: boolean;
      }[] 
    }) => {
      const response = await apiRequest("POST", "/api/workouts/log-sets", data);
      return response.json();
    },
    onSuccess: (_result, data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/log', data.date] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/stats/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/daily-points'] });
      toast({ title: "Logged!", description: "Sets recorded successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to log sets", variant: "destructive" });
    },
  });
}

export function useUpdateLoggedSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { setId: number; actualReps?: number; actualWeight?: string | null; completed?: boolean }) => {
      const { setId, ...updateData } = data;
      const response = await apiRequest("PATCH", `/api/workouts/log-sets/${setId}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/log'] });
    },
  });
}
