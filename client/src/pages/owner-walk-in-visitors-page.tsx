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
import { UserPlus, Plus, Users, Calendar, IndianRupee, TrendingUp, Phone, Mail, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type WalkInVisitor = {
  id: number;
  gymId: number;
  name: string;
  phone: string;
  email: string | null;
  visitDate: string;
  visitType: "day_pass" | "trial" | "enquiry";
  daysCount: number | null;
  amountPaid: number | null;
  notes: string | null;
  source: "owner" | "trainer" | "kiosk" | null;
  convertedToMember: boolean | null;
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

  const formatAmount = (paise: number | null) => {
    if (!paise) return "-";
    return `₹${(paise / 100).toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Walk-in Visitors</h2>
          <p className="text-muted-foreground mt-1">Track day pass visitors, trials, and enquiries</p>
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
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayCount}</div>
              <p className="text-xs text-muted-foreground">visitors today</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weekCount}</div>
              <p className="text-xs text-muted-foreground">visitors this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(stats.todayRevenue)}</div>
              <p className="text-xs text-muted-foreground">from walk-ins</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">became members</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Recent Visitors</CardTitle>
              <CardDescription>All walk-in visitors and their details</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-40"
                data-testid="filter-date"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32" data-testid="filter-type">
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
        <CardContent>
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
            <div className="space-y-4">
              {visitors.map((visitor) => (
                <div key={visitor.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`visitor-card-${visitor.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium truncate">{visitor.name}</h4>
                      {getVisitTypeBadge(visitor.visitType)}
                      {visitor.source === "kiosk" && (
                        <Badge variant="secondary" className="text-xs">Self Check-in</Badge>
                      )}
                      {visitor.convertedToMember && (
                        <Badge variant="outline" className="text-green-600 border-green-600">Converted</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {visitor.phone}
                      </span>
                      {visitor.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {visitor.email}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(visitor.visitDate), "MMM d, yyyy")}
                      </span>
                      {visitor.daysCount && visitor.daysCount > 1 && (
                        <span>{visitor.daysCount} days</span>
                      )}
                    </div>
                    {visitor.notes && (
                      <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {visitor.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-semibold">{formatAmount(visitor.amountPaid)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
