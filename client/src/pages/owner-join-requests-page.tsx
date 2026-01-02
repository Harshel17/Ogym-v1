import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Loader2, CheckCircle2, XCircle, Users, Clock } from "lucide-react";

type JoinRequest = {
  id: number;
  userId: number;
  gymId: number;
  status: string;
  userName: string;
  userRole: string;
  createdAt: string;
};

export default function OwnerJoinRequestsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<JoinRequest[]>({
    queryKey: ["/api/owner/join-requests"],
    enabled: user?.role === "owner" && !!user?.gymId
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/owner/join-requests/${requestId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trainers"] });
      toast({ title: "Request approved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to approve request", variant: "destructive" });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/owner/join-requests/${requestId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/join-requests"] });
      toast({ title: "Request rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject request", variant: "destructive" });
    }
  });

  if (user?.role !== "owner" || !user?.gymId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">Only gym owners can access this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Join Requests</h2>
        <p className="text-muted-foreground mt-1">
          Approve or reject requests from trainers and members to join your gym.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Pending Requests</h3>
            <p className="text-muted-foreground text-center mt-1">
              When someone requests to join your gym, you'll see them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} data-testid={`card-join-request-${request.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-lg">{request.userName}</span>
                      <Badge variant="secondary" className="capitalize">
                        {request.userRole}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Requested {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rejectMutation.mutate(request.id)}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      data-testid={`button-reject-${request.id}`}
                    >
                      {rejectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-1" />
                      )}
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      data-testid={`button-approve-${request.id}`}
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
