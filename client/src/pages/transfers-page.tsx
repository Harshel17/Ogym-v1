import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowRight, Shield, Loader2, Check, X, ArrowRightLeft, User, Building2, History, LogIn, LogOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

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

type GymHistoryRecord = {
  id: number;
  memberId: number;
  memberName: string;
  memberRole: string;
  gymId: number;
  gymName: string;
  joinedAt: string;
  leftAt: string | null;
  destinationGymName: string | null;
};

export default function TransfersPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: requests = [], isLoading } = useQuery<TransferRequest[]>({
    queryKey: ["/api/owner/transfer-requests"]
  });

  const { data: gymHistory = [], isLoading: historyLoading } = useQuery<GymHistoryRecord[]>({
    queryKey: ["/api/owner/gym-history"]
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
        <h2 className="text-3xl font-bold font-display text-foreground">Transfers</h2>
        <p className="text-muted-foreground mt-1">
          Review transfer requests and member history.
        </p>
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="requests" data-testid="tab-requests">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Pending Requests ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-6">
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
                      <div className="flex items-center gap-4 text-sm flex-wrap">
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
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Member Join/Leave History
              </CardTitle>
              <CardDescription>Track when members joined or left your gym</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : gymHistory.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No transfer history yet.
                </div>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {gymHistory.map((record) => (
                      <div
                        key={record.id}
                        className="p-4 rounded-xl border bg-card"
                        data-testid={`card-history-${record.id}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                              {record.memberName?.slice(0, 2).toUpperCase() || '??'}
                            </div>
                            <div>
                              <p className="font-semibold">{record.memberName}</p>
                              <Badge variant="outline" className="capitalize text-xs">
                                {record.memberRole}
                              </Badge>
                            </div>
                          </div>
                          {record.leftAt ? (
                            <Badge variant="outline" className="text-red-500 border-red-500/30 shrink-0">
                              Left
                            </Badge>
                          ) : (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/30 shrink-0">
                              Active
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t text-sm">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Joined</p>
                            <div className="flex items-center gap-1.5 text-green-600">
                              <LogIn className="w-3.5 h-3.5" />
                              {format(new Date(record.joinedAt), "dd MMM yy")}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Left</p>
                            {record.leftAt ? (
                              <div className="flex items-center gap-1.5 text-red-500">
                                <LogOut className="w-3.5 h-3.5" />
                                {format(new Date(record.leftAt), "dd MMM yy")}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>
                        
                        {record.destinationGymName && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Transferred To</p>
                            <div className="flex items-center gap-1.5 text-sm">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                              {record.destinationGymName}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block rounded-md border border-border overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Left</TableHead>
                          <TableHead>Transferred To</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {gymHistory.map((record) => (
                          <TableRow key={record.id} data-testid={`row-history-${record.id}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                  {record.memberName?.slice(0, 2).toUpperCase() || '??'}
                                </div>
                                {record.memberName}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {record.memberRole}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-green-600">
                                <LogIn className="w-3.5 h-3.5" />
                                {format(new Date(record.joinedAt), "dd MMM yyyy")}
                              </div>
                            </TableCell>
                            <TableCell>
                              {record.leftAt ? (
                                <div className="flex items-center gap-1.5 text-red-500">
                                  <LogOut className="w-3.5 h-3.5" />
                                  {format(new Date(record.leftAt), "dd MMM yyyy")}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.destinationGymName ? (
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                  {record.destinationGymName}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.leftAt ? (
                                <Badge variant="outline" className="text-red-500 border-red-500/30">
                                  Left
                                </Badge>
                              ) : (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                                  Active
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
