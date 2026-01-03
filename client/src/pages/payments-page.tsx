import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IndianRupee, Plus, AlertTriangle, Clock, Users, CreditCard, Loader2, Receipt, Search, X, CheckCircle, Check, ChevronsUpDown } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { MembershipPlan, MemberSubscription, PaymentTransaction, User } from "@shared/schema";

type SubscriptionWithDetails = MemberSubscription & { 
  member: User; 
  plan: MembershipPlan | null; 
  totalPaid: number 
};

function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(rupees);
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  
  if (!isOwner) {
    return <MemberPaymentsView />;
  }

  return <OwnerPaymentsView />;
}

function OwnerPaymentsView() {
  const [activeTab, setActiveTab] = useState("subscriptions");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: alerts } = useQuery<{ endingSoon: number; overdue: number; active: number }>({
    queryKey: ["/api/owner/subscription-alerts"]
  });

  const handleCardClick = (filter: string) => {
    if (statusFilter === filter) {
      setStatusFilter(null);
    } else {
      setStatusFilter(filter);
      setActiveTab("subscriptions");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Membership & Payments</h2>
          <p className="text-muted-foreground mt-1">Manage membership plans, subscriptions, and payment tracking</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover-elevate ${statusFilter === 'active' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => handleCardClick('active')}
          data-testid="card-filter-active"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 shrink-0">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">Active</p>
                <p className="text-2xl font-bold" data-testid="text-active-count">{alerts?.active || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover-elevate ${statusFilter === 'endingSoon' ? 'ring-2 ring-yellow-500' : ''}`}
          onClick={() => handleCardClick('endingSoon')}
          data-testid="card-filter-ending-soon"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 shrink-0">
                <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">Ending Soon</p>
                <p className="text-2xl font-bold" data-testid="text-ending-soon">{alerts?.endingSoon || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer transition-all hover-elevate ${statusFilter === 'overdue' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => handleCardClick('overdue')}
          data-testid="card-filter-overdue"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30 shrink-0">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">Overdue</p>
                <p className="text-2xl font-bold" data-testid="text-overdue">{alerts?.overdue || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {statusFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">
            Filtering: {statusFilter === 'endingSoon' ? 'Ending Soon' : statusFilter}
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setStatusFilter(null)}
            data-testid="button-clear-filter"
          >
            <X className="h-4 w-4 mr-1" /> Clear Filter
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans" data-testid="tab-plans">Plans</TabsTrigger>
        </TabsList>
        <TabsContent value="subscriptions" className="mt-6">
          <SubscriptionsTab statusFilter={statusFilter} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        </TabsContent>
        <TabsContent value="plans" className="mt-6">
          <PlansTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlansTab() {
  const [open, setOpen] = useState(false);
  
  const { data: plans = [], isLoading } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/owner/membership-plans"]
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: { name: string; durationMonths: number; priceAmount: number }) => {
      return apiRequest("POST", "/api/owner/membership-plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/membership-plans"] });
      setOpen(false);
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: async (planId: number) => {
      return apiRequest("DELETE", `/api/owner/membership-plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/membership-plans"] });
    }
  });

  const formSchema = z.object({
    name: z.string().min(1, "Plan name is required"),
    durationMonths: z.coerce.number().min(1, "Duration must be at least 1 month"),
    priceRupees: z.coerce.number().min(0, "Price must be positive")
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", durationMonths: 1, priceRupees: 1500 }
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createPlanMutation.mutate({
      name: data.name,
      durationMonths: data.durationMonths,
      priceAmount: data.priceRupees * 100 // Convert to paise
    });
  };

  const activePlans = plans.filter(p => p.isActive);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-4">
        <div>
          <CardTitle>Membership Plans</CardTitle>
          <CardDescription>Define pricing tiers for your gym</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-plan">
              <Plus className="w-4 h-4 mr-2" /> Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Membership Plan</DialogTitle>
              <DialogDescription>Add a new membership pricing tier</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Monthly, Quarterly" {...field} data-testid="input-plan-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("durationMonths", 1)}>1 mo</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("durationMonths", 3)}>3 mo</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("durationMonths", 6)}>6 mo</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("durationMonths", 12)}>12 mo</Button>
                </div>
                <FormField
                  control={form.control}
                  name="durationMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (months)</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} data-testid="input-duration" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priceRupees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (in Rupees)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="number" min={0} className="pl-9" {...field} data-testid="input-price" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createPlanMutation.isPending} data-testid="button-submit-plan">
                  {createPlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Plan
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : activePlans.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No membership plans yet. Create your first plan to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePlans.map((plan) => (
              <Card key={plan.id} className="relative">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-lg" data-testid={`text-plan-name-${plan.id}`}>{plan.name}</h3>
                  <p className="text-3xl font-bold mt-2" data-testid={`text-plan-price-${plan.id}`}>
                    {formatINR(plan.priceAmount)}
                  </p>
                  <p className="text-sm text-muted-foreground">{plan.durationMonths} month{plan.durationMonths > 1 ? 's' : ''}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-4 text-destructive"
                    onClick={() => deactivateMutation.mutate(plan.id)}
                    disabled={deactivateMutation.isPending}
                    data-testid={`button-deactivate-${plan.id}`}
                  >
                    Deactivate
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SubscriptionsTabProps {
  statusFilter: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

function SubscriptionsTab({ statusFilter, searchQuery, setSearchQuery }: SubscriptionsTabProps) {
  const [open, setOpen] = useState(false);
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubscriptionWithDetails | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { toast } = useToast();
  
  const { data: subscriptions = [], isLoading } = useQuery<SubscriptionWithDetails[]>({
    queryKey: ["/api/owner/subscriptions"]
  });

  // Filter subscriptions based on status and search query
  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = !searchQuery || 
      sub.member?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.plan?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (!statusFilter) return true;
    
    switch (statusFilter) {
      case 'active':
        // Active includes both 'active' and 'endingSoon' statuses
        return sub.status === 'active' || sub.status === 'endingSoon';
      case 'endingSoon':
        return sub.status === 'endingSoon';
      case 'overdue':
        return sub.status === 'overdue';
      default:
        return true;
    }
  });

  const { data: plans = [] } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/owner/membership-plans"]
  });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ["/api/owner/members"]
  });

  const createSubMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/owner/subscriptions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/subscription-alerts"] });
      setOpen(false);
      toast({ title: "Subscription created", description: "Member subscription has been added." });
    }
  });

  const addPaymentMutation = useMutation({
    mutationFn: async ({ subscriptionId, data }: { subscriptionId: number; data: any }) => {
      return apiRequest("POST", `/api/owner/subscriptions/${subscriptionId}/payments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/subscription-alerts"] });
      setPaymentOpen(false);
      setSelectedSub(null);
      toast({ title: "Payment recorded", description: "Payment has been added to the ledger." });
    }
  });

  const formSchema = z.object({
    memberId: z.coerce.number().min(1, "Select a member"),
    planId: z.coerce.number().optional(),
    startDate: z.string().min(1, "Start date is required"),
    durationMonths: z.coerce.number().min(1),
    totalRupees: z.coerce.number().min(0),
    paymentMode: z.enum(["full", "partial", "emi"]),
    notes: z.string().optional()
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: format(new Date(), "yyyy-MM-dd"),
      durationMonths: 1,
      totalRupees: 1500,
      paymentMode: "full",
      notes: ""
    }
  });

  const selectedPlanId = form.watch("planId");
  const watchStartDate = form.watch("startDate");
  const watchDuration = form.watch("durationMonths");
  const activePlans = plans.filter(p => p.isActive);

  // Compute end date for display
  const computedEndDate = (() => {
    if (!watchStartDate || !watchDuration) return null;
    const start = new Date(watchStartDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + Number(watchDuration));
    return format(end, "dd MMM yyyy");
  })();

  // Auto-fill when plan is selected
  const handlePlanChange = (planId: string) => {
    form.setValue("planId", parseInt(planId));
    const plan = activePlans.find(p => p.id === parseInt(planId));
    if (plan) {
      form.setValue("durationMonths", plan.durationMonths);
      form.setValue("totalRupees", plan.priceAmount / 100);
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createSubMutation.mutate({
      memberId: data.memberId,
      planId: data.planId,
      startDate: data.startDate,
      durationMonths: data.durationMonths,
      totalAmount: data.totalRupees * 100,
      paymentMode: data.paymentMode,
      notes: data.notes
    });
  };

  const paymentFormSchema = z.object({
    paidOn: z.string().min(1),
    amountRupees: z.coerce.number().min(1, "Amount must be at least 1"),
    method: z.enum(["cash", "upi", "card", "bank", "other"]),
    referenceNote: z.string().optional()
  });

  const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paidOn: format(new Date(), "yyyy-MM-dd"),
      amountRupees: 0,
      method: "cash",
      referenceNote: ""
    }
  });

  const onPaymentSubmit = (data: z.infer<typeof paymentFormSchema>) => {
    if (!selectedSub) return;
    addPaymentMutation.mutate({
      subscriptionId: selectedSub.id,
      data: {
        paidOn: data.paidOn,
        amountPaid: data.amountRupees * 100,
        method: data.method,
        referenceNote: data.referenceNote
      }
    });
  };

  const membersList = members.filter((m: any) => m.role === 'member');

  return (
    <Card>
      <CardHeader className="pb-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Member Subscriptions</CardTitle>
            <CardDescription>Manage member memberships and payment tracking</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-assign-subscription">
                <Plus className="w-4 h-4 mr-2" /> Assign Subscription
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Subscription</DialogTitle>
              <DialogDescription>Create a membership subscription for a member</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="memberId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Member</FormLabel>
                      <Popover open={memberPopoverOpen} onOpenChange={setMemberPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={memberPopoverOpen}
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="select-member"
                            >
                              {field.value
                                ? membersList.find((m: any) => m.id === field.value)?.username
                                : "Search and select member..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search member..." data-testid="input-search-member" />
                            <CommandList>
                              <CommandEmpty>No member found.</CommandEmpty>
                              <CommandGroup>
                                {membersList.map((m: any) => (
                                  <CommandItem
                                    key={m.id}
                                    value={m.username}
                                    onSelect={() => {
                                      field.onChange(m.id);
                                      setMemberPopoverOpen(false);
                                    }}
                                    data-testid={`option-member-${m.id}`}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === m.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {m.username}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="planId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan (optional)</FormLabel>
                      <Select onValueChange={handlePlanChange} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger data-testid="select-plan">
                            <SelectValue placeholder="Select plan or use custom" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activePlans.map((p) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name} - {formatINR(p.priceAmount)} / {p.durationMonths}mo
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-start-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="durationMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (months)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} data-testid="input-sub-duration" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="totalRupees"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="number" min={0} className="pl-9" {...field} data-testid="input-total-amount" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {computedEndDate && (
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-sm text-muted-foreground">Subscription End Date</p>
                    <p className="font-medium" data-testid="text-computed-end-date">{computedEndDate}</p>
                  </div>
                )}
                <FormField
                  control={form.control}
                  name="paymentMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Mode</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-mode">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full">Full Payment</SelectItem>
                          <SelectItem value="partial">Partial Payment</SelectItem>
                          <SelectItem value="emi">EMI</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Additional notes" data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createSubMutation.isPending} data-testid="button-create-subscription">
                  {createSubMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Subscription
                </Button>
              </form>
            </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by member or plan name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-search-subscriptions"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{subscriptions.length === 0 ? "No subscriptions yet. Assign a subscription to get started." : "No matching subscriptions found."}</p>
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.map((sub) => {
                  const remaining = sub.totalAmount - sub.totalPaid;
                  return (
                    <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                      <TableCell className="font-medium">{sub.member?.username || 'Unknown'}</TableCell>
                      <TableCell>{sub.plan?.name || 'Custom'}</TableCell>
                      <TableCell className="text-sm">
                        <div>{sub.startDate}</div>
                        <div className="text-muted-foreground">to {sub.endDate}</div>
                      </TableCell>
                      <TableCell className="font-mono">{formatINR(sub.totalAmount)}</TableCell>
                      <TableCell className="font-mono text-green-600 dark:text-green-400">{formatINR(sub.totalPaid)}</TableCell>
                      <TableCell className="font-mono text-red-600 dark:text-red-400">{formatINR(remaining)}</TableCell>
                      <TableCell>
                        <SubscriptionStatusBadge status={sub.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedSub(sub);
                              paymentForm.reset({
                                paidOn: format(new Date(), "yyyy-MM-dd"),
                                amountRupees: remaining / 100,
                                method: "cash",
                                referenceNote: ""
                              });
                              setPaymentOpen(true);
                            }}
                            data-testid={`button-add-payment-${sub.id}`}
                          >
                            <Receipt className="w-4 h-4 mr-1" /> Add Payment
                          </Button>
                          <TransactionsDialog subscriptionId={sub.id} memberName={sub.member?.username || 'Member'} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Add payment for {selectedSub?.member?.username}
            </DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-4 pt-4">
              <FormField
                control={paymentForm.control}
                name="paidOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-payment-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="amountRupees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="number" min={1} className="pl-9" {...field} data-testid="input-payment-amount" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-method">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="referenceNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference/Note (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Transaction ID, cheque number, etc." data-testid="input-reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={addPaymentMutation.isPending} data-testid="button-submit-payment">
                {addPaymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Record Payment
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TransactionsDialog({ subscriptionId, memberName }: { subscriptionId: number; memberName: string }) {
  const [open, setOpen] = useState(false);
  
  const { data: transactions = [], isLoading } = useQuery<PaymentTransaction[]>({
    queryKey: ["/api/owner/subscriptions", subscriptionId, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/subscriptions/${subscriptionId}/transactions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" data-testid={`button-view-ledger-${subscriptionId}`}>
          View Ledger
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payment Ledger - {memberName}</DialogTitle>
          <DialogDescription>All payment transactions for this subscription</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No payments recorded yet.
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{txn.paidOn}</TableCell>
                    <TableCell className="font-mono">{formatINR(txn.amountPaid)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{txn.method}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {txn.referenceNote || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 shadow-none dark:bg-green-900 dark:text-green-300">Active</Badge>;
    case 'endingSoon':
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200 shadow-none dark:bg-yellow-900 dark:text-yellow-300">Ending Soon</Badge>;
    case 'overdue':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 shadow-none dark:bg-red-900 dark:text-red-300">Overdue</Badge>;
    case 'ended':
      return <Badge variant="secondary">Ended</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function MemberPaymentsView() {
  const { data: subscription, isLoading } = useQuery<{
    id: number;
    startDate: string;
    endDate: string;
    totalAmount: number;
    status: string;
    paymentMode: string;
    plan: { name: string } | null;
    totalPaid: number;
  } | null>({
    queryKey: ["/api/member/subscription"]
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">My Subscription</h2>
          <p className="text-muted-foreground mt-1">View your membership details</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No active subscription found. Please contact your gym owner.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const remaining = subscription.totalAmount - subscription.totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">My Subscription</h2>
        <p className="text-muted-foreground mt-1">View your membership details</p>
      </div>
      
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle>{subscription.plan?.name || 'Custom Plan'}</CardTitle>
            <SubscriptionStatusBadge status={subscription.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium" data-testid="text-start-date">{subscription.startDate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-medium" data-testid="text-end-date">{subscription.endDate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Mode</p>
              <p className="font-medium capitalize" data-testid="text-mode">{subscription.paymentMode}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
          </div>
          
          <div className="border-t pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-xl font-bold" data-testid="text-total">{formatINR(subscription.totalAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-paid">{formatINR(subscription.totalPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400" data-testid="text-balance">{formatINR(remaining)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
