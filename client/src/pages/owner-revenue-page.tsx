import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TrendingUp, Banknote, Users, Calendar, Loader2, ChevronLeft, ChevronRight, Wallet, ArrowLeft } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useGymCurrency } from "@/hooks/use-gym-currency";
import type { PaymentTransaction, User } from "@shared/schema";

type RevenueData = {
  monthlyRevenue: number;
  totalTransactions: number;
  uniquePayers: number;
  transactions: (PaymentTransaction & { member: User })[];
  monthlyBreakdown: { month: string; revenue: number }[];
};

export default function OwnerRevenuePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTotalModal, setShowTotalModal] = useState(false);
  const monthStr = format(selectedDate, 'yyyy-MM');
  const { format: formatMoney, symbol } = useGymCurrency();

  const { data: revenueData, isLoading } = useQuery<RevenueData>({
    queryKey: ["/api/owner/revenue", monthStr],
    queryFn: async () => {
      const res = await fetch(`/api/owner/revenue?month=${monthStr}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch revenue data");
      return res.json();
    }
  });

  // Calculate total revenue from all months in breakdown
  const totalAllTime = revenueData?.monthlyBreakdown?.reduce((sum, m) => sum + m.revenue, 0) || 0;

  const goToPreviousMonth = () => setSelectedDate(subMonths(selectedDate, 1));
  const goToNextMonth = () => setSelectedDate(addMonths(selectedDate, 1));
  const isCurrentMonth = format(selectedDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const { goBack } = useBackNavigation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Revenue Analytics</h1>
          <p className="text-muted-foreground">Track your gym's payment collections</p>
        </div>
        <Button variant="outline" data-testid="button-back-dashboard" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={goToPreviousMonth} data-testid="button-prev-month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold min-w-[160px] text-center">
          {format(selectedDate, 'MMMM yyyy')}
        </h2>
        <Button 
          variant="outline" 
          size="icon" 
          onClick={goToNextMonth} 
          disabled={isCurrentMonth}
          data-testid="button-next-month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">
              Monthly Revenue
            </CardTitle>
            <div className="p-2 bg-green-200 dark:bg-green-800 rounded-full text-green-700 dark:text-green-300">
              <Banknote className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-800 dark:text-green-200" data-testid="text-monthly-revenue">
              {formatMoney(revenueData?.monthlyRevenue || 0)}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Total collected in {format(selectedDate, 'MMMM')}
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/30 border-indigo-200 dark:border-indigo-800"
          onClick={() => setShowTotalModal(true)}
          data-testid="card-total-revenue"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
              Last 6 Months
            </CardTitle>
            <div className="p-2 bg-indigo-200 dark:bg-indigo-800 rounded-full text-indigo-700 dark:text-indigo-300">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-800 dark:text-indigo-200" data-testid="text-total-revenue">
              {formatMoney(totalAllTime)}
            </div>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
              Click to view breakdown
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Transactions
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-transaction-count">
              {revenueData?.totalTransactions || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payment transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Unique Payers
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-full text-primary">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-unique-payers">
              {revenueData?.uniquePayers || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Members who paid
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showTotalModal} onOpenChange={setShowTotalModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Monthly Revenue Breakdown
            </DialogTitle>
            <DialogDescription>
              Revenue collected each month (last 6 months)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {revenueData?.monthlyBreakdown?.map((item, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                data-testid={`row-month-revenue-${index}`}
              >
                <span className="font-medium">{item.month}</span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {formatMoney(item.revenue)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg border-2 border-indigo-300 dark:border-indigo-700">
              <span className="font-bold">Total</span>
              <span className="font-bold text-indigo-700 dark:text-indigo-300 text-lg">
                {formatMoney(totalAllTime)}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {revenueData?.monthlyBreakdown && revenueData.monthlyBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>6-Month Revenue Trend</CardTitle>
            <CardDescription>Revenue collected over the past 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData.monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis 
                  tickFormatter={(value) => formatMoney(value)}
                  className="text-xs"
                />
                <Tooltip 
                  formatter={(value: number) => [formatMoney(value), 'Revenue']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payment History - {format(selectedDate, 'MMMM yyyy')}
          </CardTitle>
          <CardDescription>
            All payments received this month
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!revenueData?.transactions || revenueData.transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payments recorded for {format(selectedDate, 'MMMM yyyy')}</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {revenueData.transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="p-4 rounded-xl border bg-card"
                    data-testid={`card-transaction-${txn.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-bold text-green-600 shrink-0">
                          {txn.member?.username?.slice(0, 2).toUpperCase() || '??'}
                        </div>
                        <div>
                          <p className="font-semibold">{txn.member?.username || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(txn.paidOn), "dd MMM yyyy")}
                          </p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400 shrink-0">
                        {formatMoney(txn.amountPaid)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t">
                      <Badge variant="outline" className="capitalize text-xs">
                        {txn.method}
                      </Badge>
                      {txn.referenceNote && (
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                          {txn.referenceNote}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
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
                    {revenueData.transactions.map((txn) => (
                      <TableRow key={txn.id} data-testid={`row-transaction-${txn.id}`}>
                        <TableCell className="font-medium">
                          {format(new Date(txn.paidOn), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>{txn.member?.username || 'Unknown'}</TableCell>
                        <TableCell className="font-semibold text-green-600 dark:text-green-400">
                          {formatMoney(txn.amountPaid)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {txn.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
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
