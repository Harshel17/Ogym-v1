import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, TrendingUp, TrendingDown, Users, BarChart3, Zap,
  UserCheck, UserX, UserMinus, Minus, Building2
} from "lucide-react";

type PeakHourEntry = {
  hour: number;
  label: string;
  count: number;
  level: "peak" | "moderate" | "low";
};

type WeeklyTrend = {
  week: string;
  label: string;
  visits: number;
  uniqueResidents: number;
};

type ResidentSegment = {
  name: string;
  lastVisit: string;
  totalVisits: number;
  segment: "regular" | "occasional" | "inactive";
};

type PropertyIntelligence = {
  peakHours: {
    data: PeakHourEntry[];
    peakSummary: string | null;
    lowSummary: string | null;
    totalCheckIns: number;
    daysAnalyzed: number;
  };
  usageTrends: {
    weeks: WeeklyTrend[];
    overallChange: number;
    avgWeeklyVisits: number;
  };
  residentEngagement: {
    totalResidents: number;
    regulars: number;
    occasional: number;
    inactive: number;
    engagementRate: number;
    residents: ResidentSegment[];
  };
};

export default function PropertyIntelligencePage() {
  const { user } = useAuth();
  const propertyName = user?.gym?.name || "Property";

  const { data, isLoading } = useQuery<PropertyIntelligence>({
    queryKey: ["/api/owner/property-intelligence"],
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-24 bg-muted animate-pulse rounded-2xl" />
        {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="property-intelligence-page">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-page-title">Property Intelligence</h1>
            <p className="text-xs text-white/50">{propertyName}</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mt-2">Insights from the last 30 days of access data.</p>
      </div>

      <PeakHoursCard peakHours={data.peakHours} />
      <UsageTrendsCard trends={data.usageTrends} />
      <ResidentEngagementCard engagement={data.residentEngagement} />
    </div>
  );
}

function PeakHoursCard({ peakHours }: { peakHours: PropertyIntelligence["peakHours"] }) {
  const maxCount = Math.max(...peakHours.data.map(h => h.count), 1);

  return (
    <Card data-testid="card-peak-hours">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Peak Hours
          </h3>
          <Badge variant="outline" className="text-[10px]">{peakHours.totalCheckIns} check-ins · {peakHours.daysAnalyzed} days</Badge>
        </div>

        <div className="flex items-end gap-[3px] h-28 mb-2">
          {peakHours.data.map((h) => {
            const height = maxCount > 0 ? Math.max((h.count / maxCount) * 100, 3) : 3;
            const color = h.level === "peak"
              ? "bg-red-500"
              : h.level === "moderate"
                ? "bg-amber-500"
                : "bg-slate-300 dark:bg-slate-600";
            return (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5">
                {h.count > 0 && <span className="text-[8px] tabular-nums text-muted-foreground">{h.count}</span>}
                <div className={`w-full rounded-t ${color} transition-all`} style={{ height: `${height}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground px-0.5">
          <span>5 AM</span>
          <span>12 PM</span>
          <span>6 PM</span>
          <span>11 PM</span>
        </div>

        <div className="mt-3 space-y-1.5">
          {peakHours.peakSummary && (
            <div className="flex items-center gap-2 text-xs">
              <Zap className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span><span className="font-semibold">Busiest:</span> {peakHours.peakSummary}</span>
            </div>
          )}
          {peakHours.lowSummary && (
            <div className="flex items-center gap-2 text-xs">
              <Minus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span><span className="font-semibold">Quietest:</span> {peakHours.lowSummary}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UsageTrendsCard({ trends }: { trends: PropertyIntelligence["usageTrends"] }) {
  const maxVisits = Math.max(...trends.weeks.map(w => w.visits), 1);
  const isUp = trends.overallChange > 0;
  const isDown = trends.overallChange < 0;

  return (
    <Card data-testid="card-usage-trends">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            Weekly Usage Trend
          </h3>
          <div className="flex items-center gap-1">
            {isUp && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
            {isDown && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
            <span className={`text-xs font-bold tabular-nums ${isUp ? "text-emerald-500" : isDown ? "text-red-500" : "text-muted-foreground"}`}>
              {isUp ? "+" : ""}{trends.overallChange}%
            </span>
          </div>
        </div>

        <div className="flex items-end gap-3 h-32 mb-2">
          {trends.weeks.map((w, i) => {
            const height = Math.max((w.visits / maxVisits) * 100, 4);
            const isLatest = i === trends.weeks.length - 1;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-center">
                  <span className="text-[10px] font-bold tabular-nums block">{w.visits}</span>
                  <span className="text-[8px] text-muted-foreground">{w.uniqueResidents} ppl</span>
                </div>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${height}%`,
                    background: isLatest
                      ? "linear-gradient(to top, rgb(99,102,241), rgb(139,92,246))"
                      : "hsl(var(--muted))",
                  }}
                />
                <span className="text-[9px] text-muted-foreground font-medium">{w.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-2 px-1 py-2 rounded-lg bg-muted/50 text-center">
          <p className="text-xs text-muted-foreground">
            Average <span className="font-bold text-foreground">{trends.avgWeeklyVisits}</span> visits per week
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ResidentEngagementCard({ engagement }: { engagement: PropertyIntelligence["residentEngagement"] }) {
  const segments = [
    { label: "Regulars", count: engagement.regulars, color: "bg-emerald-500", icon: UserCheck, desc: "3+ visits/month" },
    { label: "Occasional", count: engagement.occasional, color: "bg-amber-500", icon: UserMinus, desc: "1-2 visits/month" },
    { label: "Inactive", count: engagement.inactive, color: "bg-slate-400", icon: UserX, desc: "No visits in 30 days" },
  ];

  const total = engagement.totalResidents || 1;

  return (
    <Card data-testid="card-resident-engagement">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Resident Engagement
          </h3>
          <Badge variant="secondary" className="text-[10px]">{engagement.engagementRate}% active</Badge>
        </div>

        <div className="flex rounded-full h-3 overflow-hidden mb-3">
          {segments.map(s => (
            <div
              key={s.label}
              className={`${s.color} transition-all`}
              style={{ width: `${Math.max((s.count / total) * 100, s.count > 0 ? 3 : 0)}%` }}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {segments.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
                <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-black tabular-nums">{s.count}</p>
                <p className="text-[10px] font-semibold">{s.label}</p>
                <p className="text-[9px] text-muted-foreground">{s.desc}</p>
              </div>
            );
          })}
        </div>

        {engagement.residents.length > 0 && (
          <>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Resident Breakdown</h4>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {engagement.residents.map((r, i) => {
                const segColor = r.segment === "regular"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : r.segment === "occasional"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-slate-500/10 text-slate-500";
                return (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-muted/50 last:border-0">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-500">{r.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.totalVisits} visits · Last: {r.lastVisit}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${segColor}`}>
                      {r.segment}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
