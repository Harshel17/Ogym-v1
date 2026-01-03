import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export type FeedPost = {
  id: number;
  gymId: number;
  userId: number;
  type: "workout_complete" | "streak_milestone" | "new_member" | "achievement" | "manual";
  content: string | null;
  metadata: string | null;
  isVisible: boolean | null;
  createdAt: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
  reactions: {
    id: number;
    postId: number;
    userId: number;
    reactionType: string;
  }[];
  commentCount: number;
};

export type FeedComment = {
  id: number;
  postId: number;
  userId: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
  };
};

export function useFeed() {
  return useQuery<FeedPost[]>({
    queryKey: ['/api/feed'],
  });
}

export function useFeedComments(postId: number) {
  return useQuery<FeedComment[]>({
    queryKey: ['/api/feed', postId, 'comments'],
    queryFn: async () => {
      const res = await fetch(`/api/feed/${postId}/comments`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json();
    },
    enabled: postId > 0,
  });
}

export function useAddReaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ postId, reactionType }: { postId: number; reactionType: string }) => {
      return apiRequest("POST", `/api/feed/${postId}/react`, { reactionType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
    },
  });
}

export function useRemoveReaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postId: number) => {
      return apiRequest("DELETE", `/api/feed/${postId}/react`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
    },
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      return apiRequest("POST", `/api/feed/${postId}/comments`, { content });
    },
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      queryClient.invalidateQueries({ queryKey: ['/api/feed', postId, 'comments'] });
      toast({ title: "Comment added" });
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });
}

export function useHidePost() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (postId: number) => {
      return apiRequest("PATCH", `/api/feed/${postId}/hide`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feed'] });
      toast({ title: "Post hidden" });
    },
  });
}

export type Tournament = {
  id: number;
  gymId: number;
  createdByUserId: number;
  name: string;
  description: string | null;
  metricType: "workout_count" | "streak_days" | "total_exercises" | "attendance_days";
  startDate: string;
  endDate: string;
  status: "upcoming" | "active" | "completed" | "cancelled";
  prizeDescription: string | null;
  maxParticipants: number | null;
  isPublic: boolean | null;
  createdAt: string;
  isParticipating?: boolean;
  leaderboard?: { rank: number; username: string; score: number; userId: number }[];
};

export function useTournaments() {
  return useQuery<Tournament[]>({
    queryKey: ['/api/tournaments'],
  });
}

export function useTournament(id: number) {
  return useQuery<Tournament & { leaderboard: { rank: number; username: string; score: number; userId: number }[]; isParticipating: boolean }>({
    queryKey: ['/api/tournaments', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tournament');
      return res.json();
    },
    enabled: id > 0,
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      metricType: string;
      startDate: string;
      endDate: string;
      prizeDescription?: string;
      maxParticipants?: number;
    }) => {
      return apiRequest("POST", "/api/tournaments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      toast({ title: "Tournament created" });
    },
    onError: () => {
      toast({ title: "Failed to create tournament", variant: "destructive" });
    },
  });
}

export function useJoinTournament() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (tournamentId: number) => {
      return apiRequest("POST", `/api/tournaments/${tournamentId}/join`);
    },
    onSuccess: (_, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId] });
      toast({ title: "Joined tournament!" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Failed to join", variant: "destructive" });
    },
  });
}

export function useLeaveTournament() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (tournamentId: number) => {
      return apiRequest("DELETE", `/api/tournaments/${tournamentId}/leave`);
    },
    onSuccess: (_, tournamentId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId] });
      toast({ title: "Left tournament" });
    },
  });
}
