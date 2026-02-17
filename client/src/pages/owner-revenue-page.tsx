import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, Banknote, Users, Calendar, Loader2, ChevronLeft, ChevronRight, Wallet, ArrowLeft, UserPlus, CalendarDays, ArrowRight } from "lucide-react";
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

type DailyBreakdown = {
  days: {
    date: string;
    dayName: string;
    membershipRevenue: number;
    dayPassRevenue: number;
    totalRevenue: number;
    transactionCount: number;
  }[];
};

type DayTransactions = {
  membershipTransactions: (PaymentTransaction & { member: User })[];
  dayPassTransactions: {
    id: number;
    visitorName: string;
    email: string;
    amountPaid: number;
    visitDate: string;
    paymentMethod: string | null;
  }[];
};

export default function OwnerRevenuePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
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

  // Walk-in/day pass revenue for the month
  const { data: walkInData } = useQuery<{
    monthlyRevenue: number;
    monthlyCount: number;
  }>({
    queryKey: ["/api/owner/walk-in-revenue", monthStr],
    queryFn: async () => {
      const res = await fetch(`/api/owner/walk-in-revenue?month=${monthStr}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch walk-in revenue");
      return res.json();
    }
  });

  // Daily revenue breakdown
  const { data: dailyData, isLoading: dailyLoading } = useQuery<DailyBreakdown>({
    queryKey: ["/api/owner/revenue/daily", monthStr],
    queryFn: async () => {
      const res = await fetch(`/api/owner/revenue/daily?month=${monthStr}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch daily revenue");
      return res.json();
    },
    enabled: showDailyModal
  });

  // Day transactions
  const { data: dayTransactions, isLoading: dayTxnLoading } = useQuery<DayTransactions>({
    queryKey: ["/api/owner/revenue/day", selectedDayDate],
    queryFn: async () => {
      const res = await fetch(`/api/owner/revenue/day/${selectedDayDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch day transactions");
      return res.json();
    },
    enabled: !!selectedDayDate
  });

  // Filter days with revenue
  const daysWithRevenue = dailyData?.days?.filter(d => d.totalRevenue > 0) || [];

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
          <h1 className="text-2xl font-bold font-display">Revenue Analytics</h1>
          <p className="text-sm text-muted-foreground">Track your gym's payment collections</p>
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
        <h2 className="text-lg font-semibold min-w-[160px] text-center">
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              Day Passes
            </CardTitle>
            <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-full text-blue-700 dark:text-blue-300">
              <UserPlus className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-800 dark:text-blue-200" data-testid="text-daypass-revenue">
              {formatMoney(walkInData?.monthlyRevenue || 0)}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              {walkInData?.monthlyCount || 0} walk-ins this month
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800"
          onClick={() => setShowDailyModal(true)}
          data-testid="card-day-analytics"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wider">
              Day Analytics
            </CardTitle>
            <div className="p-2 bg-orange-200 dark:bg-orange-800 rounded-full text-orange-700 dark:text-orange-300">
              <CalendarDays className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-800 dark:text-orange-200" data-testid="text-days-with-revenue">
              {daysWithRevenue.length}
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
              Days with revenue - tap to view
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

      {/* Daily Revenue Breakdown Modal */}
      <Dialog open={showDailyModal && !selectedDayDate} onOpenChange={(open) => {
        setShowDailyModal(open);
        if (!open) setSelectedDayDate(null);
      }}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Daily Revenue - {format(selectedDate, 'MMMM yyyy')}
            </DialogTitle>
            <DialogDescription>
              Tap a day to see transactions
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {dailyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : daysWithRevenue.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No revenue recorded this month</p>
              </div>
            ) : (
              <div className="space-y-2">
                {daysWithRevenue.map((day) => (
                  <div 
                    key={day.date}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover-elevate"
                    onClick={() => setSelectedDayDate(day.date)}
                    data-testid={`row-day-${day.date}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center text-sm font-bold text-orange-600 dark:text-orange-400">
                        {format(new Date(day.date), 'd')}
                      </div>
                      <div>
                        <p className="font-medium">{format(new Date(day.date), 'EEE, MMM d')}</p>
                        <p className="text-xs text-muted-foreground">{day.transactionCount} transaction{day.transactionCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {formatMoney(day.totalRevenue)}
                      </span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Day Transactions Modal */}
      <Dialog open={!!selectedDayDate} onOpenChange={(open) => {
        if (!open) setSelectedDayDate(null);
      }}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {selectedDayDate && format(new Date(selectedDayDate), 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              All transactions on this day
            </DialogDescription>
          </DialogHeader>
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute left-4 top-4"
            onClick={() => setSelectedDayDate(null)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <ScrollArea className="h-[400px] pr-4 mt-2">
            {dayTxnLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Membership Payments */}
                {dayTransactions?.membershipTransactions && dayTransactions.membershipTransactions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Member Payments ({dayTransactions.membershipTransactions.length})
                    </h4>
                    <div className="space-y-2">
                      {dayTransactions.membershipTransactions.map((txn) => (
                        <div 
                          key={txn.id}
                          className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                          data-testid={`txn-member-${txn.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-xs font-bold text-green-700 dark:text-green-300">
                              {txn.member?.username?.slice(0, 2).toUpperCase() || '??'}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{txn.member?.username || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground capitalize">{txn.method}</p>
                            </div>
                          </div>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            {formatMoney(txn.amountPaid)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day Pass Payments */}
                {dayTransactions?.dayPassTransactions && dayTransactions.dayPassTransactions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Day Passes ({dayTransactions.dayPassTransactions.length})
                    </h4>
                    <div className="space-y-2">
                      {dayTransactions.dayPassTransactions.map((txn) => (
                        <div 
                          key={txn.id}
                          className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                          data-testid={`txn-daypass-${txn.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">
                              {txn.visitorName?.slice(0, 2).toUpperCase() || '??'}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{txn.visitorName}</p>
                              <p className="text-xs text-muted-foreground">{txn.email}</p>
                            </div>
                          </div>
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {formatMoney(txn.amountPaid)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No transactions */}
                {(!dayTransactions?.membershipTransactions?.length && !dayTransactions?.dayPassTransactions?.length) && !dayTxnLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Banknote className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No transactions on this day</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
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
