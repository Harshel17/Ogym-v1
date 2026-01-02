import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, ChevronUp, Dumbbell, Flame, Target, CalendarDays, Filter, X } from "lucide-react";
import { format, subDays, startOfMonth, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useLocation, Link } from "wouter";

type WorkoutSummary = {
  streak: number;
  totalWorkouts: number;
  last7DaysCount: number;
  thisMonthCount: number;
  calendarDays: { date: string; focusLabel: string }[];
};

type WorkoutHistoryItem = {
  sessionId: number;
  date: string;
  focusLabel: string;
};

type SessionDetail = {
  id: number;
  date: string;
  focusLabel: string;
  exercises: {
    id: number;
    exerciseName: string;
    sets: number | null;
    reps: number | null;
    weight: string | null;
    notes: string | null;
  }[];
};

export default function MyWorkoutsPage() {
  const [, navigate] = useLocation();
  const [dateFilter, setDateFilter] = useState<"7d" | "30d" | "month" | "all">("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<number, SessionDetail>>({});

  const today = new Date().toISOString().split('T')[0];

  const getDateRange = () => {
    switch (dateFilter) {
      case "7d":
        return { from: subDays(new Date(), 7).toISOString().split('T')[0], to: today };
      case "30d":
        return { from: subDays(new Date(), 30).toISOString().split('T')[0], to: today };
      case "month":
        return { from: startOfMonth(new Date()).toISOString().split('T')[0], to: today };
      case "all":
      default:
        if (customFrom && customTo) {
          return { 
            from: customFrom.toISOString().split('T')[0], 
            to: customTo.toISOString().split('T')[0] 
          };
        }
        return { from: undefined, to: undefined };
    }
  };

  const { from, to } = getDateRange();

  const { data: summary } = useQuery<WorkoutSummary>({
    queryKey: ["/api/member/workout/summary"],
  });

  const { data: history = [], isLoading } = useQuery<WorkoutHistoryItem[]>({
    queryKey: ["/api/member/workout/history", from, to],
    queryFn: async () => {
      let url = "/api/member/workout/history";
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (params.toString()) url += `?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleExpandSession = async (sessionId: number) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }
    
    setExpandedSession(sessionId);
    
    if (!sessionDetails[sessionId]) {
      try {
        const res = await fetch(`/api/member/workout/session/${sessionId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSessionDetails(prev => ({ ...prev, [sessionId]: data }));
        }
      } catch (err) {
        console.error("Failed to fetch session details");
      }
    }
  };

  const clearFilters = () => {
    setDateFilter("all");
    setCustomFrom(undefined);
    setCustomTo(undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">My Workouts</h2>
          <p className="text-muted-foreground text-sm">View your workout history and progress</p>
        </div>
        <Link href="/progress/stats">
          <Button variant="outline" size="sm" data-testid="button-view-stats">
            View Stats
          </Button>
        </Link>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover-elevate" onClick={() => setDateFilter("all")} data-testid="stat-streak">
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Flame className="w-6 h-6 text-orange-500 mb-1" />
              <p className="text-xl font-bold">{summary.streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setDateFilter("all")} data-testid="stat-total">
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Target className="w-6 h-6 text-blue-500 mb-1" />
              <p className="text-xl font-bold">{summary.totalWorkouts}</p>
              <p className="text-xs text-muted-foreground">Total Sessions</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setDateFilter("7d")} data-testid="stat-7d">
            <CardContent className="flex flex-col items-center justify-center py-4">
              <Calendar className="w-6 h-6 text-green-500 mb-1" />
              <p className="text-xl font-bold">{summary.last7DaysCount}</p>
              <p className="text-xs text-muted-foreground">Last 7 Days</p>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover-elevate" onClick={() => setDateFilter("month")} data-testid="stat-month">
            <CardContent className="flex flex-col items-center justify-center py-4">
              <CalendarDays className="w-6 h-6 text-purple-500 mb-1" />
              <p className="text-xl font-bold">{summary.thisMonthCount}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5" />
              Workout History
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-1">
                <Button
                  variant={dateFilter === "7d" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("7d")}
                  data-testid="filter-7d"
                >
                  7d
                </Button>
                <Button
                  variant={dateFilter === "30d" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("30d")}
                  data-testid="filter-30d"
                >
                  30d
                </Button>
                <Button
                  variant={dateFilter === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateFilter("month")}
                  data-testid="filter-month"
                >
                  This Month
                </Button>
                <Button
                  variant={dateFilter === "all" && !customFrom ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setDateFilter("all"); setCustomFrom(undefined); setCustomTo(undefined); }}
                  data-testid="filter-all"
                >
                  All
                </Button>
              </div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-date-picker">
                    <Filter className="w-4 h-4 mr-1" />
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="range"
                    selected={{ from: customFrom, to: customTo }}
                    onSelect={(range) => {
                      setCustomFrom(range?.from);
                      setCustomTo(range?.to);
                      if (range?.from && range?.to) {
                        setDateFilter("all");
                      }
                    }}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {(dateFilter !== "all" || customFrom) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filter">
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          {(from || to) && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing: {from ? format(parseISO(from), "MMM d, yyyy") : "Start"} - {to ? format(parseISO(to), "MMM d, yyyy") : "Now"}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No workout sessions found for the selected period.</p>
          ) : (
            history.map((session) => {
              const isExpanded = expandedSession === session.sessionId;
              const detail = sessionDetails[session.sessionId];
              
              return (
                <Collapsible
                  key={session.sessionId}
                  open={isExpanded}
                  onOpenChange={() => handleExpandSession(session.sessionId)}
                >
                  <CollapsibleTrigger asChild>
                    <div
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-pointer hover-elevate"
                      data-testid={`session-row-${session.sessionId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Dumbbell className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {format(parseISO(session.date), "EEEE, MMM d, yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {session.focusLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{session.focusLabel}</Badge>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-4 space-y-2 border-l-2 border-muted pl-4">
                      {!detail ? (
                        <p className="text-sm text-muted-foreground py-2">Loading exercises...</p>
                      ) : detail.exercises.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No exercises recorded for this session.</p>
                      ) : (
                        detail.exercises.map((exercise, idx) => (
                          <div
                            key={exercise.id || idx}
                            className="flex items-center justify-between p-2 rounded bg-background"
                            data-testid={`exercise-${session.sessionId}-${idx}`}
                          >
                            <div>
                              <p className="font-medium text-sm">{exercise.exerciseName}</p>
                              {exercise.notes && (
                                <p className="text-xs text-muted-foreground">{exercise.notes}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {exercise.sets ?? "-"}x{exercise.reps ?? "-"}
                              </p>
                              {exercise.weight && (
                                <p className="text-xs text-muted-foreground">@ {exercise.weight}</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
