import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarCheck, UserX, UserPlus, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from 'recharts';
import { useBackNavigation } from "@/hooks/use-back-navigation";

type AttendanceSummary = {
  date: string;
  totalMembers: number;
  checkedInCount: number;
  notCheckedInCount: number;
  newEnrollmentsLast30Days: number;
};

type AttendanceDay = {
  date: string;
  checkedIn: { memberId: number; name: string; time: string; method: string }[];
  notCheckedIn: { memberId: number; name: string; trainerName: string | null }[];
};

type AttendanceTrend = {
  days: number;
  trend: { date: string; count: number }[];
};

// Helper to get client's local date in YYYY-MM-DD format
function getClientLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function OwnerAttendancePage() {
  // Use client's local date to avoid timezone mismatch with server UTC
  const [selectedDate, setSelectedDate] = useState<string>(getClientLocalDate());
  
  const effectiveDate = selectedDate;

  const { data: summary, isLoading: summaryLoading } = useQuery<AttendanceSummary>({
    queryKey: ["/api/owner/attendance/summary", effectiveDate],
    queryFn: async () => {
      const res = await fetch(`/api/owner/attendance/summary?date=${effectiveDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!effectiveDate
  });

  const { data: dayData, isLoading: dayLoading } = useQuery<AttendanceDay>({
    queryKey: ["/api/owner/attendance/day", effectiveDate],
    queryFn: async () => {
      const res = await fetch(`/api/owner/attendance/day?date=${effectiveDate}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch day data");
      return res.json();
    },
    enabled: !!effectiveDate
  });

  const { data: trendData } = useQuery<AttendanceTrend>({
    queryKey: ["/api/owner/attendance/trend"]
  });

  const chartData = trendData?.trend.map(t => ({
    date: format(new Date(t.date), "MMM dd"),
    count: t.count
  })) || [];

  const { goBack } = useBackNavigation();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" data-testid="button-back" onClick={goBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Attendance Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">View and analyze member attendance patterns</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Select Date:</span>
          <Input 
            type="date" 
            value={effectiveDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
            data-testid="input-date"
          />
        </div>
        <Button 
          variant="outline" 
          onClick={() => setSelectedDate(getClientLocalDate())}
          data-testid="button-today"
        >
          Today
        </Button>
      </div>

      {summaryLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary?.totalMembers || 0}</div>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Checked In</CardTitle>
              <CalendarCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary?.checkedInCount || 0}</div>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Not Checked In</CardTitle>
              <UserX className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{summary?.notCheckedInCount || 0}</div>
            </CardContent>
          </Card>
          <Card className="dashboard-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">New (30 days)</CardTitle>
              <UserPlus className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary?.newEnrollmentsLast30Days || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>14-Day Attendance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Check-in Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: "Checked In", value: summary?.checkedInCount || 0, fill: "hsl(142, 76%, 36%)" },
                  { name: "Not Checked In", value: summary?.notCheckedInCount || 0, fill: "hsl(25, 95%, 53%)" }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="checked-in" className="w-full">
        <TabsList>
          <TabsTrigger value="checked-in" data-testid="tab-checked-in">
            Checked In ({dayData?.checkedIn.length || 0})
          </TabsTrigger>
          <TabsTrigger value="not-checked-in" data-testid="tab-not-checked-in">
            Not Checked In ({dayData?.notCheckedIn.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checked-in" className="mt-4">
          {dayLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : dayData?.checkedIn.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No members checked in on this date
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dayData?.checkedIn.map((member) => (
                <Card key={member.memberId} data-testid={`member-checked-in-${member.memberId}`}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {member.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.time}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{member.method}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="not-checked-in" className="mt-4">
          {dayLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : dayData?.notCheckedIn.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                All members checked in on this date!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {dayData?.notCheckedIn.map((member) => (
                <Card key={member.memberId} data-testid={`member-not-checked-in-${member.memberId}`}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-sm font-bold text-muted-foreground">
                          {member.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        {member.trainerName && (
                          <p className="text-sm text-muted-foreground">Trainer: {member.trainerName}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary">Absent</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
