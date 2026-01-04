import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
    mutationFn: async (data: { memberId: number; name: string; cycleLength: number; startDate: string; endDate: string }) => {
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
      return apiRequest("POST", `/api/trainer/cycles/${cycleId}/items`, rest);
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
      const response = await apiRequest("POST", "/api/workouts/complete", data);
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/stats/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/daily-points'] });
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

export function useShareWorkout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (focusLabel: string) => {
      const response = await apiRequest("POST", "/api/feed/share-workout", { focusLabel });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/posts'] });
      toast({ title: "Shared!", description: "Your workout was posted to the gym feed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to share workout", variant: "destructive" });
    },
  });
}

export function useCompleteAllWorkouts(onAskToShare?: (focusLabel: string) => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { workoutItemIds: number[] }) => {
      const response = await apiRequest("POST", "/api/workouts/complete-all", data);
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/stats/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/daily-points'] });
      toast({ title: "All Done!", description: "All workouts completed and attendance marked" });
      
      // Trigger share popup if user should be asked
      if (result?.askToShare && onAskToShare) {
        onAskToShare(result.focusLabel || "Workout");
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
