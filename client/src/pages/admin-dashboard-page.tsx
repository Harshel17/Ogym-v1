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
  Clock, CheckCircle, XCircle, Calendar, Search, ArrowLeft, UserCheck, Dumbbell,
  HelpCircle, MessageSquare, AlertCircle, Send, FileText, History, Edit, Key, ArrowRightLeft, Crown
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  phone: string | null;
  address: string | null;
  pointOfContactName: string | null;
  pointOfContactEmail: string | null;
  city: string;
  state: string;
  country: string;
  gymSize: string;
  trainerCount: number;
  preferredStart: string;
  referralSource: string;
  referralOtherText: string | null;
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
  city: string | null;
  state: string | null;
  country: string | null;
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
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
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
      setShowDetailsDialog(false);
      toast({ title: "Approved successfully", description: "Gym has been created" });
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
      setShowDetailsDialog(false);
      setRejectNotes("");
      toast({ title: "Rejected successfully" });
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
  
  const formatGymSize = (size: string) => {
    const sizes: Record<string, string> = { "0-50": "0-50 members", "51-150": "51-150 members", "151-300": "151-300 members", "300+": "300+ members" };
    return sizes[size] || size;
  };
  
  const formatPreferredStart = (start: string) => {
    const starts: Record<string, string> = { immediately: "Immediately", next_week: "Next week", next_month: "Next month" };
    return starts[start] || start;
  };
  
  const formatReferralSource = (source: string, otherText: string | null) => {
    const sources: Record<string, string> = { friend: "Friend", instagram: "Instagram", direct_visit: "Direct visit", other: "Other" };
    return source === "other" && otherText ? `Other: ${otherText}` : sources[source] || source;
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
                      {request.city}, {request.state}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted: {format(new Date(request.createdAt), "PPp")}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid={`button-view-details-${request.id}`}
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowDetailsDialog(true);
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        setShowDetailsDialog(open);
        if (!open) setSelectedRequest(null);
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle>{selectedRequest.gymName}</DialogTitle>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <DialogDescription>Full request details</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Owner</p>
                    <p className="font-medium">{selectedRequest.ownerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Owner Email</p>
                    <p className="font-medium">{selectedRequest.ownerEmail || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedRequest.phone || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{selectedRequest.address || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Point of Contact</p>
                    <p className="font-medium">{selectedRequest.pointOfContactName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">POC Email</p>
                    <p className="font-medium">{selectedRequest.pointOfContactEmail || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">City</p>
                    <p className="font-medium">{selectedRequest.city}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">State</p>
                    <p className="font-medium">{selectedRequest.state}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Country</p>
                    <p className="font-medium">{selectedRequest.country}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Gym Size</p>
                    <p className="font-medium">{formatGymSize(selectedRequest.gymSize)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Number of Trainers</p>
                    <p className="font-medium">{selectedRequest.trainerCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Preferred Start</p>
                    <p className="font-medium">{formatPreferredStart(selectedRequest.preferredStart)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">How did you hear about OGym?</p>
                    <p className="font-medium">{formatReferralSource(selectedRequest.referralSource, selectedRequest.referralOtherText)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Submitted</p>
                    <p className="font-medium">{format(new Date(selectedRequest.createdAt), "PPp")}</p>
                  </div>
                  {selectedRequest.reviewedAt && (
                    <div>
                      <p className="text-muted-foreground">Reviewed</p>
                      <p className="font-medium">{format(new Date(selectedRequest.reviewedAt), "PPp")}</p>
                    </div>
                  )}
                </div>
                
                {selectedRequest.adminNotes && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">Admin Notes</p>
                    <p className="text-sm">{selectedRequest.adminNotes}</p>
                  </div>
                )}
              </div>
              
              {selectedRequest.status === "pending" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    data-testid="button-reject-from-details"
                    onClick={() => {
                      setShowRejectDialog(true);
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    data-testid="button-approve-from-details"
                    onClick={() => approveMutation.mutate(selectedRequest.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

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

type GymProfile = {
  gym: { id: number; name: string; code: string };
  owner: { id: number; username: string; email: string | null; phone: string | null; publicId: string | null; status: string } | null;
  members: { id: number; username: string; email: string | null; phone: string | null; publicId: string | null; status: string }[];
  trainers: { id: number; username: string; email: string | null; phone: string | null; publicId: string | null; status: string }[];
  memberCount: number;
  trainerCount: number;
};

type SelectedUser = {
  id: number;
  username: string;
  email: string | null;
  phone: string | null;
  publicId: string | null;
  status: string;
  role: "owner" | "trainer" | "member";
};

function GymsTab() {
  const { toast } = useToast();
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showList, setShowList] = useState<"members" | "trainers" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [showMoveGymDialog, setShowMoveGymDialog] = useState(false);
  
  const [editForm, setEditForm] = useState({ username: "", email: "", phone: "" });
  const [resetPasswordForm, setResetPasswordForm] = useState({ newPassword: "", reason: "" });
  const [moveGymForm, setMoveGymForm] = useState({ targetGymId: "", reason: "" });
  const [editReason, setEditReason] = useState("");
  
  const [nameFilter, setNameFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{ name?: string; city?: string; state?: string }>({});

  const { data: gyms = [], isLoading, refetch } = useQuery<GymDetails[]>({
    queryKey: ["/api/admin/all-gyms", appliedFilters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (appliedFilters.name) params.append("name", appliedFilters.name);
      if (appliedFilters.city) params.append("city", appliedFilters.city);
      if (appliedFilters.state) params.append("state", appliedFilters.state);
      const query = params.toString();
      return adminFetch(`/api/admin/all-gyms${query ? `?${query}` : ""}`);
    },
  });

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery<GymProfile>({
    queryKey: ["/api/admin/gyms", selectedGymId, "profile"],
    queryFn: () => adminFetch(`/api/admin/gyms/${selectedGymId}/profile`),
    enabled: !!selectedGymId && showProfileDialog,
  });

  const editUserMutation = useMutation({
    mutationFn: (data: { userId: number; updates: { username?: string; email?: string; phone?: string }; reason: string }) =>
      adminFetch(`/api/admin/users/${data.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data.updates, reason: data.reason }),
      }),
    onSuccess: () => {
      toast({ title: "User updated successfully" });
      setShowEditDialog(false);
      refetchProfile();
    },
    onError: (error: Error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: { userId: number; newPassword: string; reason: string }) =>
      adminFetch(`/api/admin/users/${data.userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: data.newPassword, reason: data.reason }),
      }),
    onSuccess: () => {
      toast({ title: "Password reset successfully" });
      setShowResetPasswordDialog(false);
      setResetPasswordForm({ newPassword: "", reason: "" });
    },
    onError: (error: Error) => toast({ title: "Reset failed", description: error.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (data: { userId: number; status: string; reason: string }) =>
      adminFetch(`/api/admin/users/${data.userId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: data.status, reason: data.reason }),
      }),
    onSuccess: () => {
      toast({ title: "Status updated successfully" });
      refetchProfile();
    },
    onError: (error: Error) => toast({ title: "Status update failed", description: error.message, variant: "destructive" }),
  });

  const moveGymMutation = useMutation({
    mutationFn: (data: { userId: number; targetGymId: number; reason: string }) =>
      adminFetch(`/api/admin/users/${data.userId}/move-gym`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetGymId: data.targetGymId, reason: data.reason }),
      }),
    onSuccess: () => {
      toast({ title: "User moved successfully" });
      setShowMoveGymDialog(false);
      setMoveGymForm({ targetGymId: "", reason: "" });
      refetchProfile();
    },
    onError: (error: Error) => toast({ title: "Move failed", description: error.message, variant: "destructive" }),
  });

  const openEditDialog = (user: SelectedUser) => {
    setSelectedUser(user);
    setEditForm({ username: user.username, email: user.email || "", phone: user.phone || "" });
    setEditReason("");
    setShowEditDialog(true);
  };

  const openResetPasswordDialog = (user: SelectedUser) => {
    setSelectedUser(user);
    setResetPasswordForm({ newPassword: "", reason: "" });
    setShowResetPasswordDialog(true);
  };

  const openMoveGymDialog = (user: SelectedUser) => {
    setSelectedUser(user);
    setMoveGymForm({ targetGymId: "", reason: "" });
    setShowMoveGymDialog(true);
  };

  const handleEditSubmit = () => {
    if (!selectedUser || !editReason.trim()) return;
    editUserMutation.mutate({
      userId: selectedUser.id,
      updates: { username: editForm.username, email: editForm.email || undefined, phone: editForm.phone || undefined },
      reason: editReason,
    });
  };

  const handleResetPassword = () => {
    if (!selectedUser || !resetPasswordForm.newPassword || !resetPasswordForm.reason.trim()) return;
    resetPasswordMutation.mutate({
      userId: selectedUser.id,
      newPassword: resetPasswordForm.newPassword,
      reason: resetPasswordForm.reason,
    });
  };

  const handleMoveGym = () => {
    if (!selectedUser || !moveGymForm.targetGymId || !moveGymForm.reason.trim()) return;
    moveGymMutation.mutate({
      userId: selectedUser.id,
      targetGymId: parseInt(moveGymForm.targetGymId),
      reason: moveGymForm.reason,
    });
  };

  const handleToggleStatus = (user: SelectedUser) => {
    const newStatus = user.status === "active" ? "suspended" : "active";
    const reason = prompt(`Reason for ${newStatus === "suspended" ? "suspending" : "activating"} user ${user.username}:`);
    if (reason) {
      toggleStatusMutation.mutate({ userId: user.id, status: newStatus, reason });
    }
  };

  const handleGymClick = (gymId: number) => {
    setSelectedGymId(gymId);
    setShowList(null);
    setSearchQuery("");
    setShowProfileDialog(true);
  };
  
  const handleApplyFilters = () => {
    setAppliedFilters({ name: nameFilter, city: cityFilter, state: stateFilter });
  };
  
  const handleClearFilters = () => {
    setNameFilter("");
    setCityFilter("");
    setStateFilter("");
    setAppliedFilters({});
  };

  const filteredUsers = showList && profile 
    ? (showList === "members" ? profile.members : profile.trainers).filter(user =>
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (user.publicId?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">All Gyms</h2>
        <Badge variant="outline">{gyms.length} gyms</Badge>
      </div>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="name-filter" className="text-sm">Search by gym name</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name-filter"
                  data-testid="input-filter-name"
                  placeholder="Search gym name..."
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="min-w-[150px]">
              <Label htmlFor="city-filter" className="text-sm">City</Label>
              <Input
                id="city-filter"
                data-testid="input-filter-city"
                placeholder="City"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="min-w-[150px]">
              <Label htmlFor="state-filter" className="text-sm">State</Label>
              <Input
                id="state-filter"
                data-testid="input-filter-state"
                placeholder="State"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button data-testid="button-apply-filters" onClick={handleApplyFilters}>
                Apply Filters
              </Button>
              <Button variant="outline" data-testid="button-clear-filters" onClick={handleClearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {gyms.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {Object.values(appliedFilters).some(Boolean) ? "No gyms match your filters" : "No gyms registered yet"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gyms.map((gym) => (
            <Card 
              key={gym.id} 
              data-testid={`card-gym-${gym.id}`}
              className="cursor-pointer hover-elevate"
              onClick={() => handleGymClick(gym.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{gym.name}</CardTitle>
                <CardDescription>Code: {gym.code}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(gym.city || gym.state) && (
                  <p>
                    <span className="text-muted-foreground">Location:</span>{" "}
                    {[gym.city, gym.state].filter(Boolean).join(", ")}
                  </p>
                )}
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

      <Dialog open={showProfileDialog} onOpenChange={(open) => {
        setShowProfileDialog(open);
        if (!open) {
          setShowList(null);
          setSearchQuery("");
        }
      }}>
        <DialogContent className="max-w-lg">
          {profileLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : profile ? (
            <>
              {showList === null ? (
                <>
                  <DialogHeader className="pb-4 border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl">{profile.gym.name}</DialogTitle>
                        <DialogDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="font-mono">{profile.gym.code}</Badge>
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  
                  <div className="py-4 space-y-4">
                    {profile.owner && (
                      <div className="p-4 rounded-md bg-muted/50 border">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-amber-500/10 text-amber-600 font-semibold text-sm shrink-0">
                              <Crown className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{profile.owner.username}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-mono">{profile.owner.publicId || `#${profile.owner.id}`}</span>
                                {profile.owner.email && (
                                  <>
                                    <span className="opacity-50">|</span>
                                    <span>{profile.owner.email}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => openEditDialog({ ...profile.owner!, role: "owner", status: profile.owner!.status || "active" })}
                              data-testid="button-edit-owner"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => openResetPasswordDialog({ ...profile.owner!, role: "owner", status: profile.owner!.status || "active" })}
                              data-testid="button-reset-owner-password"
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => handleToggleStatus({ ...profile.owner!, role: "owner", status: profile.owner!.status || "active" })}
                              data-testid="button-toggle-owner-status"
                            >
                              {profile.owner.status === "suspended" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 ml-13">Gym Owner</p>
                      </div>
                    )}
                    
                    <p className="text-sm text-muted-foreground">Click to view details</p>
                    <div className="grid grid-cols-2 gap-4">
                      <Card 
                        className="cursor-pointer hover-elevate border-2 border-transparent hover:border-primary/20 transition-colors"
                        onClick={() => { setShowList("members"); setSearchQuery(""); }}
                        data-testid="button-view-members"
                      >
                        <CardContent className="p-6 text-center">
                          <div className="p-3 rounded-full bg-blue-500/10 w-fit mx-auto mb-3">
                            <Users className="h-6 w-6 text-blue-500" />
                          </div>
                          <p className="text-3xl font-bold">{profile.memberCount}</p>
                          <p className="text-sm text-muted-foreground mt-1">Members</p>
                        </CardContent>
                      </Card>
                      <Card 
                        className="cursor-pointer hover-elevate border-2 border-transparent hover:border-primary/20 transition-colors"
                        onClick={() => { setShowList("trainers"); setSearchQuery(""); }}
                        data-testid="button-view-trainers"
                      >
                        <CardContent className="p-6 text-center">
                          <div className="p-3 rounded-full bg-green-500/10 w-fit mx-auto mb-3">
                            <Dumbbell className="h-6 w-6 text-green-500" />
                          </div>
                          <p className="text-3xl font-bold">{profile.trainerCount}</p>
                          <p className="text-sm text-muted-foreground mt-1">Trainers</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <DialogHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { setShowList(null); setSearchQuery(""); }}
                        data-testid="button-back-to-profile"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex-1">
                        <DialogTitle className="flex items-center gap-2">
                          {showList === "members" ? (
                            <Users className="h-5 w-5 text-blue-500" />
                          ) : (
                            <Dumbbell className="h-5 w-5 text-green-500" />
                          )}
                          {showList === "members" ? "Members" : "Trainers"}
                          <Badge variant="secondary" className="ml-2">
                            {showList === "members" ? profile.memberCount : profile.trainerCount}
                          </Badge>
                        </DialogTitle>
                        <DialogDescription>{profile.gym.name}</DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-search-users"
                      placeholder={`Search ${showList}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <ScrollArea className="h-[320px] pr-4">
                    <div className="space-y-2">
                      {filteredUsers.map((user, index) => (
                        <div 
                          key={user.id} 
                          className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                          data-testid={`user-item-${user.id}`}
                        >
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                            {user.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{user.username}</p>
                              {user.status === "suspended" && (
                                <Badge variant="destructive" className="text-xs">Suspended</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{user.publicId || `#${user.id}`}</span>
                              {user.email && (
                                <>
                                  <span className="opacity-50">|</span>
                                  <span className="truncate">{user.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => openEditDialog({ ...user, role: showList === "members" ? "member" : "trainer", status: user.status || "active" })}
                              data-testid={`button-edit-user-${user.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => openResetPasswordDialog({ ...user, role: showList === "members" ? "member" : "trainer", status: user.status || "active" })}
                              data-testid={`button-reset-password-${user.id}`}
                            >
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => handleToggleStatus({ ...user, role: showList === "members" ? "member" : "trainer", status: user.status || "active" })}
                              data-testid={`button-toggle-status-${user.id}`}
                            >
                              {user.status === "suspended" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => openMoveGymDialog({ ...user, role: showList === "members" ? "member" : "trainer", status: user.status || "active" })}
                              data-testid={`button-move-gym-${user.id}`}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="text-center py-8">
                          <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-muted-foreground">
                            {searchQuery ? `No ${showList} matching "${searchQuery}"` : `No ${showList} yet`}
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {filteredUsers.length > 0 && searchQuery && (
                    <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                      Showing {filteredUsers.length} of {showList === "members" ? profile.memberCount : profile.trainerCount} {showList}
                    </p>
                  )}
                </>
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Edit {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) => setEditForm(f => ({ ...f, username: e.target.value }))}
                data-testid="input-edit-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                data-testid="input-edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason for change (required)</Label>
              <Textarea
                id="edit-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Why are you making this change?"
                data-testid="textarea-edit-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!editReason.trim() || editUserMutation.isPending}
              data-testid="button-save-user-edit"
            >
              {editUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Reset password for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={resetPasswordForm.newPassword}
                onChange={(e) => setResetPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Enter new password"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-reason">Reason (required)</Label>
              <Textarea
                id="reset-reason"
                value={resetPasswordForm.reason}
                onChange={(e) => setResetPasswordForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Why are you resetting this password?"
                data-testid="textarea-reset-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowResetPasswordDialog(false)}>Cancel</Button>
            <Button
              onClick={handleResetPassword}
              disabled={!resetPasswordForm.newPassword || !resetPasswordForm.reason.trim() || resetPasswordMutation.isPending}
              data-testid="button-confirm-reset-password"
            >
              {resetPasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveGymDialog} onOpenChange={setShowMoveGymDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Move to Another Gym
            </DialogTitle>
            <DialogDescription>
              Transfer {selectedUser?.username} to a different gym
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Target Gym</Label>
              <Select 
                value={moveGymForm.targetGymId} 
                onValueChange={(v) => setMoveGymForm(f => ({ ...f, targetGymId: v }))}
              >
                <SelectTrigger data-testid="select-target-gym">
                  <SelectValue placeholder="Select a gym" />
                </SelectTrigger>
                <SelectContent>
                  {gyms.filter(g => g.id !== selectedGymId).map(gym => (
                    <SelectItem key={gym.id} value={String(gym.id)}>
                      {gym.name} ({gym.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-reason">Reason (required)</Label>
              <Textarea
                id="move-reason"
                value={moveGymForm.reason}
                onChange={(e) => setMoveGymForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Why are you moving this user?"
                data-testid="textarea-move-reason"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMoveGymDialog(false)}>Cancel</Button>
            <Button
              onClick={handleMoveGym}
              disabled={!moveGymForm.targetGymId || !moveGymForm.reason.trim() || moveGymMutation.isPending}
              data-testid="button-confirm-move-gym"
            >
              {moveGymMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Move User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      const data: Record<string, unknown> = {
        planType: formData.planType,
        amountPaid: Math.round(parseFloat(formData.amountPaid || "0") * 100),
        paymentStatus: formData.paymentStatus,
      };
      if (formData.validUntil) data.validUntil = formData.validUntil;
      if (formData.notes) data.notes = formData.notes;
      upsertMutation.mutate({ gymId: selectedGymId, data });
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

type SupportTicket = {
  id: number;
  userId: number | null;
  userRole: string;
  gymId: number | null;
  contactEmailOrPhone: string | null;
  issueType: string;
  priority: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  gymName: string | null;
  gymCode: string | null;
  gymCity: string | null;
  gymState: string | null;
  userName: string | null;
  userEmail: string | null;
};

type SupportMessage = {
  id: number;
  ticketId: number;
  senderType: string;
  senderId: number | null;
  message: string;
  createdAt: string;
};

function SupportTab() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/admin/support", statusFilter, priorityFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);
      return adminFetch(`/api/admin/support?${params.toString()}`);
    },
  });

  const { data: ticketDetails, isLoading: loadingDetails } = useQuery<SupportTicket & { messages: SupportMessage[] }>({
    queryKey: ["/api/admin/support", selectedTicket?.id],
    queryFn: () => adminFetch(`/api/admin/support/${selectedTicket?.id}`),
    enabled: !!selectedTicket && showDetailDialog,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: number; status: string }) =>
      adminFetch(`/api/admin/support/${ticketId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support", variables.ticketId] });
      if (selectedTicket && selectedTicket.id === variables.ticketId) {
        setSelectedTicket({ ...selectedTicket, status: variables.status });
      }
      toast({ title: "Status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    },
  });

  const addMessageMutation = useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: number; message: string }) =>
      adminFetch(`/api/admin/support/${ticketId}/message`, { method: "POST", body: JSON.stringify({ message }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support", selectedTicket?.id] });
      setNewMessage("");
      toast({ title: "Message sent" });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedTicket) return;
    addMessageMutation.mutate({ ticketId: selectedTicket.id, message: newMessage });
  };

  const handleStatusChange = (status: string) => {
    if (selectedTicket) {
      updateStatusMutation.mutate({ ticketId: selectedTicket.id, status });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "waiting_user": return <MessageSquare className="w-4 h-4 text-orange-500" />;
      case "closed": return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "default", in_progress: "secondary", waiting_user: "outline", closed: "secondary",
    };
    return <Badge variant={variants[status] || "default"}>{status.replace("_", " ").toUpperCase()}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200",
      high: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200",
    };
    return <Badge className={colors[priority] || ""}>{priority.toUpperCase()}</Badge>;
  };

  const issueTypeLabels: Record<string, string> = {
    login: "Login Issue", otp: "OTP Issue", password: "Password Issue", gym_code: "Gym Code Issue",
    attendance: "Attendance Issue", payments: "Payment Issue", profile_update: "Profile Update",
    trainer_assignment: "Trainer Assignment", bug_report: "Bug Report", other: "Other",
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Support Tickets</CardTitle>
            <CardDescription>Manage user support requests</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="waiting_user">Waiting User</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-priority-filter">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No support tickets found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 border rounded-lg cursor-pointer hover-elevate"
                  onClick={() => { setSelectedTicket(ticket); setShowDetailDialog(true); }}
                  data-testid={`card-admin-ticket-${ticket.id}`}
                >
                  {ticket.gymName && (
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium text-primary">{ticket.gymName}</span>
                      <Badge variant="outline" className="text-xs">{ticket.gymCode}</Badge>
                      {(ticket.gymCity || ticket.gymState) && (
                        <span className="text-muted-foreground">
                          {[ticket.gymCity, ticket.gymState].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                  {!ticket.gymName && ticket.gymId === null && (
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" />
                      <span>Unknown Gym</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(ticket.status)}
                      <span className="font-medium">#{ticket.id}</span>
                      <span className="text-sm text-muted-foreground">
                        {ticket.userName || ticket.userRole} {ticket.userId ? `(ID: ${ticket.userId})` : "(Guest)"}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                  </div>
                  <p className="text-sm font-medium mb-1">
                    {issueTypeLabels[ticket.issueType] || ticket.issueType}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    {ticket.contactEmailOrPhone && <span>Contact: {ticket.contactEmailOrPhone}</span>}
                    {ticket.userEmail && <span>Email: {ticket.userEmail}</span>}
                    <span>Created: {format(new Date(ticket.createdAt), "PPp")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Ticket #{selectedTicket?.id}
              {selectedTicket && getStatusBadge(selectedTicket.status)}
            </DialogTitle>
            <DialogDescription>
              {selectedTicket && (issueTypeLabels[selectedTicket.issueType] || selectedTicket.issueType)}
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetails ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : ticketDetails ? (
            <div className="flex-1 overflow-y-auto space-y-4">
              {ticketDetails.gymName && (
                <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="font-medium">{ticketDetails.gymName}</span>
                      <Badge variant="outline">{ticketDetails.gymCode}</Badge>
                    </div>
                    {ticketDetails.gymId && (
                      <Button variant="outline" size="sm" onClick={() => { setShowDetailDialog(false); }} data-testid="button-open-gym">
                        <Building2 className="w-3 h-3 mr-1" />
                        View Gym
                      </Button>
                    )}
                  </div>
                  {(ticketDetails.gymCity || ticketDetails.gymState) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {[ticketDetails.gymCity, ticketDetails.gymState].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              )}
              {!ticketDetails.gymName && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm">Unknown Gym (ticket raised before login or gym not specified)</span>
                  </div>
                </div>
              )}
              <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getPriorityBadge(ticketDetails.priority)}
                  <Badge variant="secondary">{ticketDetails.userRole}</Badge>
                  {ticketDetails.userName && <span className="text-sm font-medium">{ticketDetails.userName}</span>}
                  {ticketDetails.userId && <span className="text-xs text-muted-foreground">(ID: {ticketDetails.userId})</span>}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  {ticketDetails.contactEmailOrPhone && <span>Contact: {ticketDetails.contactEmailOrPhone}</span>}
                  {ticketDetails.userEmail && <span>Email: {ticketDetails.userEmail}</span>}
                </div>
                <p className="text-sm">{ticketDetails.description}</p>
                <p className="text-xs text-muted-foreground">Created: {format(new Date(ticketDetails.createdAt), "PPpp")}</p>
              </div>

              <div className="flex items-center gap-2">
                <Label>Update Status:</Label>
                <Select value={ticketDetails.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[160px]" data-testid="select-ticket-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting_user">Waiting User</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Conversation</h4>
                <ScrollArea className="h-[200px] pr-4">
                  <div className="space-y-3">
                    {ticketDetails.messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
                    ) : (
                      ticketDetails.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.senderType === "admin" ? "bg-primary/10 mr-8" : "bg-secondary ml-8"
                          }`}
                        >
                          <p className="text-xs font-medium mb-1">
                            {msg.senderType === "admin" ? "Admin" : "User"}
                          </p>
                          <p className="text-sm">{msg.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(msg.createdAt), "PPp")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>

              {ticketDetails.status !== "closed" && (
                <div className="flex gap-2 border-t pt-4">
                  <Textarea
                    placeholder="Type your reply..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 min-h-[80px]"
                    data-testid="textarea-admin-reply"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || addMessageMutation.isPending}
                    data-testid="button-send-admin-reply"
                  >
                    {addMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Types for Attendance & Workouts Tab
type MemberDayData = {
  attendance: {
    id: number;
    status: string;
    verifiedMethod: string;
    adjustedByAdminId: number | null;
    adjustmentReason: string | null;
  } | null;
  workoutSessions: {
    id: number;
    date: string;
    focusLabel: string;
    notes: string | null;
    exercises: {
      id: number;
      exerciseName: string;
      sets: number | null;
      reps: number | null;
      weight: string | null;
      duration: number | null;
      orderIndex: number | null;
    }[];
  }[];
  member: {
    id: number;
    username: string;
    gymId: number | null;
  } | null;
};

type GymMember = {
  id: number;
  username: string;
  email: string | null;
  role: string;
};

function AttendanceWorkoutsTab() {
  const { toast } = useToast();
  const [selectedGymId, setSelectedGymId] = useState<string>("");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [reasonInput, setReasonInput] = useState("");
  
  // Dialog states
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [editingExercise, setEditingExercise] = useState<any>(null);
  
  // Form states
  const [sessionForm, setSessionForm] = useState({ focusLabel: "", notes: "", reason: "" });
  const [exerciseForm, setExerciseForm] = useState({ exerciseName: "", sets: "", reps: "", weight: "", reason: "" });
  
  // Fetch all gyms
  const { data: gyms = [] } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/admin/all-gyms"],
    queryFn: () => adminFetch("/api/admin/all-gyms"),
  });

  // Fetch gym roster when gym is selected
  const { data: gymRoster } = useQuery<{ gym: any; owner: any; trainers: GymMember[]; members: GymMember[] }>({
    queryKey: ["/api/admin/gyms", selectedGymId, "roster"],
    queryFn: () => adminFetch(`/api/admin/gyms/${selectedGymId}/roster`),
    enabled: !!selectedGymId,
  });

  // Fetch member day data
  const { data: memberDayData, isLoading: isLoadingDay, refetch: refetchDayData } = useQuery<MemberDayData>({
    queryKey: ["/api/admin/members", selectedMemberId, "day", selectedDate],
    queryFn: () => adminFetch(`/api/admin/members/${selectedMemberId}/day/${selectedDate}`),
    enabled: !!selectedMemberId && !!selectedDate,
  });

  // Set attendance mutation
  const setAttendanceMutation = useMutation({
    mutationFn: (data: { status: "present" | "absent"; reason: string }) =>
      adminFetch(`/api/admin/members/${selectedMemberId}/attendance`, {
        method: "POST",
        body: JSON.stringify({ date: selectedDate, ...data }),
      }),
    onSuccess: () => {
      refetchDayData();
      setReasonInput("");
      toast({ title: "Attendance updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: { focusLabel: string; notes?: string; reason: string }) =>
      adminFetch(`/api/admin/members/${selectedMemberId}/workout/session/create`, {
        method: "POST",
        body: JSON.stringify({ date: selectedDate, ...data }),
      }),
    onSuccess: () => {
      refetchDayData();
      setShowSessionDialog(false);
      setSessionForm({ focusLabel: "", notes: "", reason: "" });
      toast({ title: "Workout session created" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: number; data: { focusLabel?: string; notes?: string; reason: string } }) =>
      adminFetch(`/api/admin/workout/session/${sessionId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      refetchDayData();
      setShowSessionDialog(false);
      setEditingSession(null);
      toast({ title: "Session updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: ({ sessionId, reason }: { sessionId: number; reason: string }) =>
      adminFetch(`/api/admin/workout/session/${sessionId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      refetchDayData();
      toast({ title: "Session deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Add exercise mutation
  const addExerciseMutation = useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: number; data: any }) =>
      adminFetch(`/api/admin/workout/session/${sessionId}/exercise/add`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      refetchDayData();
      setShowExerciseDialog(false);
      setExerciseForm({ exerciseName: "", sets: "", reps: "", weight: "", reason: "" });
      toast({ title: "Exercise added" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Update exercise mutation
  const updateExerciseMutation = useMutation({
    mutationFn: ({ exerciseId, data }: { exerciseId: number; data: any }) =>
      adminFetch(`/api/admin/workout/exercise/${exerciseId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      refetchDayData();
      setShowExerciseDialog(false);
      setEditingExercise(null);
      toast({ title: "Exercise updated" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Delete exercise mutation
  const deleteExerciseMutation = useMutation({
    mutationFn: ({ exerciseId, reason }: { exerciseId: number; reason: string }) =>
      adminFetch(`/api/admin/workout/exercise/${exerciseId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      refetchDayData();
      toast({ title: "Exercise deleted" });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  // Recalculate streaks mutation
  const recalculateStreaksMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/api/admin/members/${selectedMemberId}/streak/recalculate`, { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "Streaks recalculated", description: `Attendance: ${data.attendanceStreak}, Workouts: ${data.workoutStreak}` });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleSetAttendance = (status: "present" | "absent") => {
    if (!reasonInput.trim()) {
      toast({ title: "Error", description: "Reason is required for attendance changes", variant: "destructive" });
      return;
    }
    setAttendanceMutation.mutate({ status, reason: reasonInput });
  };

  const handleSessionSubmit = () => {
    if (!sessionForm.reason.trim()) {
      toast({ title: "Error", description: "Reason is required", variant: "destructive" });
      return;
    }
    if (editingSession) {
      updateSessionMutation.mutate({
        sessionId: editingSession.id,
        data: { focusLabel: sessionForm.focusLabel, notes: sessionForm.notes, reason: sessionForm.reason },
      });
    } else {
      createSessionMutation.mutate(sessionForm);
    }
  };

  const handleExerciseSubmit = (sessionId: number) => {
    if (!exerciseForm.reason.trim()) {
      toast({ title: "Error", description: "Reason is required", variant: "destructive" });
      return;
    }
    const data: any = {
      exerciseName: exerciseForm.exerciseName,
      sets: exerciseForm.sets ? parseInt(exerciseForm.sets) : undefined,
      reps: exerciseForm.reps ? parseInt(exerciseForm.reps) : undefined,
      weight: exerciseForm.weight || undefined,
      reason: exerciseForm.reason,
    };
    if (editingExercise) {
      updateExerciseMutation.mutate({ exerciseId: editingExercise.id, data });
    } else {
      addExerciseMutation.mutate({ sessionId, data });
    }
  };

  const members = gymRoster?.members || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Attendance & Workouts Editor
            </CardTitle>
            <CardDescription>View and modify member attendance and workout records</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Select Gym</Label>
              <Select value={selectedGymId} onValueChange={(v) => { setSelectedGymId(v); setSelectedMemberId(""); }}>
                <SelectTrigger data-testid="select-gym-attendance">
                  <SelectValue placeholder="Choose a gym" />
                </SelectTrigger>
                <SelectContent>
                  {gyms.map((gym) => (
                    <SelectItem key={gym.id} value={gym.id.toString()}>{gym.name} ({gym.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Member</Label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId} disabled={!selectedGymId}>
                <SelectTrigger data-testid="select-member-attendance">
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id.toString()}>{member.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Date</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                data-testid="input-date-attendance"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => recalculateStreaksMutation.mutate()}
                disabled={!selectedMemberId || recalculateStreaksMutation.isPending}
                data-testid="button-recalculate-streaks"
              >
                {recalculateStreaksMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Recalculate Streaks
              </Button>
            </div>
          </div>

          {selectedMemberId && selectedDate && (
            <>
              {isLoadingDay ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : (
                <div className="space-y-6 pt-4 border-t">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <h3 className="font-semibold flex items-center gap-2">
                        <UserCheck className="w-4 h-4" />
                        Attendance for {format(new Date(selectedDate), "PPP")}
                      </h3>
                      {memberDayData?.attendance && (
                        <Badge className={memberDayData.attendance.status === "present" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"}>
                          {memberDayData.attendance.status === "present" ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                          {memberDayData.attendance.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 items-end flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <Label>Reason for change</Label>
                        <Input
                          placeholder="Enter reason for attendance change"
                          value={reasonInput}
                          onChange={(e) => setReasonInput(e.target.value)}
                          data-testid="input-attendance-reason"
                        />
                      </div>
                      <Button
                        onClick={() => handleSetAttendance("present")}
                        disabled={setAttendanceMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-mark-present"
                      >
                        <Check className="w-4 h-4 mr-1" /> Present
                      </Button>
                      <Button
                        onClick={() => handleSetAttendance("absent")}
                        disabled={setAttendanceMutation.isPending}
                        variant="destructive"
                        data-testid="button-mark-absent"
                      >
                        <X className="w-4 h-4 mr-1" /> Absent
                      </Button>
                    </div>
                    {memberDayData?.attendance?.adjustedByAdminId && (
                      <p className="text-sm text-muted-foreground">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        Last admin adjustment: {memberDayData.attendance.adjustmentReason}
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Dumbbell className="w-4 h-4" />
                        Workout Sessions
                      </h3>
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingSession(null);
                          setSessionForm({ focusLabel: "", notes: "", reason: "" });
                          setShowSessionDialog(true);
                        }}
                        data-testid="button-add-session"
                      >
                        Add Session
                      </Button>
                    </div>

                    {memberDayData?.workoutSessions?.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No workout sessions for this date</p>
                    ) : (
                      <div className="space-y-4">
                        {memberDayData?.workoutSessions?.map((session) => (
                          <Card key={session.id} className="border" data-testid={`session-card-${session.id}`}>
                            <CardHeader className="py-3 flex flex-row items-center justify-between gap-4">
                              <div>
                                <CardTitle className="text-base">{session.focusLabel}</CardTitle>
                                {session.notes && <CardDescription>{session.notes}</CardDescription>}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingSession(session);
                                    setSessionForm({ focusLabel: session.focusLabel, notes: session.notes || "", reason: "" });
                                    setShowSessionDialog(true);
                                  }}
                                  data-testid={`button-edit-session-${session.id}`}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    const reason = prompt("Enter reason for deletion:");
                                    if (reason) deleteSessionMutation.mutate({ sessionId: session.id, reason });
                                  }}
                                  data-testid={`button-delete-session-${session.id}`}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="py-2">
                              <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
                                <span className="text-sm font-medium">Exercises</span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingExercise({ sessionId: session.id });
                                    setExerciseForm({ exerciseName: "", sets: "", reps: "", weight: "", reason: "" });
                                    setShowExerciseDialog(true);
                                  }}
                                  data-testid={`button-add-exercise-${session.id}`}
                                >
                                  Add Exercise
                                </Button>
                              </div>
                              {session.exercises.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No exercises</p>
                              ) : (
                                <div className="space-y-2">
                                  {session.exercises.map((ex, idx) => (
                                    <div key={ex.id} className="flex items-center justify-between gap-2 p-2 bg-secondary/30 rounded" data-testid={`exercise-row-${ex.id}`}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">{idx + 1}.</span>
                                        <span className="font-medium">{ex.exerciseName}</span>
                                        <span className="text-sm text-muted-foreground">
                                          {ex.sets && ex.reps ? `${ex.sets}x${ex.reps}` : ""}
                                          {ex.weight ? ` @ ${ex.weight}` : ""}
                                        </span>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setEditingExercise({ ...ex, sessionId: session.id });
                                            setExerciseForm({
                                              exerciseName: ex.exerciseName,
                                              sets: ex.sets?.toString() || "",
                                              reps: ex.reps?.toString() || "",
                                              weight: ex.weight || "",
                                              reason: "",
                                            });
                                            setShowExerciseDialog(true);
                                          }}
                                          data-testid={`button-edit-exercise-${ex.id}`}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            const reason = prompt("Enter reason for deletion:");
                                            if (reason) deleteExerciseMutation.mutate({ exerciseId: ex.id, reason });
                                          }}
                                          data-testid={`button-delete-exercise-${ex.id}`}
                                        >
                                          <X className="w-3 h-3 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Add Workout Session"}</DialogTitle>
            <DialogDescription>
              {editingSession ? "Update the workout session details" : "Create a new workout session for this date"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Focus / Body Part</Label>
              <Input
                value={sessionForm.focusLabel}
                onChange={(e) => setSessionForm({ ...sessionForm, focusLabel: e.target.value })}
                placeholder="e.g., Upper Body, Leg Day, Push"
                data-testid="input-session-focus"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={sessionForm.notes}
                onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                placeholder="Any additional notes"
                data-testid="input-session-notes"
              />
            </div>
            <div>
              <Label>Reason for change</Label>
              <Input
                value={sessionForm.reason}
                onChange={(e) => setSessionForm({ ...sessionForm, reason: e.target.value })}
                placeholder="Required for audit trail"
                data-testid="input-session-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSessionDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSessionSubmit}
              disabled={createSessionMutation.isPending || updateSessionMutation.isPending}
              data-testid="button-save-session"
            >
              {(createSessionMutation.isPending || updateSessionMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingSession ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExerciseDialog} onOpenChange={setShowExerciseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExercise?.id ? "Edit Exercise" : "Add Exercise"}</DialogTitle>
            <DialogDescription>
              {editingExercise?.id ? "Update the exercise details" : "Add a new exercise to this session"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Exercise Name</Label>
              <Input
                value={exerciseForm.exerciseName}
                onChange={(e) => setExerciseForm({ ...exerciseForm, exerciseName: e.target.value })}
                placeholder="e.g., Bench Press"
                data-testid="input-exercise-name"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Sets</Label>
                <Input
                  type="number"
                  value={exerciseForm.sets}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, sets: e.target.value })}
                  placeholder="3"
                  data-testid="input-exercise-sets"
                />
              </div>
              <div>
                <Label>Reps</Label>
                <Input
                  type="number"
                  value={exerciseForm.reps}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, reps: e.target.value })}
                  placeholder="10"
                  data-testid="input-exercise-reps"
                />
              </div>
              <div>
                <Label>Weight</Label>
                <Input
                  value={exerciseForm.weight}
                  onChange={(e) => setExerciseForm({ ...exerciseForm, weight: e.target.value })}
                  placeholder="60kg"
                  data-testid="input-exercise-weight"
                />
              </div>
            </div>
            <div>
              <Label>Reason for change</Label>
              <Input
                value={exerciseForm.reason}
                onChange={(e) => setExerciseForm({ ...exerciseForm, reason: e.target.value })}
                placeholder="Required for audit trail"
                data-testid="input-exercise-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExerciseDialog(false)}>Cancel</Button>
            <Button
              onClick={() => handleExerciseSubmit(editingExercise?.sessionId)}
              disabled={addExerciseMutation.isPending || updateExerciseMutation.isPending}
              data-testid="button-save-exercise"
            >
              {(addExerciseMutation.isPending || updateExerciseMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingExercise?.id ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type AuditLog = {
  id: number;
  adminId: number;
  adminName: string;
  entityType: string;
  entityId: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  createdAt: string;
};

function AuditLogsTab() {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  
  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs", entityTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (entityTypeFilter !== "all") params.append("entityType", entityTypeFilter);
      return adminFetch(`/api/admin/audit-logs?${params.toString()}`);
    },
  });

  const getActionIcon = (action: string) => {
    if (action.includes("update") || action.includes("edit")) return <Edit className="w-4 h-4 text-blue-500" />;
    if (action.includes("password")) return <Key className="w-4 h-4 text-yellow-500" />;
    if (action.includes("status")) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (action.includes("transfer") || action.includes("move")) return <ArrowRightLeft className="w-4 h-4 text-purple-500" />;
    return <History className="w-4 h-4 text-muted-foreground" />;
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      status_update: "Status Update",
      admin_reply: "Admin Reply",
      admin_user_update: "User Edited",
      admin_password_reset: "Password Reset",
      admin_status_change: "Status Changed",
      admin_gym_transfer: "Gym Transfer",
      admin_trainer_reassign: "Trainer Reassigned",
    };
    return labels[action] || action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit Logs
            </CardTitle>
            <CardDescription>Track all admin actions and changes</CardDescription>
          </div>
          <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-audit-entity-filter">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="user">User Changes</SelectItem>
              <SelectItem value="gym">Gym Changes</SelectItem>
              <SelectItem value="support_ticket">Support Tickets</SelectItem>
              <SelectItem value="subscription">Subscriptions</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="p-4 border rounded-lg" data-testid={`audit-log-${log.id}`}>
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action)}
                      <span className="font-medium">{getActionLabel(log.action)}</span>
                      <Badge variant="outline">{log.entityType}</Badge>
                      <span className="text-sm text-muted-foreground">#{log.entityId}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(log.createdAt), "PPpp")}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mb-1">
                    By: <span className="font-medium">{log.adminName}</span>
                  </div>
                  {log.reason && (
                    <div className="text-sm bg-secondary/50 p-2 rounded mt-2">
                      <span className="font-medium">Reason:</span> {log.reason}
                    </div>
                  )}
                  {(log.oldValue || log.newValue) && (
                    <div className="flex gap-4 mt-2 text-xs flex-wrap">
                      {log.oldValue && (
                        <div className="bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded">
                          <span className="text-red-600 dark:text-red-400">Old:</span> {log.oldValue.length > 50 ? log.oldValue.substring(0, 50) + "..." : log.oldValue}
                        </div>
                      )}
                      {log.newValue && (
                        <div className="bg-green-50 dark:bg-green-950/30 px-2 py-1 rounded">
                          <span className="text-green-600 dark:text-green-400">New:</span> {log.newValue.length > 50 ? log.newValue.substring(0, 50) + "..." : log.newValue}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
            <TabsTrigger value="support" className="flex items-center gap-2" data-testid="tab-support">
              <HelpCircle className="h-4 w-4" />
              Support
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2" data-testid="tab-audit">
              <History className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2" data-testid="tab-attendance-workouts">
              <Calendar className="h-4 w-4" />
              Attendance & Workouts
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

          <TabsContent value="support">
            <SupportTab />
          </TabsContent>

          <TabsContent value="audit">
            <AuditLogsTab />
          </TabsContent>

          <TabsContent value="attendance">
            <AttendanceWorkoutsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
