import { useQuery } from "@tanstack/react-query";

interface NotificationCounts {
  unreadAnnouncements: number;
  pendingRequests: number;
  pendingTransfers?: number;
  pendingJoinRequests?: number;
  hotLeadsCount?: number;
}

export function useNotificationCounts() {
  return useQuery<NotificationCounts>({
    queryKey: ["/api/notification-counts"],
    refetchInterval: 60000,
    staleTime: 30000,
  });
}
