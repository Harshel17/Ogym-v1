import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserPlus, Plus, Users, Calendar, IndianRupee, TrendingUp, Phone, Mail, FileText, Loader2, Image, CheckCircle, Clock, XCircle, MessageSquare, UserCheck, Ban, PhoneCall, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type FollowUpStatus = "pending" | "contacted" | "follow_up_scheduled" | "converted" | "not_interested";

type WalkInVisitor = {
  id: number;
  gymId: number;
  visitorName: string;
  phone: string | null;
  city: string | null;
  email: string | null;
  visitDate: string;
  visitType: "day_pass" | "trial" | "enquiry";
  daysCount: number | null;
  amountPaid: number | null;
  paymentMethod: string | null;
  paymentScreenshot: string | null;
  checkinCode: string | null;
  codeExpiresAt: string | null;
  paymentVerified: boolean | null;
  notes: string | null;
  source: "owner" | "trainer" | "kiosk" | null;
  convertedToMember: boolean | null;
  followUpStatus: FollowUpStatus | null;
  followUpNotes: string | null;
  followUpDate: string | null;
  createdAt: string;
};

type WalkInStats = {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  todayRevenue: number;
  conversionRate: number;
};

const walkInSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email().optional().or(z.literal("")),
  visitDate: z.string().min(1, "Visit date is required"),
  visitType: z.enum(["day_pass", "trial", "enquiry"]),
  daysCount: z.coerce.number().min(1).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  notes: z.string().optional()
});

type WalkInForm = z.infer<typeof walkInSchema>;

export default function OwnerWalkInVisitorsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [followUpVisitor, setFollowUpVisitor] = useState<WalkInVisitor | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState("");

  const today = new Date().toISOString().split('T')[0];

  const form = useForm<WalkInForm>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      visitDate: today,
      visitType: "day_pass",
      daysCount: 1,
      amountPaid: 0,
      notes: ""
    }
  });

  const buildVisitorsUrl = () => {
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (typeFilter && typeFilter !== "all") params.set("visitType", typeFilter);
    const queryString = params.toString();
    return `/api/owner/walk-in-visitors${queryString ? `?${queryString}` : ""}`;
  };

  const { data: visitors = [], isLoading } = useQuery<WalkInVisitor[]>({
    queryKey: ["/api/owner/walk-in-visitors", dateFilter, typeFilter],
    queryFn: async () => {
      const res = await fetch(buildVisitorsUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch visitors");
      return res.json();
    }
  });

  const { data: stats } = useQuery<WalkInStats>({
    queryKey: ["/api/owner/walk-in-visitors/stats"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: WalkInForm) => {
      return apiRequest("POST", "/api/owner/walk-in-visitors", {
        ...data,
        amountPaid: (data.amountPaid || 0) * 100,
        email: data.email || undefined
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/stats"] });
      form.reset({
        name: "",
        phone: "",
        email: "",
        visitDate: today,
        visitType: "day_pass",
        daysCount: 1,
        amountPaid: 0,
        notes: ""
      });
      setIsOpen(false);
      toast({ title: "Visitor recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add visitor", description: error.message, variant: "destructive" });
    }
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async (visitorId: number) => {
      return apiRequest("POST", `/api/owner/walk-in-visitors/${visitorId}/verify-payment`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      toast({ title: "Payment verified successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to verify payment", description: error.message, variant: "destructive" });
    }
  });

  const followUpMutation = useMutation({
    mutationFn: async ({ visitorId, status, notes }: { visitorId: number; status: FollowUpStatus; notes?: string }) => {
      return apiRequest("PATCH", `/api/owner/walk-in-visitors/${visitorId}/follow-up`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/stats"] });
      setFollowUpVisitor(null);
      setFollowUpNotes("");
      toast({ title: "Follow-up updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update follow-up", description: error.message, variant: "destructive" });
    }
  });

  const onSubmit = (data: WalkInForm) => {
    createMutation.mutate(data);
  };

  const getVisitTypeBadge = (type: string) => {
    switch (type) {
      case "day_pass":
        return <Badge className="bg-green-500">Day Pass</Badge>;
      case "trial":
        return <Badge className="bg-blue-500">Trial</Badge>;
      case "enquiry":
        return <Badge className="bg-amber-500">Enquiry</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getFollowUpStatusBadge = (status: FollowUpStatus | null) => {
    switch (status) {
      case "contacted":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><PhoneCall className="w-3 h-3 mr-1" />Contacted</Badge>;
      case "follow_up_scheduled":
        return <Badge variant="outline" className="text-purple-600 border-purple-600"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case "converted":
        return <Badge variant="outline" className="text-green-600 border-green-600"><UserCheck className="w-3 h-3 mr-1" />Converted</Badge>;
      case "not_interested":
        return <Badge variant="outline" className="text-red-600 border-red-600"><Ban className="w-3 h-3 mr-1" />Not Interested</Badge>;
      case "pending":
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const openFollowUp = (visitor: WalkInVisitor) => {
    setFollowUpVisitor(visitor);
    setFollowUpNotes(visitor.followUpNotes || "");
  };

  const handleFollowUpStatus = (status: FollowUpStatus) => {
    if (followUpVisitor) {
      followUpMutation.mutate({ visitorId: followUpVisitor.id, status, notes: followUpNotes || undefined });
    }
  };

  const formatAmount = (paise: number | null) => {
    if (!paise) return "-";
    return `₹${(paise / 100).toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Walk-in Visitors</h2>
          <p className="text-sm text-muted-foreground mt-1">Track day pass visitors, trials, and enquiries</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-visitor">
              <Plus className="w-4 h-4 mr-2" />
              Add Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Walk-in Visitor</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Visitor name" {...field} data-testid="input-visitor-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} data-testid="input-visitor-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Email address" type="email" {...field} data-testid="input-visitor-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="visitDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visit Date *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-visit-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="visitType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visit Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-visit-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="day_pass">Day Pass</SelectItem>
                            <SelectItem value="trial">Trial</SelectItem>
                            <SelectItem value="enquiry">Enquiry</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="daysCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} data-testid="input-days-count" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amountPaid"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount (₹)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="0" {...field} data-testid="input-amount-paid" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any additional notes..." {...field} data-testid="input-visitor-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-visitor">
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Visitor
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{stats.todayCount}</div>
              <p className="text-xs text-muted-foreground">visitors today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">This Week</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{stats.weekCount}</div>
              <p className="text-xs text-muted-foreground">visitors this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Revenue</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{formatAmount(stats.todayRevenue)}</div>
              <p className="text-xs text-muted-foreground">from walk-ins</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Conversion</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{stats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">became members</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="p-3 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <div>
              <CardTitle className="text-base md:text-lg">Recent Visitors</CardTitle>
              <CardDescription className="text-xs md:text-sm">All walk-in visitors and their details</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[130px] md:w-40 text-sm"
                data-testid="filter-date"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[100px] md:w-32 text-sm" data-testid="filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="day_pass">Day Pass</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="enquiry">Enquiry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : visitors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No walk-in visitors yet</p>
              <p className="text-sm">Add a visitor using the button above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visitors.map((visitor) => (
                <div key={visitor.id} className="p-3 md:p-4 border rounded-lg" data-testid={`visitor-card-${visitor.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <h4 className="font-medium text-sm md:text-base">{visitor.visitorName}</h4>
                      {getVisitTypeBadge(visitor.visitType)}
                      {getFollowUpStatusBadge(visitor.followUpStatus)}
                      {visitor.source === "kiosk" && (
                        <Badge variant="secondary" className="text-xs">Self Check-in</Badge>
                      )}
                      {visitor.visitType === "day_pass" && visitor.paymentVerified && (
                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                      {visitor.visitType === "day_pass" && visitor.paymentScreenshot && !visitor.paymentVerified && (
                        <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Payment Pending
                        </Badge>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-semibold text-sm md:text-base">{formatAmount(visitor.amountPaid)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-muted-foreground">
                    {visitor.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {visitor.phone}
                      </span>
                    )}
                    {visitor.email && (
                      <span className="flex items-center gap-1 truncate max-w-[150px] md:max-w-none">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{visitor.email}</span>
                      </span>
                    )}
                    {visitor.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {visitor.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(visitor.visitDate), "MMM d, yyyy")}
                    </span>
                    {visitor.daysCount && visitor.daysCount > 1 && (
                      <span>{visitor.daysCount} days</span>
                    )}
                    {visitor.checkinCode && (
                      <span className="font-mono font-medium text-primary">
                        Code: {visitor.checkinCode}
                      </span>
                    )}
                  </div>
                  {visitor.notes && (
                    <div className="mt-2 text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{visitor.notes}</span>
                    </div>
                  )}
                  {visitor.followUpNotes && (
                    <div className="mt-2 text-xs md:text-sm text-muted-foreground flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{visitor.followUpNotes}</span>
                    </div>
                  )}
                  
                  {/* Actions Row */}
                  <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
                    {/* Follow-up button for enquiry/trial visitors */}
                    {(visitor.visitType === "enquiry" || visitor.visitType === "trial") && visitor.followUpStatus !== "converted" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openFollowUp(visitor)}
                        data-testid={`button-follow-up-${visitor.id}`}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Follow-up
                      </Button>
                    )}
                    
                    {/* Day Pass Payment Actions */}
                    {visitor.visitType === "day_pass" && visitor.paymentScreenshot && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setScreenshotPreview(visitor.paymentScreenshot)}
                          data-testid={`button-view-screenshot-${visitor.id}`}
                        >
                          <Image className="w-4 h-4 mr-1" />
                          View Payment
                        </Button>
                        {!visitor.paymentVerified && (
                          <Button
                            size="sm"
                            onClick={() => verifyPaymentMutation.mutate(visitor.id)}
                            disabled={verifyPaymentMutation.isPending}
                            data-testid={`button-verify-payment-${visitor.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Verify Payment
                          </Button>
                        )}
                        {visitor.paymentMethod && (
                          <span className="text-xs text-muted-foreground">
                            via {visitor.paymentMethod.toUpperCase()}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Screenshot Preview Dialog */}
      <Dialog open={!!screenshotPreview} onOpenChange={() => setScreenshotPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Screenshot</DialogTitle>
          </DialogHeader>
          {screenshotPreview && (
            <div className="mt-2">
              <img 
                src={screenshotPreview} 
                alt="Payment screenshot" 
                className="w-full rounded-lg border"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog open={!!followUpVisitor} onOpenChange={(open) => !open && setFollowUpVisitor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Follow-up: {followUpVisitor?.visitorName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {followUpVisitor?.visitType === "enquiry" ? "Enquiry" : "Trial"} visit on {followUpVisitor?.visitDate && format(new Date(followUpVisitor.visitDate), "MMM d, yyyy")}
              </p>
              {followUpVisitor?.phone && (
                <p className="text-sm flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {followUpVisitor.phone}
                </p>
              )}
              {followUpVisitor?.email && (
                <p className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {followUpVisitor.email}
                </p>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <Textarea
                placeholder="Add notes about this follow-up..."
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={3}
                data-testid="input-follow-up-notes"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium block">Update Status</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleFollowUpStatus("contacted")}
                  disabled={followUpMutation.isPending}
                  className="justify-start"
                  data-testid="button-status-contacted"
                >
                  <PhoneCall className="w-4 h-4 mr-2 text-blue-600" />
                  Contacted
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleFollowUpStatus("follow_up_scheduled")}
                  disabled={followUpMutation.isPending}
                  className="justify-start"
                  data-testid="button-status-scheduled"
                >
                  <Clock className="w-4 h-4 mr-2 text-purple-600" />
                  Scheduled
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleFollowUpStatus("converted")}
                  disabled={followUpMutation.isPending}
                  className="justify-start"
                  data-testid="button-status-converted"
                >
                  <UserCheck className="w-4 h-4 mr-2 text-green-600" />
                  Converted
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleFollowUpStatus("not_interested")}
                  disabled={followUpMutation.isPending}
                  className="justify-start"
                  data-testid="button-status-not-interested"
                >
                  <Ban className="w-4 h-4 mr-2 text-red-600" />
                  Not Interested
                </Button>
              </div>
            </div>

            {followUpMutation.isPending && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
