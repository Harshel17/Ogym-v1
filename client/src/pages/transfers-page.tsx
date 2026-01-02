import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowRight, Shield, Loader2, Check, X, ArrowRightLeft, User, Building2 } from "lucide-react";

type TransferRequest = {
  id: number;
  memberId: number;
  fromGymId: number;
  toGymId: number;
  status: string;
  approvedByFromOwner: boolean;
  approvedByToOwner: boolean;
  memberName: string;
  fromGymName: string;
  toGymName: string;
  createdAt: string;
};

export default function TransfersPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<TransferRequest[]>({
    queryKey: ["/api/owner/transfer-requests"]
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/owner/transfer-requests/${requestId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/transfer-requests"] });
      toast({ title: "Transfer approved" });
    },
    onError: () => {
      toast({ title: "Failed to approve transfer", variant: "destructive" });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/owner/transfer-requests/${requestId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/transfer-requests"] });
      toast({ title: "Transfer rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject transfer", variant: "destructive" });
    }
  });

  if (user?.role !== "owner") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Owners Only</h2>
        <p className="text-muted-foreground">This page is only for gym owners.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Transfer Requests</h2>
        <p className="text-muted-foreground mt-1">
          Review member transfer requests. Both source and destination gym owners must approve.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowRightLeft className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No Pending Transfers</h3>
            <p className="text-muted-foreground mt-2">There are no transfer requests to review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => {
            const isFromGym = request.fromGymId === user.gymId;
            const isToGym = request.toGymId === user.gymId;
            const hasApproved = isFromGym ? request.approvedByFromOwner : request.approvedByToOwner;
            const otherApproved = isFromGym ? request.approvedByToOwner : request.approvedByFromOwner;

            return (
              <Card key={request.id} data-testid={`card-transfer-${request.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-base">{request.memberName}</CardTitle>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <Building2 className="w-3 h-3" />
                        {request.fromGymName}
                        <ArrowRight className="w-4 h-4" />
                        <Building2 className="w-3 h-3" />
                        {request.toGymName}
                      </CardDescription>
                    </div>
                    <Badge variant={request.status === "pending" ? "secondary" : "default"}>
                      {request.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Source:</span>
                      {request.approvedByFromOwner ? (
                        <Badge variant="default" className="bg-green-600">
                          <Check className="w-3 h-3 mr-1" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Destination:</span>
                      {request.approvedByToOwner ? (
                        <Badge variant="default" className="bg-green-600">
                          <Check className="w-3 h-3 mr-1" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                  </div>

                  {!hasApproved && (
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => approveMutation.mutate(request.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-approve-${request.id}`}
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Check className="w-4 h-4 mr-2" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => rejectMutation.mutate(request.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        data-testid={`button-reject-${request.id}`}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {hasApproved && !otherApproved && (
                    <p className="text-sm text-muted-foreground">
                      Waiting for the other gym owner to approve...
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Requested {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
