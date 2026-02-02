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
import { Banknote, Plus, AlertTriangle, Clock, Users, CreditCard, Loader2, Receipt, Search, X, CheckCircle, Check, ChevronsUpDown, ChevronDown, ChevronUp, UserPlus, Download, Trophy } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { useGymCurrency } from "@/hooks/use-gym-currency";
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
  totalPaid: number;
  hasMemberPayments?: boolean;
};


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
  const { format: formatMoney } = useGymCurrency();
  
  const { data: alerts } = useQuery<{ endingSoon: number; overdue: number; active: number; needSubscription: number }>({
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <Card 
          className={`cursor-pointer transition-all hover-elevate ${statusFilter === 'needSubscription' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => handleCardClick('needSubscription')}
          data-testid="card-filter-need-subscription"
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
                <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">Need Subscription</p>
                <p className="text-2xl font-bold" data-testid="text-need-subscription">{alerts?.needSubscription || 0}</p>
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

      {statusFilter === 'needSubscription' ? (
        <MembersNeedSubscriptionSection />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full max-w-xl gap-1">
            <TabsTrigger value="subscriptions" className="flex-1" data-testid="tab-subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="outstanding" className="flex-1" data-testid="tab-outstanding">Outstanding</TabsTrigger>
            <TabsTrigger value="byMethod" className="flex-1" data-testid="tab-by-method">By Method</TabsTrigger>
            <TabsTrigger value="plans" className="flex-1" data-testid="tab-plans">Plans</TabsTrigger>
          </TabsList>
          <TabsContent value="subscriptions" className="mt-6">
            <SubscriptionsTab statusFilter={statusFilter} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          </TabsContent>
          <TabsContent value="outstanding" className="mt-6">
            <OutstandingPaymentsTab />
          </TabsContent>
          <TabsContent value="byMethod" className="mt-6">
            <ByMethodTab />
          </TabsContent>
          <TabsContent value="plans" className="mt-6">
            <PlansTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function MembersNeedSubscriptionSection() {
  const { toast } = useToast();
  const { format: formatMoney } = useGymCurrency();
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { data: members = [], isLoading } = useQuery<{ id: number; username: string; publicId: string | null; createdAt: string | null }[]>({
    queryKey: ["/api/owner/members-need-subscription"]
  });

  const { data: plans = [] } = useQuery<MembershipPlan[]>({
    queryKey: ["/api/owner/membership-plans"]
  });

  const activePlans = plans.filter(p => p.isActive);

  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: { memberId: number; planId?: number; startDate: string; durationMonths: number; totalAmount: number; paymentMode: string; notes?: string }) => {
      return apiRequest("POST", "/api/owner/subscriptions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/members-need-subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/subscription-alerts"] });
      setDialogOpen(false);
      setSelectedMemberId(null);
      toast({ title: "Subscription assigned successfully" });
    },
    onError: () => {
      toast({ title: "Failed to assign subscription", variant: "destructive" });
    }
  });

  const formSchema = z.object({
    planId: z.coerce.number().optional(),
    startDate: z.string().min(1, "Start date is required"),
    durationMonths: z.coerce.number().min(1, "Duration must be at least 1 month"),
    totalAmountInput: z.coerce.number().min(0, "Amount must be positive"),
    paymentMode: z.enum(["full", "partial", "emi"]),
    notes: z.string().optional()
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      planId: undefined, 
      startDate: new Date().toISOString().split('T')[0],
      durationMonths: 1,
      totalAmountInput: 1500,
      paymentMode: "full",
      notes: ""
    }
  });

  const watchStartDate = form.watch("startDate");
  const watchDuration = form.watch("durationMonths");

  const computedEndDate = watchStartDate && watchDuration ? (() => {
    const start = new Date(watchStartDate);
    start.setMonth(start.getMonth() + Number(watchDuration));
    return format(start, "dd MMM yyyy");
  })() : null;

  const handlePlanChange = (planIdStr: string) => {
    const planId = parseInt(planIdStr);
    form.setValue("planId", planId);
    const plan = activePlans.find(p => p.id === planId);
    if (plan) {
      form.setValue("durationMonths", plan.durationMonths);
      form.setValue("totalAmountInput", plan.priceAmount / 100);
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (!selectedMemberId) return;
    createSubscriptionMutation.mutate({
      memberId: selectedMemberId,
      planId: data.planId,
      startDate: data.startDate,
      durationMonths: data.durationMonths,
      totalAmount: data.totalAmountInput * 100,
      paymentMode: data.paymentMode,
      notes: data.notes
    });
  };

  const handleAssignClick = (memberId: number, memberName: string) => {
    setSelectedMemberId(memberId);
    setSelectedMemberName(memberName);
    form.reset({ 
      planId: undefined, 
      startDate: new Date().toISOString().split('T')[0],
      durationMonths: 1,
      totalAmountInput: 1500,
      paymentMode: "full",
      notes: ""
    });
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap pb-4">
          <div>
            <CardTitle>Members Needing Subscription</CardTitle>
            <CardDescription>These members don't have a subscription set up yet</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              All members have subscriptions set up
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 rounded-xl border bg-card border-blue-500/30 bg-blue-500/5"
                    data-testid={`card-member-need-sub-${member.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
                          {member.username?.slice(0, 2).toUpperCase() || '??'}
                        </div>
                        <div>
                          <p className="font-semibold">{member.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {member.createdAt ? format(new Date(member.createdAt), 'MMM d, yyyy') : '-'}
                          </p>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => handleAssignClick(member.id, member.username)}
                        data-testid={`button-assign-sub-mobile-${member.id}`}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Assign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Public ID</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id} data-testid={`row-member-need-sub-${member.id}`}>
                        <TableCell className="font-medium">{member.username}</TableCell>
                        <TableCell>{member.publicId || '-'}</TableCell>
                        <TableCell>{member.createdAt ? format(new Date(member.createdAt), 'MMM d, yyyy') : '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            size="sm" 
                            onClick={() => handleAssignClick(member.id, member.username)}
                            data-testid={`button-assign-sub-${member.id}`}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Assign
                          </Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Subscription</DialogTitle>
            <DialogDescription>Create a subscription for {selectedMemberName}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="planId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan (optional)</FormLabel>
                    <Select onValueChange={handlePlanChange} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger data-testid="select-plan-quick">
                          <SelectValue placeholder="Select plan or use custom" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activePlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id.toString()}>
                            {plan.name} - {formatMoney(plan.priceAmount)} / {plan.durationMonths}mo
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
                      <Input type="date" {...field} data-testid="input-start-date-quick" />
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
                        <Input type="number" min={1} {...field} data-testid="input-duration-quick" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalAmountInput"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="number" min={0} className="pl-9" {...field} data-testid="input-amount-quick" />
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
                  <p className="font-medium">{computedEndDate}</p>
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
                        <SelectTrigger data-testid="select-payment-mode-quick">
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
                      <Input {...field} placeholder="Additional notes" data-testid="input-notes-quick" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={createSubscriptionMutation.isPending} data-testid="button-confirm-assign">
                {createSubscriptionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Subscription
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlansTab() {
  const [open, setOpen] = useState(false);
  const { format: formatMoney } = useGymCurrency();
  
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
    priceInput: z.coerce.number().min(0, "Price must be positive")
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", durationMonths: 1, priceInput: 1500 }
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createPlanMutation.mutate({
      name: data.name,
      durationMonths: data.durationMonths,
      priceAmount: data.priceInput * 100
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
                  name="priceInput"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                    {formatMoney(plan.priceAmount)}
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

function OutstandingPaymentCard({ sub }: { sub: SubscriptionWithDetails }) {
  const [expanded, setExpanded] = useState(false);
  const { format: formatMoney } = useGymCurrency();
  
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<PaymentTransaction[]>({
    queryKey: ["/api/owner/subscriptions", sub.id, "transactions"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/subscriptions/${sub.id}/transactions`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: expanded
  });

  const remaining = sub.totalAmount - sub.totalPaid;
  const paidPercentage = sub.totalAmount > 0 ? Math.round((sub.totalPaid / sub.totalAmount) * 100) : 100;

  return (
    <Card key={sub.id} className="border-l-4 border-l-yellow-500 rounded-none border-y-0 border-r-0">
      <CardContent className="py-4">
        <div 
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover-elevate active-elevate-2 p-2 rounded-md -m-2"
          onClick={() => setExpanded(!expanded)}
          data-testid={`button-expand-payment-${sub.id}`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold" data-testid={`text-outstanding-member-${sub.id}`}>
                {sub.member?.username}
              </p>
              <Badge variant="outline" className="capitalize">
                {sub.paymentMode}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {sub.plan?.name || 'Custom Plan'} - {sub.plan?.durationMonths || 1} month{(sub.plan?.durationMonths || 1) > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              Ends: {format(new Date(sub.endDate), "dd MMM yyyy")}
            </p>
          </div>
          <div className="flex-1 max-w-xs space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Paid</span>
              <span className="font-medium">{paidPercentage}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all" 
                style={{ width: `${paidPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatMoney(sub.totalPaid)} paid</span>
              <span>{formatMoney(sub.totalAmount)} total</span>
            </div>
          </div>
          <div className="text-right flex items-center gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400" data-testid={`text-remaining-${sub.id}`}>
                {formatMoney(remaining)}
              </p>
            </div>
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
        
        {expanded && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium mb-3">Payment History</p>
            {transactionsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No payments recorded yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <div>
                        <p className="text-sm font-medium">{formatMoney(txn.amountPaid)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{txn.method}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{format(new Date(txn.paidOn), "dd MMM yyyy")}</p>
                      {txn.referenceNote && (
                        <p className="text-xs text-muted-foreground">{txn.referenceNote}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TransactionWithMember = {
  id: number;
  subscriptionId: number;
  amountPaid: number;
  method: string;
  paidOn: string;
  referenceNote: string | null;
  createdAt: Date | null;
  member: { id: number; username: string };
};

const PAYMENT_METHODS = [
  { value: "all", label: "All Methods", icon: Banknote },
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "venmo", label: "Venmo", icon: CreditCard },
  { value: "zelle", label: "Zelle", icon: CreditCard },
  { value: "cashapp", label: "CashApp", icon: CreditCard },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "bank", label: "Bank Transfer", icon: CreditCard },
  { value: "other", label: "Other", icon: Receipt },
];

const DATE_RANGES = [
  { value: "all", label: "All Time" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "30days", label: "Last 30 Days" },
  { value: "90days", label: "Last 90 Days" },
];

const CHART_COLORS = [
  "#4F46E5", // Indigo (primary)
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#6366F1", // Violet
];

type MethodSummary = { method: string; total: number; count: number };

function ByMethodTab() {
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const { format: formatMoney } = useGymCurrency();

  // Calculate date range
  const getDateRange = () => {
    const today = new Date();
    let startDate: string | undefined;
    let endDate: string | undefined = format(today, "yyyy-MM-dd");
    
    switch (dateRange) {
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        startDate = format(weekStart, "yyyy-MM-dd");
        break;
      case "month":
        startDate = format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd");
        break;
      case "30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        startDate = format(thirtyDaysAgo, "yyyy-MM-dd");
        break;
      case "90days":
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(today.getDate() - 90);
        startDate = format(ninetyDaysAgo, "yyyy-MM-dd");
        break;
      default:
        startDate = undefined;
        endDate = undefined;
    }
    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange();

  // Fetch summary for all methods
  const { data: summary = [], isLoading: summaryLoading } = useQuery<MethodSummary[]>({
    queryKey: ["/api/owner/transactions/summary", startDate, endDate],
    queryFn: async () => {
      let url = "/api/owner/transactions/summary";
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    }
  });
  
  const { data: transactions = [], isLoading } = useQuery<TransactionWithMember[]>({
    queryKey: ["/api/owner/transactions", selectedMethod === "all" ? null : selectedMethod, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMethod !== "all") params.append("method", selectedMethod);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      const url = `/api/owner/transactions${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    }
  });

  const totalAmount = transactions.reduce((sum, txn) => sum + txn.amountPaid, 0);
  const grandTotal = summary.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-2">Period:</span>
            {DATE_RANGES.map((range) => (
              <Button
                key={range.value}
                variant={dateRange === range.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange(range.value)}
                data-testid={`button-range-${range.value}`}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {summaryLoading ? (
          <div className="col-span-full flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Grand Total Card */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedMethod === "all" ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
              onClick={() => setSelectedMethod("all")}
              data-testid="card-summary-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">All Methods</span>
              </div>
              <p className="text-xl font-bold">{formatMoney(grandTotal)}</p>
              <p className="text-xs text-muted-foreground">{summary.reduce((sum, s) => sum + s.count, 0)} transactions</p>
            </div>
            
            {/* Individual Method Cards */}
            {PAYMENT_METHODS.filter(m => m.value !== "all").map((method) => {
              const methodData = summary.find(s => s.method === method.value);
              const Icon = method.icon;
              return (
                <div 
                  key={method.value}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedMethod === method.value ? "border-primary bg-primary/5" : "border-border hover-elevate"}`}
                  onClick={() => setSelectedMethod(method.value)}
                  data-testid={`card-summary-${method.value}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </div>
                  <p className="text-xl font-bold">{formatMoney(methodData?.total || 0)}</p>
                  <p className="text-xs text-muted-foreground">{methodData?.count || 0} transactions</p>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Chart and Top Payers Row */}
      {!summaryLoading && summary.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment Method Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summary.filter(s => s.total > 0).map(s => ({
                        name: PAYMENT_METHODS.find(m => m.value === s.method)?.label || s.method,
                        value: s.total,
                        method: s.method
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {summary.filter(s => s.total > 0).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatMoney(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top Payers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Top Payers {dateRange !== "all" ? `(${DATE_RANGES.find(r => r.value === dateRange)?.label})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Calculate top payers from transactions
                const payerTotals: Record<string, { name: string; total: number; count: number }> = {};
                transactions.forEach(txn => {
                  const key = txn.member.username;
                  if (!payerTotals[key]) {
                    payerTotals[key] = { name: key, total: 0, count: 0 };
                  }
                  payerTotals[key].total += txn.amountPaid;
                  payerTotals[key].count += 1;
                });
                const topPayers = Object.values(payerTotals)
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 5);
                
                if (topPayers.length === 0) {
                  return <p className="text-muted-foreground text-sm">No transactions in this period</p>;
                }

                return (
                  <div className="space-y-3">
                    {topPayers.map((payer, idx) => (
                      <div key={payer.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-gray-100 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                            {idx + 1}
                          </span>
                          <span className="font-medium">{payer.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-semibold">{formatMoney(payer.total)}</p>
                          <p className="text-xs text-muted-foreground">{payer.count} payment{payer.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {selectedMethod === "all" ? "All Transactions" : `${PAYMENT_METHODS.find(m => m.value === selectedMethod)?.label} Transactions`}
              </CardTitle>
              <CardDescription>
                {selectedMethod !== "all" && (
                  <span className="font-semibold text-foreground">{formatMoney(totalAmount)}</span>
                )} {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            {transactions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Export to CSV
                  const headers = ["Date", "Member", "Amount", "Method", "Reference"];
                  const rows = transactions.map(txn => [
                    format(new Date(txn.paidOn), "yyyy-MM-dd"),
                    txn.member.username,
                    (txn.amountPaid / 100).toFixed(2),
                    txn.method,
                    txn.referenceNote || ""
                  ]);
                  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `payments-${selectedMethod}-${dateRange}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                data-testid="button-export-csv"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found{selectedMethod !== "all" ? ` for ${PAYMENT_METHODS.find(m => m.value === selectedMethod)?.label}` : ""}
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="space-y-3 md:hidden">
              {transactions.map((txn) => (
                <div 
                  key={txn.id} 
                  className="p-4 rounded-lg border bg-card"
                  data-testid={`card-transaction-${txn.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium">{txn.member.username}</p>
                      <p className="text-sm text-muted-foreground">{format(new Date(txn.paidOn), "dd MMM yyyy")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-lg">{formatMoney(txn.amountPaid)}</p>
                      <Badge variant="outline" className="capitalize mt-1">{txn.method}</Badge>
                    </div>
                  </div>
                  {txn.referenceNote && (
                    <p className="text-sm text-muted-foreground border-t pt-2 mt-2">{txn.referenceNote}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id} data-testid={`row-transaction-${txn.id}`}>
                      <TableCell>{format(new Date(txn.paidOn), "dd MMM yyyy")}</TableCell>
                      <TableCell className="font-medium">{txn.member.username}</TableCell>
                      <TableCell className="font-mono">{formatMoney(txn.amountPaid)}</TableCell>
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
          </>
        )}
        </CardContent>
      </Card>
    </div>
  );
}

function OutstandingPaymentsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: subscriptions = [], isLoading } = useQuery<SubscriptionWithDetails[]>({
    queryKey: ["/api/owner/subscriptions"]
  });

  const outstandingPayments = subscriptions.filter(sub => {
    const remaining = sub.totalAmount - sub.totalPaid;
    const isOutstanding = remaining > 0 && (sub.paymentMode === 'emi' || sub.paymentMode === 'partial');
    if (!isOutstanding) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return sub.member?.username?.toLowerCase().includes(query) ||
             sub.plan?.name?.toLowerCase().includes(query);
    }
    return true;
  }).sort((a, b) => (b.totalAmount - b.totalPaid) - (a.totalAmount - a.totalPaid));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Outstanding Payments (EMI/Partial)
            </CardTitle>
            <CardDescription>
              Members with pending balance on their subscriptions
            </CardDescription>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-outstanding-search"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {outstandingPayments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{searchQuery ? "No matching members found" : "All payments are complete! No outstanding balances."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {outstandingPayments.map((sub) => (
              <OutstandingPaymentCard key={sub.id} sub={sub} />
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
  const [paymentSourceFilter, setPaymentSourceFilter] = useState<string>("all");
  const { toast } = useToast();
  const { format: formatMoney } = useGymCurrency();
  
  const { data: subscriptions = [], isLoading } = useQuery<SubscriptionWithDetails[]>({
    queryKey: ["/api/owner/subscriptions"]
  });

  // Filter subscriptions based on status, search query, and payment source
  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = !searchQuery || 
      sub.member?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.plan?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Payment source filter
    if (paymentSourceFilter === 'owner') {
      // Only show subscriptions without member payments (all payments entered by owner)
      if (sub.hasMemberPayments) return false;
    } else if (paymentSourceFilter === 'member') {
      // Only show subscriptions that have member payments
      if (!sub.hasMemberPayments) return false;
    }
    
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
    totalAmountInput: z.coerce.number().min(0),
    paymentMode: z.enum(["full", "partial", "emi"]),
    notes: z.string().optional()
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startDate: format(new Date(), "yyyy-MM-dd"),
      durationMonths: 1,
      totalAmountInput: 1500,
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
      form.setValue("totalAmountInput", plan.priceAmount / 100);
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createSubMutation.mutate({
      memberId: data.memberId,
      planId: data.planId,
      startDate: data.startDate,
      durationMonths: data.durationMonths,
      totalAmount: data.totalAmountInput * 100,
      paymentMode: data.paymentMode,
      notes: data.notes
    });
  };

  const paymentFormSchema = z.object({
    paidOn: z.string().min(1),
    amountInput: z.coerce.number().min(1, "Amount must be at least 1"),
    method: z.enum(["cash", "venmo", "zelle", "cashapp", "card", "bank", "other"]),
    referenceNote: z.string().optional()
  });

  const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      paidOn: format(new Date(), "yyyy-MM-dd"),
      amountInput: 0,
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
        amountPaid: data.amountInput * 100,
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
                              {p.name} - {formatMoney(p.priceAmount)} / {p.durationMonths}mo
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
                    name="totalAmountInput"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Amount</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
        
        {/* Search Bar and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
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
          <Select value={paymentSourceFilter} onValueChange={setPaymentSourceFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-payment-source-filter">
              <SelectValue placeholder="Filter by payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="owner">Paid by me</SelectItem>
              <SelectItem value="member">Paid by members</SelectItem>
            </SelectContent>
          </Select>
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
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {filteredSubscriptions.map((sub) => {
                const remaining = sub.totalAmount - sub.totalPaid;
                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl border bg-card"
                    data-testid={`card-subscription-${sub.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {sub.member?.username?.slice(0, 2).toUpperCase() || '??'}
                        </div>
                        <div>
                          <p className="font-semibold">{sub.member?.username || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{sub.plan?.name || 'Custom Plan'}</p>
                        </div>
                      </div>
                      <SubscriptionStatusBadge status={sub.status} />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 py-3 border-y text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-mono text-sm font-medium">{formatMoney(sub.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Paid</p>
                        <p className="font-mono text-sm font-medium text-green-600 dark:text-green-400">{formatMoney(sub.totalPaid)}</p>
                        {sub.hasMemberPayments && (
                          <Badge className="mt-1 bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 shadow-none dark:bg-blue-900 dark:text-blue-300 text-xs px-1.5 py-0">
                            Member Paid
                          </Badge>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="font-mono text-sm font-medium text-red-600 dark:text-red-400">{formatMoney(remaining)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span>{sub.startDate} → {sub.endDate}</span>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedSub(sub);
                          paymentForm.reset({
                            paidOn: format(new Date(), "yyyy-MM-dd"),
                            amountInput: remaining / 100,
                            method: "cash",
                            referenceNote: ""
                          });
                          setPaymentOpen(true);
                        }}
                        data-testid={`button-add-payment-mobile-${sub.id}`}
                      >
                        <Receipt className="w-4 h-4 mr-1" /> Add Payment
                      </Button>
                      <TransactionsDialog subscriptionId={sub.id} memberName={sub.member?.username || 'Member'} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block rounded-md border border-border overflow-x-auto">
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
                        <TableCell className="font-mono">{formatMoney(sub.totalAmount)}</TableCell>
                        <TableCell>
                          <div className="font-mono text-green-600 dark:text-green-400">{formatMoney(sub.totalPaid)}</div>
                          {sub.hasMemberPayments && (
                            <Badge className="mt-1 bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 shadow-none dark:bg-blue-900 dark:text-blue-300 text-xs px-1.5 py-0">
                              Member Paid
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-red-600 dark:text-red-400">{formatMoney(remaining)}</TableCell>
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
                                  amountInput: remaining / 100,
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
          </>
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
                name="amountInput"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                        <SelectItem value="venmo">Venmo</SelectItem>
                        <SelectItem value="zelle">Zelle</SelectItem>
                        <SelectItem value="cashapp">CashApp</SelectItem>
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
  const { format: formatMoney } = useGymCurrency();
  
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
                  <TableHead>Entered By</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn: any) => (
                  <TableRow key={txn.id}>
                    <TableCell>{txn.paidOn}</TableCell>
                    <TableCell className="font-mono">{formatMoney(txn.amountPaid)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{txn.method}</Badge>
                    </TableCell>
                    <TableCell>
                      {txn.source === 'member' ? (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 shadow-none dark:bg-blue-900 dark:text-blue-300">
                          Member Paid
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Owner Entered
                        </Badge>
                      )}
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
  const { format: formatMoney } = useGymCurrency();
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
                <p className="text-xl font-bold" data-testid="text-total">{formatMoney(subscription.totalAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-paid">{formatMoney(subscription.totalPaid)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400" data-testid="text-balance">{formatMoney(remaining)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
