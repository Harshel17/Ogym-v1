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
  HelpCircle, MessageSquare, AlertCircle, Send
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
  members: { id: number; username: string; email: string | null; phone: string | null; publicId: string | null }[];
  trainers: { id: number; username: string; email: string | null; phone: string | null; publicId: string | null }[];
  memberCount: number;
  trainerCount: number;
};

function GymsTab() {
  const [selectedGymId, setSelectedGymId] = useState<number | null>(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showList, setShowList] = useState<"members" | "trainers" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  const { data: profile, isLoading: profileLoading } = useQuery<GymProfile>({
    queryKey: ["/api/admin/gyms", selectedGymId, "profile"],
    queryFn: () => adminFetch(`/api/admin/gyms/${selectedGymId}/profile`),
    enabled: !!selectedGymId && showProfileDialog,
  });

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
                  
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-4">Click to view details</p>
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
                          className="flex items-center gap-3 p-3 rounded-md bg-muted/50 hover-elevate"
                          data-testid={`user-item-${user.id}`}
                        >
                          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                            {user.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{user.username}</p>
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
                          <Badge variant="outline" className="shrink-0 text-xs">
                            #{index + 1}
                          </Badge>
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

  const { data: ticketDetails, isLoading: loadingDetails } = useQuery<{
    ticket: SupportTicket;
    messages: SupportMessage[];
  }>({
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
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(ticket.status)}
                      <span className="font-medium">#{ticket.id}</span>
                      <span className="text-sm text-muted-foreground">
                        {ticket.userRole} {ticket.userId ? `(User #${ticket.userId})` : "(Guest)"}
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
              <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getPriorityBadge(ticketDetails.ticket.priority)}
                  <span className="text-sm">{ticketDetails.ticket.userRole}</span>
                  {ticketDetails.ticket.contactEmailOrPhone && (
                    <span className="text-sm text-muted-foreground">{ticketDetails.ticket.contactEmailOrPhone}</span>
                  )}
                </div>
                <p className="text-sm">{ticketDetails.ticket.description}</p>
                <p className="text-xs text-muted-foreground">Created: {format(new Date(ticketDetails.ticket.createdAt), "PPpp")}</p>
              </div>

              <div className="flex items-center gap-2">
                <Label>Update Status:</Label>
                <Select value={ticketDetails.ticket.status} onValueChange={handleStatusChange}>
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

              {ticketDetails.ticket.status !== "closed" && (
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
        </Tabs>
      </main>
    </div>
  );
}
