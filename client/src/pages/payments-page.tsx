import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, usePayments, useMemberPayments, useMarkPayment } from "@/hooks/use-gym";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Filter } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";

export default function PaymentsPage() {
  const { user } = useAuth();
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  
  const isOwner = user?.role === 'owner';
  
  const { data: gymPayments = [], isLoading: gymLoading } = usePayments();
  const { data: myPayments = [], isLoading: myLoading } = useMemberPayments();

  const paymentsList = (isOwner ? gymPayments : myPayments) as any[];
  const isLoading = isOwner ? gymLoading : myLoading;
  
  const filteredPayments = isOwner 
    ? paymentsList.filter((p: any) => p.month === monthFilter)
    : paymentsList;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Payments</h2>
          <p className="text-muted-foreground mt-1">
            {isOwner ? 'Manage invoices and track revenue.' : 'View your payment history.'}
          </p>
        </div>
        {isOwner && <RecordPaymentDialog />}
      </div>

      <Card className="dashboard-card">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Payment History</CardTitle>
            {isOwner && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Input 
                  type="month" 
                  value={monthFilter} 
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-40 h-8 text-sm"
                  data-testid="input-month-filter"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  {isOwner && <TableHead>Member</TableHead>}
                  <TableHead>Month</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Amount Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No payment records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment: any) => (
                    <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                      {isOwner && (
                        <TableCell className="font-medium">
                          {payment.member?.username || 'Unknown'}
                        </TableCell>
                      )}
                      <TableCell>{payment.month}</TableCell>
                      <TableCell className="font-mono">
                        ${((payment.amountPaid || 0) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        ${(payment.amountDue / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                        {payment.note || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 shadow-none dark:bg-green-900 dark:text-green-300">Paid</Badge>;
    case 'partial':
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200 shadow-none dark:bg-yellow-900 dark:text-yellow-300">Partial</Badge>;
    case 'unpaid':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 shadow-none dark:bg-red-900 dark:text-red-300">Unpaid</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function RecordPaymentDialog() {
  const [open, setOpen] = useState(false);
  const { data: members = [] } = useMembers();
  const paymentMutation = useMarkPayment();
  
  const membersList = members as any[];
  
  const formSchema = z.object({
    memberId: z.coerce.number().min(1, "Select a member"),
    month: z.string().min(1, "Month is required"),
    amountDue: z.coerce.number().min(0),
    amountPaid: z.coerce.number().min(0),
    status: z.enum(["paid", "unpaid", "partial"]),
    note: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "paid",
      month: format(new Date(), "yyyy-MM"),
      amountDue: 5000,
      amountPaid: 5000,
      note: ""
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    paymentMutation.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20" data-testid="button-record-payment">
          <DollarSign className="w-4 h-4 mr-2" /> Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="memberId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-member">
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {membersList.filter(m => m.role === 'member').map((m: any) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.username}
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
              name="month"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Month</FormLabel>
                  <FormControl>
                    <Input type="month" {...field} data-testid="input-billing-month" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amountDue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Due (cents)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-amount-due" />
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
                    <FormLabel>Amount Paid (cents)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-amount-paid" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payment-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (Optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Cash payment" data-testid="input-payment-note" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={paymentMutation.isPending} data-testid="button-submit-payment">
                {paymentMutation.isPending ? "Saving..." : "Save Record"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
