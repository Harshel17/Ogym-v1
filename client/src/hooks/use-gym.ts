import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { InsertAttendance, InsertPayment } from "@shared/schema";
import { z } from "zod";

// === MEMBERS & TRAINERS ===

export function useMembers() {
  return useQuery({
    queryKey: [api.owner.getMembers.path],
    queryFn: async () => {
      const res = await fetch(api.owner.getMembers.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return api.owner.getMembers.responses[200].parse(await res.json());
    },
  });
}

export function useTrainers() {
  return useQuery({
    queryKey: [api.owner.getTrainers.path],
    queryFn: async () => {
      const res = await fetch(api.owner.getTrainers.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch trainers");
      return api.owner.getTrainers.responses[200].parse(await res.json());
    },
  });
}

export function useAssignTrainer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: z.infer<typeof api.owner.assignTrainer.input>) => {
      const res = await fetch(api.owner.assignTrainer.path, {
        method: api.owner.assignTrainer.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to assign trainer");
      return api.owner.assignTrainer.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.owner.getMembers.path] });
      toast({ title: "Success", description: "Trainer assigned successfully" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// === ATTENDANCE ===

export function useAttendance(filters?: { memberId?: number; date?: string }) {
  // Convert filters to URL params, removing undefined
  const params: Record<string, string> = {};
  if (filters?.memberId) params.memberId = filters.memberId.toString();
  if (filters?.date) params.date = filters.date;
  
  const queryString = new URLSearchParams(params).toString();
  const path = `${api.attendance.list.path}?${queryString}`;

  return useQuery({
    queryKey: [api.attendance.list.path, filters],
    queryFn: async () => {
      const res = await fetch(path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch attendance");
      return api.attendance.list.responses[200].parse(await res.json());
    },
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<InsertAttendance, "gymId" | "markedByUserId">) => {
      const res = await fetch(api.attendance.mark.path, {
        method: api.attendance.mark.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark attendance");
      return api.attendance.mark.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.attendance.list.path] });
      toast({ title: "Success", description: "Attendance marked" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}

// === PAYMENTS ===

export function usePayments(filters?: { memberId?: number; month?: string }) {
  const params: Record<string, string> = {};
  if (filters?.memberId) params.memberId = filters.memberId.toString();
  if (filters?.month) params.month = filters.month;

  const queryString = new URLSearchParams(params).toString();
  const path = `${api.payments.list.path}?${queryString}`;

  return useQuery({
    queryKey: [api.payments.list.path, filters],
    queryFn: async () => {
      const res = await fetch(path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return api.payments.list.responses[200].parse(await res.json());
    },
  });
}

export function useMarkPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<InsertPayment, "gymId" | "updatedByUserId">) => {
      const res = await fetch(api.payments.mark.path, {
        method: api.payments.mark.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to record payment");
      return api.payments.mark.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.payments.list.path] });
      toast({ title: "Success", description: "Payment recorded" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });
}
