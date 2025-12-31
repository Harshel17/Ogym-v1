import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// === MEMBERS & TRAINERS ===

export function useMembers() {
  return useQuery({
    queryKey: ['/api/owner/members'],
  });
}

export function useTrainers() {
  return useQuery({
    queryKey: ['/api/owner/trainers'],
  });
}

export function useAssignments() {
  return useQuery({
    queryKey: ['/api/owner/assignments'],
  });
}

export function useAssignTrainer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { trainerId: number; memberId: number }) => {
      return apiRequest("POST", "/api/owner/assign-trainer", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/owner/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/owner/assignments'] });
      toast({ title: "Success", description: "Trainer assigned successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to assign trainer", variant: "destructive" });
    },
  });
}

export function useQRData() {
  return useQuery({
    queryKey: ['/api/owner/qr-data'],
  });
}

// === ATTENDANCE ===

export function useAttendance() {
  return useQuery({
    queryKey: ['/api/attendance/gym'],
  });
}

export function useMemberAttendance() {
  return useQuery({
    queryKey: ['/api/attendance/my'],
  });
}

export function useCheckin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { gym_code: string }) => {
      return apiRequest("POST", "/api/attendance/checkin", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      toast({ title: "Checked In!", description: "Your attendance has been recorded" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Check-in failed", variant: "destructive" });
    },
  });
}

// === PAYMENTS ===

export function usePayments() {
  return useQuery({
    queryKey: ['/api/payments/gym'],
  });
}

export function useMemberPayments() {
  return useQuery({
    queryKey: ['/api/payments/my'],
  });
}

export function useMarkPayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { memberId: number; month: string; amountDue: number; amountPaid: number; status: 'paid' | 'unpaid' | 'partial'; note?: string }) => {
      return apiRequest("POST", "/api/payments/mark", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments/gym'] });
      toast({ title: "Success", description: "Payment recorded" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to record payment", variant: "destructive" });
    },
  });
}
