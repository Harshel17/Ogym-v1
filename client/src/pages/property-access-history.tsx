import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { DoorOpen, ArrowDownLeft, Calendar, Search, Users, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AccessEntry = {
  name: string;
  time: string;
  date: string;
};

export default function PropertyAccessHistory() {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [searchName, setSearchName] = useState("");

  const { data, isLoading } = useQuery<{ entries: AccessEntry[]; totalCount: number }>({
    queryKey: ["/api/owner/access-history", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/owner/access-history?start=${startDate}&end=${endDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const filtered = data?.entries?.filter(e =>
    searchName ? e.name.toLowerCase().includes(searchName.toLowerCase()) : true
  ) || [];

  const groupedByDate: Record<string, AccessEntry[]> = {};
  for (const entry of filtered) {
    if (!groupedByDate[entry.date]) groupedByDate[entry.date] = [];
    groupedByDate[entry.date].push(entry);
  }
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const uniqueVisitors = new Set(filtered.map(e => e.name)).size;

  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  return (
    <div className="space-y-4" data-testid="property-access-history">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <DoorOpen className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-lg font-bold" data-testid="text-page-title">Access History</h1>
            <p className="text-xs text-white/50">{user?.gym?.name || "Property"}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Calendar className="w-4 h-4" />
            Date Range
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setQuickRange(0)} data-testid="button-today">Today</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setQuickRange(7)} data-testid="button-7days">Last 7 days</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setQuickRange(30)} data-testid="button-30days">Last 30 days</Button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground mb-1 block">From</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm" data-testid="input-start-date" />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground mb-1 block">To</label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm" data-testid="input-end-date" />
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="pl-9 text-sm"
              data-testid="input-search-name"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <DoorOpen className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums" data-testid="text-total-entries">{filtered.length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Total Check-ins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
            </div>
            <p className="text-2xl font-black tabular-nums" data-testid="text-unique-visitors">{uniqueVisitors}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Unique Residents</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : sortedDates.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <DoorOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No check-ins found for this period</p>
          </CardContent>
        </Card>
      ) : (
        sortedDates.map(date => (
          <Card key={date} data-testid={`date-group-${date}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {date === today ? "Today" : formatDate(date)}
                </h3>
                <Badge variant="secondary" className="text-[10px]">{groupedByDate[date].length} check-ins</Badge>
              </div>
              <div className="space-y-1">
                {groupedByDate[date].map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-muted/50 last:border-0" data-testid={`entry-${date}-${i}`}>
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                      <p className="text-[11px] text-muted-foreground">Checked in at {entry.time}</p>
                    </div>
                    <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">IN</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
