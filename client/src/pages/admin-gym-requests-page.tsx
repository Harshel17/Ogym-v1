import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Shield, Loader2, CheckCircle2, XCircle, Building2, Clock, Phone, MapPin, User } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type GymRequest = {
  id: number;
  ownerUserId: number;
  gymName: string;
  phone: string | null;
  address: string | null;
  pointOfContactName: string | null;
  pointOfContactEmail: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  ownerName: string;
};

export default function AdminGymRequestsPage() {
  const { toast } = useToast();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: requests = [], isLoading } = useQuery<GymRequest[]>({
    queryKey: ["/api/admin/gym-requests"]
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await apiRequest("POST", `/api/admin/gym-requests/${requestId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gym-requests"] });
      toast({ title: "Gym request approved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to approve request", variant: "destructive" });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: number; notes: string }) => {
      const res = await apiRequest("POST", `/api/admin/gym-requests/${requestId}/reject`, { adminNotes: notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gym-requests"] });
      setRejectDialogOpen(false);
      setRejectReason("");
      toast({ title: "Gym request rejected" });
    },
    onError: () => {
      toast({ title: "Failed to reject request", variant: "destructive" });
    }
  });

  const handleReject = (requestId: number) => {
    setSelectedRequestId(requestId);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (selectedRequestId) {
      rejectMutation.mutate({ requestId: selectedRequestId, notes: rejectReason });
    }
  };

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
        <h2 className="text-2xl font-bold font-display text-foreground">Gym Registration Requests</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve new gym registrations. (Admin function)
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Pending Requests</h3>
            <p className="text-muted-foreground text-center mt-1">
              There are no gym registration requests waiting for approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} data-testid={`card-gym-request-${request.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xl">{request.gymName}</span>
                      <Badge variant="secondary">Pending</Badge>
                    </div>
                    
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>Owner: {request.ownerName}</span>
                      </div>
                      {request.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span>{request.phone}</span>
                        </div>
                      )}
                      {request.address && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{request.address}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>Submitted {new Date(request.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleReject(request.id)}
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      data-testid={`button-reject-${request.id}`}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      data-testid={`button-approve-${request.id}`}
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
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

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Gym Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this gym registration request.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
