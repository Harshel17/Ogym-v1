import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Footprints, Heart, Dumbbell, QrCode, Clock, TrendingUp, Shield, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

type PropertyAnalytics = {
  topCards: {
    totalResidents: number;
    activeResidentsThisWeek: number;
    gymVisitsThisWeek: number;
    avgRecoveryScore: number;
    workoutsLoggedThisWeek: number;
  };
  charts: {
    dailyVisits: { day: string; visits: number }[];
    timeOfDay: { label: string; percent: number }[];
    engagementTrend: { week: string; users: number }[];
  };
  residentActivity: {
    id: number;
    name: string;
    workoutsThisWeek: number;
    lastVisit: string;
    recoveryScore: number | null;
  }[];
  amenityEngagement: {
    residentsUsingGym: number;
    avgWeeklyVisits: number;
  };
  accessLog: { name: string; time: string; date: string }[];
};

const propertyLabels: Record<string, { title: string; subtitle: string; membersLabel: string }> = {
  apartment: { title: "Community Fitness", subtitle: "Resident Wellness Dashboard", membersLabel: "Residents" },
  recreation_center: { title: "Recreation Center", subtitle: "Member Engagement Dashboard", membersLabel: "Members" },
  corporate: { title: "Corporate Wellness", subtitle: "Employee Fitness Dashboard", membersLabel: "Employees" },
  society: { title: "Society Fitness", subtitle: "Member Wellness Dashboard", membersLabel: "Members" },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function PropertyManagerDashboard({ propertyName, propertyType }: { propertyName: string; propertyType: string }) {
  const labels = propertyLabels[propertyType] || propertyLabels.apartment;
  const [showAllResidents, setShowAllResidents] = useState(false);

  const { data, isLoading } = useQuery<PropertyAnalytics>({
    queryKey: ["/api/owner/property-analytics"],
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-24 bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-48 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const { topCards, charts, residentActivity, amenityEngagement, accessLog } = data;
  const maxDailyVisit = Math.max(...charts.dailyVisits.map(d => d.visits), 1);
  const maxEngagement = Math.max(...charts.engagementTrend.map(e => e.users), 1);
  const displayedResidents = showAllResidents ? residentActivity : residentActivity.slice(0, 8);

  return (
    <div className="space-y-4" data-testid="property-manager-dashboard">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-5 text-white" data-testid="property-header">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-property-name">{propertyName}</h1>
            <p className="text-xs text-white/50">{labels.subtitle}</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mt-3">{getGreeting()}! Here's how your fitness amenity is performing this week.</p>
      </div>

      <div className="grid grid-cols-2 gap-3" data-testid="top-cards">
        <StatCard icon={Users} label={`Total ${labels.membersLabel}`} value={topCards.totalResidents} color="bg-blue-500/10 text-blue-500" testId="stat-total-residents" />
        <StatCard icon={Users} label="Active This Week" value={topCards.activeResidentsThisWeek} color="bg-emerald-500/10 text-emerald-500" testId="stat-active-residents" />
        <StatCard icon={Footprints} label="Gym Visits" value={topCards.gymVisitsThisWeek} color="bg-purple-500/10 text-purple-500" testId="stat-gym-visits" />
        <StatCard icon={Heart} label="Avg Recovery" value={topCards.avgRecoveryScore} suffix="/100" color="bg-rose-500/10 text-rose-500" testId="stat-recovery" />
        <StatCard icon={Dumbbell} label="Workouts Logged" value={topCards.workoutsLoggedThisWeek} color="bg-amber-500/10 text-amber-500" testId="stat-workouts" className="col-span-2" />
      </div>

      <Card className="overflow-hidden" data-testid="chart-weekly-usage">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Footprints className="w-4 h-4 text-muted-foreground" />
            Weekly Gym Usage
          </h3>
          <div className="flex items-end gap-2 h-32">
            {charts.dailyVisits.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums text-foreground">{d.visits}</span>
                <div className="w-full rounded-t-md bg-indigo-500/80 transition-all duration-500" style={{ height: `${Math.max((d.visits / maxDailyVisit) * 100, 4)}%` }} />
                <span className="text-[10px] text-muted-foreground font-medium">{d.day}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {charts.timeOfDay.length > 0 && (
        <Card data-testid="chart-time-of-day">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Peak Hours
            </h3>
            <div className="space-y-2.5">
              {charts.timeOfDay.map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-36 shrink-0">{t.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" style={{ width: `${t.percent}%` }} />
                  </div>
                  <span className="text-xs font-bold tabular-nums w-10 text-right">{t.percent}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="chart-engagement-trend">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Engagement Trend
          </h3>
          <div className="flex items-end gap-3 h-28">
            {charts.engagementTrend.map((e, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums">{e.users}</span>
                <div className="w-full rounded-t-md transition-all duration-500" style={{
                  height: `${Math.max((e.users / maxEngagement) * 100, 4)}%`,
                  background: i === charts.engagementTrend.length - 1
                    ? 'linear-gradient(to top, rgb(99, 102, 241), rgb(139, 92, 246))'
                    : 'hsl(var(--muted))',
                }} />
                <span className="text-[10px] text-muted-foreground font-medium">{e.week}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="amenity-engagement">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            Amenity Engagement
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums" data-testid="text-gym-usage-percent">{amenityEngagement.residentsUsingGym}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{labels.membersLabel} using gym</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums" data-testid="text-avg-weekly-visits">{amenityEngagement.avgWeeklyVisits}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Avg weekly visits</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="resident-activity-table">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            {labels.membersLabel} Activity
          </h3>
          {residentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No resident activity yet</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2 text-xs">
                <span className="font-semibold text-muted-foreground pb-1 border-b">Name</span>
                <span className="font-semibold text-muted-foreground pb-1 border-b text-center">Workouts</span>
                <span className="font-semibold text-muted-foreground pb-1 border-b text-center">Last Visit</span>
                <span className="font-semibold text-muted-foreground pb-1 border-b text-center">Recovery</span>
                {displayedResidents.map((r, i) => (
                  <ResidentRow key={r.id} resident={r} index={i} />
                ))}
              </div>
              {residentActivity.length > 8 && (
                <button
                  onClick={() => setShowAllResidents(!showAllResidents)}
                  className="w-full text-center text-xs text-indigo-500 font-medium mt-3 py-2 hover:bg-muted/50 rounded-lg transition-colors"
                  data-testid="button-toggle-residents"
                >
                  {showAllResidents ? "Show less" : `View all ${residentActivity.length} ${labels.membersLabel.toLowerCase()}`}
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {accessLog.length > 0 && (
        <Card data-testid="access-log">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-muted-foreground" />
              Recent Access Log
            </h3>
            <div className="space-y-2">
              {accessLog.slice(0, 10).map((entry, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-muted last:border-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-500">{entry.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-sm font-medium">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{entry.time}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{entry.date === new Date().toISOString().split('T')[0] ? 'Today' : entry.date}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, suffix, color, testId, className }: { icon: any; label: string; value: number; suffix?: string; color: string; testId: string; className?: string }) {
  return (
    <Card className={className} data-testid={testId}>
      <CardContent className="p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-black tabular-nums">{value}{suffix && <span className="text-sm font-medium text-muted-foreground">{suffix}</span>}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}

function ResidentRow({ resident, index }: { resident: PropertyAnalytics['residentActivity'][0]; index: number }) {
  const recoveryColor = resident.recoveryScore
    ? resident.recoveryScore >= 70 ? 'text-emerald-500' : resident.recoveryScore >= 40 ? 'text-amber-500' : 'text-red-500'
    : 'text-muted-foreground';

  return (
    <>
      <span className="text-sm font-medium truncate py-1.5 border-b border-muted" data-testid={`text-resident-${resident.id}`}>{resident.name}</span>
      <span className="text-sm tabular-nums text-center py-1.5 border-b border-muted font-semibold">{resident.workoutsThisWeek}</span>
      <span className="text-sm text-center py-1.5 border-b border-muted">
        <Badge variant={resident.lastVisit === 'Today' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
          {resident.lastVisit}
        </Badge>
      </span>
      <span className={`text-sm tabular-nums text-center py-1.5 border-b border-muted font-semibold ${recoveryColor}`}>
        {resident.recoveryScore ?? '—'}
      </span>
    </>
  );
}
