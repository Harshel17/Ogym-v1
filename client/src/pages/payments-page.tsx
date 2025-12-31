import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMembers, usePayments, useMarkPayment } from "@/hooks/use-gym";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, Filter } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";

export default function PaymentsPage() {
  const { user } = useAuth();
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  
  // Filter logic
  const filters = user?.role === 'member' 
    ? { memberId: user.id } 
    : { month: monthFilter };

  const { data: payments = [], isLoading } = usePayments(filters);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Payments</h2>
          <p className="text-muted-foreground mt-1">Manage invoices and track revenue.</p>
        </div>
        {user?.role === 'owner' && <RecordPaymentDialog />}
      </div>

      <Card className="dashboard-card">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle>Payment History</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Input 
                type="month" 
                value={monthFilter} 
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-40 h-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Member</TableHead>
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
                ) : payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No payment records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">
                        {payment.member.username}
                      </TableCell>
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
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 shadow-none">Paid</Badge>;
    case 'partial':
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200 shadow-none">Partial</Badge>;
    case 'unpaid':
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 shadow-none">Unpaid</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function RecordPaymentDialog() {
  const [open, setOpen] = useState(false);
  const { data: members = [] } = useMembers();
  const paymentMutation = useMarkPayment();
  
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
      amountDue: 5000, // Default $50.00 (in cents)
      amountPaid: 5000,
      note: ""
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // Amounts are already numbers from z.coerce, but input might be dollars.
    // The Schema expects integer (cents). 
    // Wait, the input is likely users typing "50". We need to handle this.
    // Let's assume input is in CENTS for simplicity or dollars? 
    // Real app would use a currency input. Let's assume user inputs standard integer dollars for now, 
    // but the schema stores cents? The prompt says "amountDue: integer". 
    // Let's assume the form inputs are raw numbers matching schema storage for MVP simplicity.
    // Actually, let's treat input as dollars and multiply by 100 for storage to be proper.
    
    // NOTE: For this generation, I will treat the input as CENTS directly to match the schema strictly without complex conversion logic risks.
    // Ideally: input type="number" step="0.01" -> convert to cents.
    
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
        <Button className="shadow-lg shadow-primary/20">
          <DollarSign className="w-4 h-4 mr-2" /> Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {members.filter(m => m.role === 'member').map((m) => (
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
                    <Input type="month" {...field} />
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
                      <Input type="number" {...field} />
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
                      <Input type="number" {...field} />
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
                      <SelectTrigger>
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
                    <Input {...field} placeholder="e.g. Cash payment" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={paymentMutation.isPending}>
                {paymentMutation.isPending ? "Saving..." : "Save Record"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
