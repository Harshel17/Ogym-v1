import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Shield, LogOut, Building2, Users, CreditCard, Check, X, Loader2, 
  Clock, CheckCircle, XCircle, Calendar
} from "lucide-react";

function getAdminToken() {
  return localStorage.getItem("adminToken");
}

async function adminFetch(url: string, options: RequestInit = {}) {
  const token = getAdminToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin";
    }
    throw new Error(await res.text());
  }
  return res.json();
}

type GymRequest = {
  id: number;
  gymName: string;
  ownerUserId: number;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  ownerName: string;
  ownerEmail: string | null;
};

type GymDetails = {
  id: number;
  name: string;
  code: string;
  createdAt: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  subscriptionStatus: string | null;
  planType: string | null;
  validUntil: string | null;
};

type GymSubscription = {
  id: number;
  gymId: number;
  planType: string;
  amountPaid: number;
  paymentStatus: string;
  paidOn: string | null;
  validUntil: string | null;
  notes: string | null;
  gymName: string;
};

function GymRequestsTab() {
  const { toast } = useToast();
  const [selectedRequest, setSelectedRequest] = useState<GymRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: requests = [], isLoading } = useQuery<GymRequest[]>({
    queryKey: ["/api/admin/all-gym-requests"],
    queryFn: () => adminFetch("/api/admin/all-gym-requests"),
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => adminFetch(`/api/admin/gym-requests/${requestId}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-gym-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-gyms"] });
      toast({ title: "Request approved", description: "Gym has been created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to approve request", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, adminNotes }: { requestId: number; adminNotes: string }) =>
      adminFetch(`/api/admin/gym-requests/${requestId}/reject`, { method: "POST", body: JSON.stringify({ adminNotes }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-gym-requests"] });
      setShowRejectDialog(false);
      setRejectNotes("");
      toast({ title: "Request rejected" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reject request", variant: "destructive" });
    },
  });

  const handleReject = () => {
    if (selectedRequest) {
      rejectMutation.mutate({ requestId: selectedRequest.id, adminNotes: rejectNotes });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Gym Registration Requests</h2>
        <Badge variant="outline">{requests.filter(r => r.status === "pending").length} pending</Badge>
      </div>
      
      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No gym requests found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card key={request.id} data-testid={`card-gym-request-${request.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{request.gymName}</h3>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Owner: {request.ownerName} {request.ownerEmail && `(${request.ownerEmail})`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted: {format(new Date(request.createdAt), "PPp")}
                    </p>
                    {request.adminNotes && (
                      <p className="text-sm mt-2 p-2 bg-muted rounded-md">{request.adminNotes}</p>
                    )}
                  </div>
                  {request.status === "pending" && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        data-testid={`button-approve-${request.id}`}
                        onClick={() => approveMutation.mutate(request.id)}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-reject-${request.id}`}
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowRejectDialog(true);
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Gym Request</DialogTitle>
            <DialogDescription>
              Rejecting "{selectedRequest?.gymName}" by {selectedRequest?.ownerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              data-testid="input-reject-notes"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Enter reason for rejection..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-reject"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GymsTab() {
  const { data: gyms = [], isLoading } = useQuery<GymDetails[]>({
    queryKey: ["/api/admin/all-gyms"],
    queryFn: () => adminFetch("/api/admin/all-gyms"),
  });

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">All Gyms</h2>
        <Badge variant="outline">{gyms.length} gyms</Badge>
      </div>

      {gyms.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No gyms registered yet
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gyms.map((gym) => (
            <Card key={gym.id} data-testid={`card-gym-${gym.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{gym.name}</CardTitle>
                <CardDescription>Code: {gym.code}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Owner:</span>{" "}
                  {gym.ownerName || "N/A"}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {gym.ownerEmail || "N/A"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Subscription:</span>
                  {gym.subscriptionStatus ? (
                    <Badge variant={gym.subscriptionStatus === "paid" ? "default" : "secondary"}>
                      {gym.subscriptionStatus}
                    </Badge>
                  ) : (
                    <Badge variant="outline">No subscription</Badge>
                  )}
                </div>
                {gym.planType && (
                  <p>
                    <span className="text-muted-foreground">Plan:</span>{" "}
                    {gym.planType.replace("_", " ")}
                  </p>
                )}
                {gym.validUntil && (
                  <p>
                    <span className="text-muted-foreground">Valid until:</span>{" "}
                    {format(new Date(gym.validUntil), "PP")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionsTab() {
  const { toast } = useToast();
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({
    planType: "1_month",
    amountPaid: "",
    paymentStatus: "pending",
    validUntil: "",
    notes: "",
  });

  const { data: gyms = [] } = useQuery<GymDetails[]>({
    queryKey: ["/api/admin/all-gyms"],
    queryFn: () => adminFetch("/api/admin/all-gyms"),
  });

  const { data: subscriptions = [], isLoading } = useQuery<GymSubscription[]>({
    queryKey: ["/api/admin/gym-subscriptions"],
    queryFn: () => adminFetch("/api/admin/gym-subscriptions"),
  });

  const upsertMutation = useMutation({
    mutationFn: ({ gymId, data }: { gymId: number; data: object }) =>
      adminFetch(`/api/admin/gym-subscriptions/${gymId}`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/gym-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-gyms"] });
      setShowEditDialog(false);
      toast({ title: "Subscription updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update subscription", variant: "destructive" });
    },
  });

  const handleEditGym = (gymId: number) => {
    const existing = subscriptions.find(s => s.gymId === gymId);
    if (existing) {
      setFormData({
        planType: existing.planType,
        amountPaid: String(existing.amountPaid / 100),
        paymentStatus: existing.paymentStatus,
        validUntil: existing.validUntil ? existing.validUntil.split("T")[0] : "",
        notes: existing.notes || "",
      });
    } else {
      setFormData({
        planType: "1_month",
        amountPaid: "",
        paymentStatus: "pending",
        validUntil: "",
        notes: "",
      });
    }
    setSelectedGymId(gymId);
    setShowEditDialog(true);
  };

  const handleSave = () => {
    if (selectedGymId) {
      upsertMutation.mutate({
        gymId: selectedGymId,
        data: {
          planType: formData.planType,
          amountPaid: Math.round(parseFloat(formData.amountPaid || "0") * 100),
          paymentStatus: formData.paymentStatus,
          validUntil: formData.validUntil || null,
          notes: formData.notes || null,
        },
      });
    }
  };

  const gymsWithoutSubscription = gyms.filter(g => !subscriptions.some(s => s.gymId === g.id));

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Gym Subscriptions</h2>
        <Badge variant="outline">{subscriptions.length} active</Badge>
      </div>

      {gymsWithoutSubscription.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gyms without subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {gymsWithoutSubscription.map((gym) => (
                <Button
                  key={gym.id}
                  variant="outline"
                  size="sm"
                  data-testid={`button-add-subscription-${gym.id}`}
                  onClick={() => handleEditGym(gym.id)}
                >
                  <CreditCard className="w-4 h-4 mr-1" />
                  {gym.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {subscriptions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No subscriptions yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <Card key={sub.id} data-testid={`card-subscription-${sub.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{sub.gymName}</h3>
                      <Badge variant={sub.paymentStatus === "paid" ? "default" : "secondary"}>
                        {sub.paymentStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Plan: {sub.planType.replace("_", " ")} | Amount: INR {(sub.amountPaid / 100).toFixed(2)}
                    </p>
                    {sub.validUntil && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Valid until: {format(new Date(sub.validUntil), "PP")}
                      </p>
                    )}
                    {sub.notes && (
                      <p className="text-sm mt-2 p-2 bg-muted rounded-md">{sub.notes}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-edit-subscription-${sub.gymId}`}
                    onClick={() => handleEditGym(sub.gymId)}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {subscriptions.some(s => s.gymId === selectedGymId) ? "Edit" : "Add"} Subscription
            </DialogTitle>
            <DialogDescription>
              {gyms.find(g => g.id === selectedGymId)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Type</Label>
              <Select value={formData.planType} onValueChange={(v) => setFormData({ ...formData, planType: v })}>
                <SelectTrigger data-testid="select-plan-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1_month">1 Month</SelectItem>
                  <SelectItem value="3_month">3 Months</SelectItem>
                  <SelectItem value="6_month">6 Months</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount Paid (INR)</Label>
              <Input
                data-testid="input-amount-paid"
                type="number"
                value={formData.amountPaid}
                onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={formData.paymentStatus} onValueChange={(v) => setFormData({ ...formData, paymentStatus: v })}>
                <SelectTrigger data-testid="select-payment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Input
                data-testid="input-valid-until"
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                data-testid="input-subscription-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button
              data-testid="button-save-subscription"
              onClick={handleSave}
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setLocation("/admin");
      return;
    }

    adminFetch("/api/admin/me")
      .then(() => {
        setIsAuthenticated(true);
        setIsLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("adminToken");
        setLocation("/admin");
      });
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    toast({ title: "Logged out" });
    setLocation("/admin");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">OGym Admin</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-admin-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="requests" className="flex items-center gap-2" data-testid="tab-gym-requests">
              <Clock className="h-4 w-4" />
              Gym Requests
            </TabsTrigger>
            <TabsTrigger value="gyms" className="flex items-center gap-2" data-testid="tab-gyms">
              <Building2 className="h-4 w-4" />
              Gyms
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="flex items-center gap-2" data-testid="tab-subscriptions">
              <CreditCard className="h-4 w-4" />
              Subscriptions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <GymRequestsTab />
          </TabsContent>

          <TabsContent value="gyms">
            <GymsTab />
          </TabsContent>

          <TabsContent value="subscriptions">
            <SubscriptionsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
