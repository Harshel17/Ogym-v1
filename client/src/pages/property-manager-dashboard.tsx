import { useQuery } from "@tanstack/react-query";
import { Building2, Users, DoorOpen, Clock, ArrowDownLeft, ArrowUpRight, UserCheck, QrCode } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

type PropertyAnalytics = {
  totalResidents: number;
  activeToday: number;
  accessLog: {
    name: string;
    time: string;
    date: string;
    type: "entry" | "exit";
  }[];
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function PropertyManagerDashboard({ propertyName, propertyType }: { propertyName: string; propertyType: string }) {
  const { data, isLoading } = useQuery<PropertyAnalytics>({
    queryKey: ["/api/owner/property-analytics"],
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-28 bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const todayEntries = data.accessLog.filter(e => e.date === today);
  const olderEntries = data.accessLog.filter(e => e.date !== today);

  return (
    <div className="space-y-4" data-testid="property-manager-dashboard">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-5 text-white" data-testid="property-header">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-property-name">{propertyName}</h1>
            <p className="text-xs text-white/50">Access Management</p>
          </div>
        </div>
        <p className="text-sm text-white/60 mt-2">{getGreeting()}! Here's today's door access activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card data-testid="stat-total-residents">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="w-4.5 h-4.5 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums">{data.totalResidents}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Total Residents</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-active-today">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <UserCheck className="w-4.5 h-4.5 text-emerald-500" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums">{data.activeToday}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Checked In Today</p>
          </CardContent>
        </Card>
      </div>

      <Link href="/owner/kiosk">
        <Card className="border-dashed border-indigo-500/30 cursor-pointer hover:border-indigo-500/50 transition-colors" data-testid="link-kiosk-mode">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <QrCode className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Self Check-in Kiosk</p>
              <p className="text-xs text-muted-foreground">Set up a tablet at the door for residents to scan in</p>
            </div>
          </CardContent>
        </Card>
      </Link>

      <Card data-testid="access-log-today">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DoorOpen className="w-4 h-4 text-muted-foreground" />
            Today's Access Log
            {todayEntries.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-auto">{todayEntries.length} entries</Badge>
            )}
          </h3>

          {todayEntries.length === 0 ? (
            <div className="text-center py-8">
              <DoorOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No check-ins yet today</p>
            </div>
          ) : (
            <div className="space-y-1">
              {todayEntries.map((entry, i) => (
                <AccessLogEntry key={i} entry={entry} showDate={false} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {olderEntries.length > 0 && (
        <Card data-testid="access-log-previous">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Previous Days
            </h3>
            <div className="space-y-1">
              {olderEntries.slice(0, 20).map((entry, i) => (
                <AccessLogEntry key={i} entry={entry} showDate={true} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AccessLogEntry({ entry, showDate }: { entry: PropertyAnalytics["accessLog"][0]; showDate: boolean }) {
  const isEntry = entry.type === "entry";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-muted/50 last:border-0" data-testid={`log-entry-${entry.name}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isEntry ? "bg-emerald-500/10" : "bg-orange-500/10"}`}>
        {isEntry
          ? <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
          : <ArrowUpRight className="w-4 h-4 text-orange-500" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.name}</p>
        <p className="text-[11px] text-muted-foreground">
          {isEntry ? "Checked in" : "Checked out"} at {entry.time}
          {showDate && <span className="ml-1">· {entry.date}</span>}
        </p>
      </div>
      <Badge variant={isEntry ? "default" : "outline"} className={`text-[10px] px-1.5 py-0 shrink-0 ${isEntry ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : ""}`}>
        {isEntry ? "IN" : "OUT"}
      </Badge>
    </div>
  );
}
