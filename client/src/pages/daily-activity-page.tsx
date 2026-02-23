import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useGymCurrency } from "@/hooks/use-gym-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Calendar,
  UserPlus,
  CreditCard,
  Clock,
  AlertTriangle,
  Users,
  Footprints,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Ticket,
  HelpCircle,
  Loader2,
} from "lucide-react";

type DailyActivityData = {
  date: string;
  newMembers: { id: number; username: string; createdAt: string }[];
  payments: { id: number; memberId: number; amountPaid: number; method: string; paidOn: string; memberName: string; notes: string | null }[];
  totalRevenue: number;
  expiringSubscriptions: { id: number; memberId: number; endDate: string; status: string; memberName: string; planName: string | null }[];
  endedSubscriptions: { id: number; memberId: number; endDate: string; status: string; memberName: string; planName: string | null }[];
  walkIns: { id: number; visitorName: string; phone: string | null; visitType: string; daysCount: number | null; amountPaid: number | null; paymentMethod: string | null }[];
  dayPasses: any[];
  trials: any[];
  enquiries: any[];
  walkInRevenue: number;
  attendance: { id: number; memberId: number; status: string; verifiedMethod: string | null; memberName: string }[];
  presentCount: number;
  absentCount: number;
  aiSummary: string | null;
};

function getLocalDateString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const todayStr = getLocalDateString(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function DailyActivityPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { format: formatMoney } = useGymCurrency();
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString(new Date()));

  const { data, isLoading } = useQuery<DailyActivityData>({
    queryKey: ["/api/owner/daily-activity", selectedDate],
    queryFn: async () => {
      const res = await fetch(`/api/owner/daily-activity?date=${selectedDate}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch daily activity');
      return res.json();
    },
    staleTime: 1000 * 60 * 2,
  });

  const goToPrevDay = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const prev = new Date(y, m - 1, d);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(getLocalDateString(prev));
  };

  const goToNextDay = () => {
    const todayStr = getLocalDateString(new Date());
    if (selectedDate >= todayStr) return;
    const [y, m, d] = selectedDate.split('-').map(Number);
    const next = new Date(y, m - 1, d);
    next.setDate(next.getDate() + 1);
    setSelectedDate(getLocalDateString(next));
  };

  const isToday = selectedDate === getLocalDateString(new Date());

  if (!user || user.role !== 'owner') {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/")} data-testid="button-back-dashboard">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold truncate" data-testid="text-daily-activity-title">Daily Activity</h1>
            <p className="text-xs text-muted-foreground" data-testid="text-selected-date">{formatDisplayDate(selectedDate)}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrevDay} data-testid="button-prev-day">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={selectedDate}
              max={getLocalDateString(new Date())}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-center cursor-pointer"
              data-testid="input-date-picker"
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNextDay} disabled={isToday} data-testid="button-next-day">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : data ? (
          <>
            {data.aiSummary && (
              <Card className="border-purple-500/30 bg-purple-500/5" data-testid="card-ai-summary">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-purple-500/15 shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">AI Daily Summary</p>
                      <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-ai-summary">{data.aiSummary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="Checked In" value={data.presentCount} color="emerald" testId="stat-checked-in" />
              <StatCard icon={<CreditCard className="w-4 h-4" />} label="Revenue" value={formatMoney(data.totalRevenue)} color="blue" testId="stat-revenue" />
              <StatCard icon={<UserPlus className="w-4 h-4" />} label="New Members" value={data.newMembers.length} color="green" testId="stat-new-members" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Expiring" value={data.expiringSubscriptions.length} color="amber" testId="stat-expiring" />
              <StatCard icon={<XCircle className="w-4 h-4" />} label="Ended" value={data.endedSubscriptions.length} color="red" testId="stat-ended" />
              <StatCard icon={<Footprints className="w-4 h-4" />} label="Walk-ins" value={data.walkIns.length} color="violet" testId="stat-walkins" />
            </div>

            {data.presentCount > 0 && (
              <ActivitySection
                title="Attendance"
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                count={data.presentCount}
                color="emerald"
                testId="section-attendance"
              >
                <div className="space-y-1.5">
                  {data.attendance.filter(a => a.status === 'present').map(a => (
                    <div key={a.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50" data-testid={`attendance-item-${a.id}`}>
                      <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {a.memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium flex-1 truncate">{a.memberName}</span>
                      <Badge variant="secondary" className="text-[10px] h-5">{a.verifiedMethod || 'manual'}</Badge>
                    </div>
                  ))}
                </div>
              </ActivitySection>
            )}

            {data.newMembers.length > 0 && (
              <ActivitySection
                title="New Members"
                icon={<UserPlus className="w-3.5 h-3.5" />}
                count={data.newMembers.length}
                color="green"
                testId="section-new-members"
              >
                <div className="space-y-1.5">
                  {data.newMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50" data-testid={`new-member-item-${m.id}`}>
                      <div className="w-7 h-7 rounded-full bg-green-500/15 flex items-center justify-center text-xs font-semibold text-green-600 dark:text-green-400 shrink-0">
                        {m.username.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium flex-1 truncate">{m.username}</span>
                      <Badge variant="secondary" className="text-[10px] h-5">Joined</Badge>
                    </div>
                  ))}
                </div>
              </ActivitySection>
            )}

            {data.payments.length > 0 && (
              <ActivitySection
                title={`Payments (${formatMoney(data.totalRevenue)})`}
                icon={<CreditCard className="w-3.5 h-3.5" />}
                count={data.payments.length}
                color="blue"
                testId="section-payments"
              >
                <div className="space-y-1.5">
                  {data.payments.map(p => (
                    <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50" data-testid={`payment-item-${p.id}`}>
                      <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        {p.memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.memberName}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{p.method}</p>
                      </div>
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">{formatMoney(p.amountPaid)}</span>
                    </div>
                  ))}
                </div>
              </ActivitySection>
            )}

            {data.expiringSubscriptions.length > 0 && (
              <ActivitySection
                title="Expiring Subscriptions"
                icon={<AlertTriangle className="w-3.5 h-3.5" />}
                count={data.expiringSubscriptions.length}
                color="amber"
                testId="section-expiring"
              >
                <div className="space-y-1.5">
                  {data.expiringSubscriptions.map(s => (
                    <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50" data-testid={`expiring-item-${s.id}`}>
                      <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                        {s.memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{s.memberName}</p>
                        <p className="text-[10px] text-muted-foreground">{s.planName || 'Custom plan'}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 border-amber-500/30 text-amber-600 dark:text-amber-400">Expiring</Badge>
                    </div>
                  ))}
                </div>
              </ActivitySection>
            )}

            {data.endedSubscriptions.length > 0 && (
              <ActivitySection
                title="Ended Subscriptions"
                icon={<XCircle className="w-3.5 h-3.5" />}
                count={data.endedSubscriptions.length}
                color="red"
                testId="section-ended"
              >
                <div className="space-y-1.5">
                  {data.endedSubscriptions.map(s => (
                    <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50" data-testid={`ended-item-${s.id}`}>
                      <div className="w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">
                        {s.memberName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{s.memberName}</p>
                        <p className="text-[10px] text-muted-foreground">{s.planName || 'Custom plan'}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 border-red-500/30 text-red-600 dark:text-red-400">Ended</Badge>
                    </div>
                  ))}
                </div>
              </ActivitySection>
            )}

            {data.walkIns.length > 0 && (
              <ActivitySection
                title="Walk-in Visitors"
                icon={<Footprints className="w-3.5 h-3.5" />}
                count={data.walkIns.length}
                color="violet"
                testId="section-walkins"
              >
                {data.dayPasses.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Ticket className="w-3 h-3" /> Day Passes ({data.dayPasses.length}) — {formatMoney(data.walkInRevenue)}
                    </p>
                    <div className="space-y-1.5">
                      {data.dayPasses.map((w: any) => (
                        <div key={w.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50" data-testid={`daypass-item-${w.id}`}>
                          <div className="w-7 h-7 rounded-full bg-violet-500/15 flex items-center justify-center text-xs font-semibold text-violet-600 dark:text-violet-400 shrink-0">
                            {w.visitorName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{w.visitorName}</p>
                            <p className="text-[10px] text-muted-foreground">{w.daysCount || 1} day{(w.daysCount || 1) > 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 shrink-0">{formatMoney(w.amountPaid || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.trials.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Trials ({data.trials.length})
                    </p>
                    <div className="space-y-1.5">
                      {data.trials.map((w: any) => (
                        <div key={w.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50" data-testid={`trial-item-${w.id}`}>
                          <div className="w-7 h-7 rounded-full bg-teal-500/15 flex items-center justify-center text-xs font-semibold text-teal-600 dark:text-teal-400 shrink-0">
                            {w.visitorName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium flex-1 truncate">{w.visitorName}</span>
                          <Badge variant="secondary" className="text-[10px] h-5">Trial</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.enquiries.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" /> Enquiries ({data.enquiries.length})
                    </p>
                    <div className="space-y-1.5">
                      {data.enquiries.map((w: any) => (
                        <div key={w.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-background/50" data-testid={`enquiry-item-${w.id}`}>
                          <div className="w-7 h-7 rounded-full bg-sky-500/15 flex items-center justify-center text-xs font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                            {w.visitorName.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium flex-1 truncate">{w.visitorName}</span>
                          <Badge variant="secondary" className="text-[10px] h-5">Enquiry</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ActivitySection>
            )}

            {!data.aiSummary && data.presentCount === 0 && data.newMembers.length === 0 && data.payments.length === 0 && data.walkIns.length === 0 && data.expiringSubscriptions.length === 0 && data.endedSubscriptions.length === 0 && (
              <Card className="card-elevated" data-testid="card-empty-state">
                <CardContent className="py-10 text-center">
                  <Calendar className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No activity on this day</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Try selecting a different date</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, testId }: { icon: React.ReactNode; label: string; value: string | number; color: string; testId: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400",
    green: "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    red: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
    violet: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
  };

  return (
    <div className={`text-center p-3 rounded-xl border ${colorMap[color] || colorMap.blue}`} data-testid={testId}>
      <div className="flex justify-center mb-1 opacity-70">{icon}</div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function ActivitySection({ title, icon, count, color, children, testId }: { title: string; icon: React.ReactNode; count: number; color: string; children: React.ReactNode; testId: string }) {
  const [expanded, setExpanded] = useState(true);

  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    green: "text-green-600 dark:text-green-400 bg-green-500/10",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    red: "text-red-600 dark:text-red-400 bg-red-500/10",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
  };

  const colorClass = colorMap[color] || colorMap.blue;

  return (
    <Card className="card-elevated" data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 pt-3 px-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <div className={`p-1.5 rounded-lg ${colorClass}`}>
            {icon}
          </div>
          {title}
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-7 text-xs" data-testid={`button-toggle-${testId}`}>
          {expanded ? "Hide" : "Show"} ({count})
        </Button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
