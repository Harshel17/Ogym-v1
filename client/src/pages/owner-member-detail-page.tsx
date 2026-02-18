import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Dumbbell, Calendar, TrendingUp, Flame, Target, BarChart3, Banknote, CreditCard, Receipt } from "lucide-react";
import { useGymCurrency } from "@/hooks/use-gym-currency";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { format, parseISO } from "date-fns";
import { useBackNavigation } from "@/hooks/use-back-navigation";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { isNative, isIOS } from "@/lib/capacitor-init";

type MemberProfile = {
  id: number;
  username: string;
  publicId: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  trainer: { id: number; publicId: string; username: string } | null;
  cycle: { id: number; name: string; endDate: string } | null;
  membershipStatus: 'active' | 'inactive' | 'expired';
  subscriptionEndDate: string | null;
  profile: {
    fullName: string;
    gender: string;
    dob: string;
    age: number | null;
    address: string | null;
    emergencyContact: string | null;
  } | null;
};

type WorkoutSession = {
  date: string;
  title: string;
  exercises: {
    completionId: number;
    exerciseName: string;
    muscleType: string;
    sets: number;
    reps: number;
    weight: string | null;
    actualSets: number | null;
    actualReps: number | null;
    actualWeight: string | null;
    notes: string | null;
  }[];
};

type MemberStats = {
  streak: number;
  totalWorkouts: number;
  last7Days: number;
  thisMonth: number;
  muscleGroupBreakdown: { name: string; count: number; percentage: number }[];
  volumeStats: { totalSets: number; totalReps: number; totalVolume: number };
  weeklyTrend: { week: string; count: number }[];
  progress: {
    exerciseName: string;
    muscleType: string;
    history: { date: string; weight: string | null; reps: number | null }[];
    personalRecord: { weight: string | null; reps: number | null; date: string } | null;
  }[];
};

type PaymentDetails = {
  subscription: {
    id: number;
    memberId: number;
    gymId: number;
    planId: number | null;
    startDate: string;
    endDate: string;
    totalAmount: number;
    status: string;
    paymentMode: string;
    plan: { id: number; name: string; durationMonths: number; priceAmount: number } | null;
  } | null;
  totalPaid: number;
  remainingBalance: number;
  transactions: {
    id: number;
    subscriptionId: number;
    amountPaid: number;
    paidOn: string;
    method: string;
    referenceNote: string | null;
  }[];
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

export default function OwnerMemberDetailPage() {
  const params = useParams<{ memberId: string }>();
  const memberId = parseInt(params.memberId || "0");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { format: formatMoney } = useGymCurrency();
  const isIOSNativeApp = isNative() && isIOS();

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<MemberProfile>({
    queryKey: ["/api/owner/members", memberId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: workouts = [], isLoading: workoutsLoading } = useQuery<WorkoutSession[]>({
    queryKey: ["/api/owner/members", memberId, "workouts"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/workouts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch workouts");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: stats, isLoading: statsLoading } = useQuery<MemberStats>({
    queryKey: ["/api/owner/members", memberId, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!memberId
  });

  const { data: sessionDetail } = useQuery<WorkoutSession>({
    queryKey: ["/api/owner/members", memberId, "workouts", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/workouts/${selectedDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch session");
      return res.json();
    },
    enabled: !!selectedDate
  });

  const { data: paymentDetails, isLoading: paymentsLoading } = useQuery<PaymentDetails>({
    queryKey: ["/api/owner/members", memberId, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/owner/members/${memberId}/payments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
    enabled: !!memberId
  });

  const { goBack } = useBackNavigation();

  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <p className="text-lg text-muted-foreground">Member not found or access denied</p>
        <Button variant="outline" className="mt-4" onClick={goBack}>Back</Button>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = stats?.progress || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" data-testid="button-back" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{profile?.username}</h2>
          <p className="text-sm text-muted-foreground">{profile?.publicId || "No ID"}</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
          {!isIOSNativeApp && <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>}
          <TabsTrigger value="workouts" data-testid="tab-workouts">Workouts</TabsTrigger>
          <TabsTrigger value="stats" data-testid="tab-stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Member Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="font-medium">{profile?.username}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Public ID</p>
                  <p className="font-medium">{profile?.publicId || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile?.email || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile?.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trainer</p>
                  <p className="font-medium">{profile?.trainer?.username || "Not assigned"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Cycle</p>
                  <p className="font-medium">{profile?.cycle?.name || "None"}</p>
                </div>
                {isIOSNativeApp ? (
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge 
                    variant={profile?.membershipStatus === 'active' ? 'default' : 'secondary'}
                    data-testid="badge-membership-status"
                  >
                    {profile?.membershipStatus === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge 
                    variant={profile?.membershipStatus === 'active' ? 'default' : profile?.membershipStatus === 'expired' ? 'destructive' : 'secondary'}
                    data-testid="badge-membership-status"
                  >
                    {profile?.membershipStatus === 'active' ? 'Active' : profile?.membershipStatus === 'expired' ? 'Expired' : 'Inactive'}
                  </Badge>
                </div>
                )}
                {profile?.subscriptionEndDate && !isIOSNativeApp && (
                  <div>
                    <p className="text-sm text-muted-foreground">Expires On</p>
                    <p className="font-medium" data-testid="text-expires-on">
                      {format(new Date(profile.subscriptionEndDate), "dd MMM yyyy")}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {profile?.profile && (
            <Card>
              <CardHeader>
                <CardTitle>Onboarding Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{profile.profile.fullName}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p className="font-medium capitalize">{profile.profile.gender?.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">
                      {profile.profile.dob ? format(new Date(profile.profile.dob), "dd MMM yyyy") : "-"}
                      {profile.profile.age && ` (${profile.profile.age} years)`}
                    </p>
                  </div>
                  {profile.profile.address && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{profile.profile.address}</p>
                    </div>
                  )}
                  {profile.profile.emergencyContact && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Emergency Contact</p>
                      <p className="font-medium">{profile.profile.emergencyContact}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-4">
          {paymentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !paymentDetails?.subscription ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active subscription</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5" />
                    Subscription Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Plan</p>
                      <p className="font-medium" data-testid="text-member-plan">
                        {paymentDetails.subscription.plan?.name || 'Custom Plan'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-medium">
                        {paymentDetails.subscription.plan?.durationMonths || 1} month{(paymentDetails.subscription.plan?.durationMonths || 1) > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge 
                        variant={paymentDetails.subscription.status === 'active' ? 'default' : 
                                paymentDetails.subscription.status === 'endingSoon' ? 'secondary' : 'destructive'}
                        data-testid="badge-subscription-status"
                      >
                        {paymentDetails.subscription.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Payment Mode</p>
                      <Badge variant="outline" className="capitalize">
                        {paymentDetails.subscription.paymentMode}
                      </Badge>
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-sm text-muted-foreground mb-2">
                      {format(new Date(paymentDetails.subscription.startDate), "dd MMM yyyy")} - {format(new Date(paymentDetails.subscription.endDate), "dd MMM yyyy")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount</span>
                    <span className="font-semibold">{formatMoney(paymentDetails.subscription.totalAmount)}</span>
                  </div>
                  <Progress 
                    value={paymentDetails.subscription.totalAmount > 0 
                      ? Math.round((paymentDetails.totalPaid / paymentDetails.subscription.totalAmount) * 100) 
                      : 100} 
                    className="h-3"
                  />
                  <div className="flex justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Paid</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400" data-testid="text-total-paid">
                        {formatMoney(paymentDetails.totalPaid)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Remaining</p>
                      <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-remaining-balance">
                        {formatMoney(paymentDetails.remainingBalance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Payment History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentDetails.transactions.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No payments recorded yet
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Reference</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paymentDetails.transactions.map((txn) => (
                            <TableRow key={txn.id} data-testid={`row-payment-${txn.id}`}>
                              <TableCell>{format(new Date(txn.paidOn), "dd MMM yyyy")}</TableCell>
                              <TableCell className="font-medium">{formatMoney(txn.amountPaid)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">{txn.method}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{txn.referenceNote || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="workouts" className="mt-4">
          {workoutsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : workouts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No workout history
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {workouts.map((session) => (
                <Card 
                  key={session.date} 
                  className="cursor-pointer hover-elevate"
                  onClick={() => setSelectedDate(session.date)}
                  data-testid={`session-${session.date}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Dumbbell className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{session.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(session.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{session.exercises.length} exercises</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="mt-4 space-y-6">
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      <span className="text-sm text-muted-foreground">Streak</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{stats?.streak || 0} days</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-blue-500" />
                      <span className="text-sm text-muted-foreground">Total</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{stats?.totalWorkouts || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-green-500" />
                      <span className="text-sm text-muted-foreground">Last 7 Days</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{stats?.last7Days || 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-purple-500" />
                      <span className="text-sm text-muted-foreground">This Month</span>
                    </div>
                    <p className="text-2xl font-bold mt-2">{stats?.thisMonth || 0}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Weekly Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats?.weeklyTrend || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="week" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Muscle Group Focus</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats?.muscleGroupBreakdown || []}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={70}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, name, percentage }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = outerRadius + 25;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="hsl(var(--foreground))"
                                  textAnchor={x > cx ? 'start' : 'end'}
                                  dominantBaseline="central"
                                  fontSize={11}
                                >
                                  {`${name} ${percentage}%`}
                                </text>
                              );
                            }}
                            labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                          >
                            {(stats?.muscleGroupBreakdown || []).map((_, idx) => (
                              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {progress.length > 0 && progress.some(p => p.personalRecord) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Records</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {progress
                        .filter(p => p.personalRecord)
                        .slice(0, 6)
                        .map((p) => (
                          <div key={p.exerciseName} className="p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium text-sm">{p.exerciseName}</p>
                            <p className="text-xs text-muted-foreground mb-1">{p.muscleType}</p>
                            <p className="text-lg font-bold">
                              {p.personalRecord?.weight || "-"} kg x {p.personalRecord?.reps || "-"}
                            </p>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {sessionDetail?.title || "Workout Session"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedDate && format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {sessionDetail?.exercises.map((exercise, idx) => (
              <div key={idx} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium">{exercise.exerciseName}</p>
                    <Badge variant="outline" className="text-xs">{exercise.muscleType}</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm mt-3">
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground text-xs">Sets</p>
                    <p className="font-medium">{exercise.actualSets ?? exercise.sets}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground text-xs">Reps</p>
                    <p className="font-medium">{exercise.actualReps ?? exercise.reps}</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded text-center">
                    <p className="text-muted-foreground text-xs">Weight</p>
                    <p className="font-medium">{exercise.actualWeight || exercise.weight || "-"}</p>
                  </div>
                </div>
                {exercise.notes && (
                  <p className="text-sm text-muted-foreground mt-2 italic">Note: {exercise.notes}</p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
