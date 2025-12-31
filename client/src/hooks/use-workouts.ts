import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useTrainerCycles() {
  return useQuery({
    queryKey: [api.trainer.getCycles.path],
    queryFn: async () => {
      const res = await fetch(api.trainer.getCycles.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cycles");
      return api.trainer.getCycles.responses[200].parse(await res.json());
    },
  });
}

export function useCreateCycle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { memberId: number; name: string; startDate: string; endDate: string }) => {
      const res = await fetch(api.trainer.createCycle.path, {
        method: api.trainer.createCycle.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create cycle");
      return api.trainer.createCycle.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.trainer.getCycles.path] });
      toast({ title: "Success", description: "Workout cycle created" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useAddWorkout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { cycleId: number; dayOfWeek: number; exercise: string; sets: number; reps: number; weight?: string }) => {
      const res = await fetch(api.trainer.addWorkout.path, {
        method: api.trainer.addWorkout.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add workout");
      return api.trainer.addWorkout.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.trainer.getCycles.path] });
      toast({ title: "Success", description: "Exercise added" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

export function useMemberCycle() {
  return useQuery({
    queryKey: [api.member.getCycle.path],
    queryFn: async () => {
      const res = await fetch(api.member.getCycle.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cycle");
      return res.json();
    },
  });
}

export function useCompleteWorkout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { workoutId: number; date: string; completed: boolean }) => {
      const res = await fetch(api.member.completeWorkout.path, {
        method: api.member.completeWorkout.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark workout");
      return api.member.completeWorkout.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.member.getCycle.path] });
      toast({ title: "Done!", description: "Workout marked as complete" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
