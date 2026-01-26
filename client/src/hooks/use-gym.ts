import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// === MEMBERS & TRAINERS ===

export function useMembers() {
  return useQuery({
    queryKey: ['/api/owner/members'],
  });
}

export function useMembersDetails() {
  return useQuery({
    queryKey: ['/api/owner/members-details'],
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
    mutationFn: async (data: { 
      trainerId?: number | null; 
      memberId: number; 
      trainingMode: 'trainer_led' | 'self_guided';
    }) => {
      return apiRequest("POST", "/api/owner/assign-trainer", data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/owner/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/owner/members-details'] });
      queryClient.invalidateQueries({ queryKey: ['/api/owner/assignments'] });
      toast({ 
        title: "Success", 
        description: variables.trainingMode === 'self_guided' 
          ? "Member set to self-guided mode" 
          : "Trainer assigned successfully"
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update training mode", variant: "destructive" });
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

// === TRAINING MODE ===

export function useTrainingMode() {
  return useQuery<{ trainingMode: 'trainer_led' | 'self_guided' }>({
    queryKey: ['/api/member/training-mode'],
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
