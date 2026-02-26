import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { 
  Brain, 
  AlertTriangle, 
  Bell, 
  BarChart3, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Clock,
  Calendar,
  UserX,
  CreditCard,
  UserPlus,
  Sparkles,
  Mail,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Activity,
  ChevronRight,
  Zap,
  Lightbulb,
  CheckCircle2,
  Timer,
  MessageSquare,
  Shield,
  Send,
  HandHeart,
  Wand2,
  Loader2,
  History,
  FileText,
  GraduationCap,
  Megaphone,
  RefreshCw,
  UserCheck,
  Wrench,
  DollarSign,
} from "lucide-react";
import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { isNative, isIOS } from "@/lib/capacitor-init";

interface AiInsightsData {
  churnRisk: {
    count: number;
    members: { id: number; name: string; publicId: string | null; daysAbsent: number; lastVisit: string | null; riskLevel: 'high' | 'medium' | 'low'; churnScore: number; factors: { attendance: number; payment: number; trend: number; age: number }; predictedChurnWindow?: string; recommendation?: string }[];
  };
  followUpReminders: {
    count: number;
    items: { type: 'inactive' | 'subscription_ending' | 'no_trainer' | 'new_member'; memberId: number; name: string; publicId: string | null; message: string; priority: 'high' | 'medium' | 'low' }[];
  };
  attendancePatterns: {
    peakHours: { hour: string; count: number }[];
    busiestDays: { day: string; count: number }[];
    averageDaily: number;
    trend: 'up' | 'down' | 'stable';
    trendPercent: number;
  };
  memberInsights: {
    totalActive: number;
    newThisMonth: number;
    improvedMembers: number;
    atRiskCount: number;
  };
  monthComparison: {
    currentMonth: string;
    previousMonth: string;
    attendance: { current: number; previous: number; changePercent: number };
    newMembers: { current: number; previous: number; changePercent: number };
    revenue: { current: number; previous: number; changePercent: number };
  };
  todayPriority: {
    type: string;
    title: string;
    description: string;
    memberId?: number;
    memberName?: string;
  } | null;
  weeklyTrends?: {
    weeks: { weekLabel: string; weekStart: string; weekEnd: string; attendance: number; changePercent: number }[];
  };
  insightOfTheDay?: {
    type: string;
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'positive';
  } | null;
  interventionStats?: {
    total: number;
    successful: number;
    successRate: number;
    avgReturnDays: number;
    pending: number;
  };
  equipmentActions?: {
    name: string;
    category: string;
    action: string;
    urgency: string;
    reason: string;
    usage: number;
    changePercent: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
  paymentFollowUps?: {
    memberId: number;
    name: string;
    amount: number;
    month: string;
    daysOverdue: number;
  }[];
}

function ChangeIndicator({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">No change</span>;
  const isPositive = value > 0;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isPositive ? '+' : ''}{value}{suffix}
    </span>
  );
}

function ChurnScoreBar({ score }: { score: number }) {
  const color = score >= 65 ? 'bg-red-500' : score >= 40 ? 'bg-orange-500' : 'bg-yellow-500';
  return (
    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden" data-testid="churn-score-bar">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

function ReachOutDialog({ member, onSuccess }: { member: { id: number; name: string; daysAbsent: number; churnScore: number; recommendation?: string }; onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/owner/interventions/generate-message", {
        memberId: member.id,
        memberName: member.name,
        daysAbsent: member.daysAbsent,
        churnScore: member.churnScore,
        recommendation: member.recommendation,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessage(data.message);
    },
    onError: () => {
      toast({ title: "Could not generate message", variant: "destructive" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/owner/interventions/send-email", {
        memberId: member.id,
        subject: subject || undefined,
        message,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Message sent", description: `Email sent to ${member.name}` });
      setOpen(false);
      setMessage("");
      setSubject("");
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: "Failed to send", description: err.message || "Could not send email", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" data-testid={`button-reach-out-${member.id}`}>
          <Send className="h-3.5 w-3.5 mr-1" />
          Reach Out
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Message {member.name}</DialogTitle>
          <DialogDescription>
            Send a personalized re-engagement email. You can write your own or let AI draft one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{member.daysAbsent < 999 ? `${member.daysAbsent}d absent` : 'Never visited'}</Badge>
            <Badge variant="destructive">{member.churnScore}/100 risk</Badge>
          </div>
          <Input
            placeholder="Subject (optional)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            data-testid="input-email-subject"
          />
          <Textarea
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px] resize-none"
            data-testid="input-email-message"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-message"
          >
            {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
            {generateMutation.isPending ? "Generating..." : "AI Draft"}
          </Button>
        </div>
        <DialogFooter>
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!message.trim() || sendMutation.isPending}
            data-testid="button-send-email"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
            {sendMutation.isPending ? "Sending..." : "Send Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogReachOutButton({ member, onSuccess }: { member: { id: number; name: string; daysAbsent: number; churnScore: number }; onSuccess: () => void }) {
  const { toast } = useToast();
  const logMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/owner/interventions", {
        memberId: member.id,
        actionType: "manual_outreach",
        triggerReason: `churn_risk_${member.churnScore}`,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Logged", description: `Outreach to ${member.name} recorded` });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Failed to log", variant: "destructive" });
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => logMutation.mutate()}
      disabled={logMutation.isPending}
      data-testid={`button-log-reachout-${member.id}`}
    >
      {logMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <HandHeart className="h-3.5 w-3.5 mr-1" />}
      I Reached Out
    </Button>
  );
}

export default function OwnerAiInsightsPage() {
  const clientDate = new Date().toISOString().split('T')[0];
  const { toast } = useToast();
  
  const { data: insights, isLoading } = useQuery<AiInsightsData>({
    queryKey: [`/api/owner/ai-insights/${clientDate}`],
  });

  const handleInterventionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/owner/ai-insights/${clientDate}`] });
    queryClient.invalidateQueries({ queryKey: ['/api/owner/interventions'] });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'inactive': return <UserX className="h-4 w-4" />;
      case 'subscription_ending': return <CreditCard className="h-4 w-4" />;
      case 'no_trainer': return <Users className="h-4 w-4" />;
      case 'new_member': return <UserPlus className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'down': return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getMonthLabel = (monthStr: string) => {
    const [y, m] = monthStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(m) - 1] || m;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Insights</h1>
            <p className="text-muted-foreground">Smart analytics powered by your gym data</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <p className="text-muted-foreground">Unable to load insights</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            AI Insights
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Beta
            </Badge>
          </h1>
          <p className="text-muted-foreground">Smart analytics powered by your gym data</p>
        </div>
      </div>

      {insights.todayPriority && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-today-priority">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-full flex-shrink-0 mt-0.5">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-primary font-medium uppercase tracking-wider mb-1">Today's Priority</p>
                <p className="font-semibold text-sm">{insights.todayPriority.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{insights.todayPriority.description}</p>
              </div>
              {insights.todayPriority.memberId && (
                <Link href={`/owner/members/${insights.todayPriority.memberId}`}>
                  <Button size="sm" variant="default" data-testid="button-priority-action">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {insights.insightOfTheDay && (
        <Card className={`${
          insights.insightOfTheDay.severity === 'warning' ? 'border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20' :
          insights.insightOfTheDay.severity === 'positive' ? 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' :
          'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
        }`} data-testid="card-insight-of-the-day">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full flex-shrink-0 mt-0.5 ${
                insights.insightOfTheDay.severity === 'warning' ? 'bg-orange-100 dark:bg-orange-900/50' :
                insights.insightOfTheDay.severity === 'positive' ? 'bg-green-100 dark:bg-green-900/50' :
                'bg-blue-100 dark:bg-blue-900/50'
              }`}>
                <Lightbulb className={`h-4 w-4 ${
                  insights.insightOfTheDay.severity === 'warning' ? 'text-orange-600 dark:text-orange-400' :
                  insights.insightOfTheDay.severity === 'positive' ? 'text-green-600 dark:text-green-400' :
                  'text-blue-600 dark:text-blue-400'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider mb-1 text-muted-foreground">Insight of the Day</p>
                <p className="font-semibold text-sm">{insights.insightOfTheDay.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{insights.insightOfTheDay.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-active">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.memberInsights.totalActive}</div>
            <p className="text-xs text-muted-foreground">Currently subscribed</p>
          </CardContent>
        </Card>

        <Card data-testid="card-new-members">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{insights.memberInsights.newThisMonth}</div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Joined recently</p>
              {insights.monthComparison && <ChangeIndicator value={insights.monthComparison.newMembers.changePercent} />}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-workouts">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Active This Week</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{insights.memberInsights.improvedMembers}</div>
            <p className="text-xs text-muted-foreground">Completed workouts</p>
          </CardContent>
        </Card>

        <Card data-testid="card-at-risk">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{insights.memberInsights.atRiskCount}</div>
            <p className="text-xs text-muted-foreground">High churn risk</p>
          </CardContent>
        </Card>
      </div>

      {insights.monthComparison && (
        <Card data-testid="card-month-comparison">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 text-indigo-500" />
              Month vs Month
            </CardTitle>
            <CardDescription>{getMonthLabel(insights.monthComparison.previousMonth)} vs {getMonthLabel(insights.monthComparison.currentMonth)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Attendance</p>
                <p className="text-lg font-bold">{insights.monthComparison.attendance.current}</p>
                <ChangeIndicator value={insights.monthComparison.attendance.changePercent} />
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">New Members</p>
                <p className="text-lg font-bold">{insights.monthComparison.newMembers.current}</p>
                <ChangeIndicator value={insights.monthComparison.newMembers.changePercent} />
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                <p className="text-lg font-bold">{insights.monthComparison.revenue.current > 0 ? `${Math.round(insights.monthComparison.revenue.current)}` : '0'}</p>
                <ChangeIndicator value={insights.monthComparison.revenue.changePercent} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(insights.weeklyTrends || insights.interventionStats) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {insights.weeklyTrends && insights.weeklyTrends.weeks.length > 0 && (
            <Card data-testid="card-weekly-trends">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Weekly Attendance Trends
                </CardTitle>
                <CardDescription>Rolling 4-week comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.weeklyTrends.weeks.map((week, idx) => {
                    const maxAttendance = Math.max(...insights.weeklyTrends!.weeks.map(w => w.attendance), 1);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{week.weekLabel}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{week.attendance} check-ins</span>
                            {idx > 0 && week.changePercent !== 0 && (
                              <ChangeIndicator value={week.changePercent} />
                            )}
                          </div>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${(week.attendance / maxAttendance) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {insights.interventionStats && insights.interventionStats.total > 0 && (
            <Card data-testid="card-intervention-stats">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  Your Outreach Impact
                </CardTitle>
                <CardDescription>How effective your member interventions have been</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{insights.interventionStats.successRate}%</p>
                  </div>
                  <div className="h-14 w-14 rounded-full border-4 border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Total Sent</p>
                    <p className="text-lg font-bold">{insights.interventionStats.total}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Brought Back</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{insights.interventionStats.successful}</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-lg font-bold text-muted-foreground">{insights.interventionStats.pending}</p>
                  </div>
                </div>
                {insights.interventionStats.avgReturnDays > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Members typically return within {insights.interventionStats.avgReturnDays} days of your outreach
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-churn-risk">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Churn Risk
                </CardTitle>
                <CardDescription>
                  {insights.churnRisk.count} member{insights.churnRisk.count !== 1 ? 's' : ''} flagged by scoring engine
                </CardDescription>
              </div>
              {insights.churnRisk.count > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href="/owner/intervention-history">
                    <Button size="sm" variant="outline" data-testid="button-intervention-history">
                      <History className="h-4 w-4 mr-1.5" />
                      History
                    </Button>
                  </Link>
                  <Link href="/owner/follow-ups?tab=inactive&days=7">
                    <Button size="sm" variant="default" data-testid="button-send-followup-churn">
                      <Mail className="h-4 w-4 mr-1.5" />
                      Send Follow-ups
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {insights.churnRisk.members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No members at risk right now
              </p>
            ) : (
              <div className="space-y-2">
                {insights.churnRisk.members.map((member) => (
                  <div key={member.id} className="p-3 rounded-lg bg-muted/50" data-testid={`churn-member-${member.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{member.name}</p>
                          <Badge variant={member.riskLevel === 'high' ? 'destructive' : member.riskLevel === 'medium' ? 'secondary' : 'outline'}>
                            {member.churnScore}/100
                          </Badge>
                          {member.predictedChurnWindow && (
                            <Badge variant="outline" className="text-[10px]">
                              <Timer className="h-3 w-3 mr-0.5" />
                              {member.predictedChurnWindow}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <ChurnScoreBar score={member.churnScore} />
                          <p className="text-[11px] text-muted-foreground">
                            {member.daysAbsent < 999 ? `${member.daysAbsent}d absent` : 'Never visited'}
                          </p>
                        </div>
                      </div>
                      <Link href={`/owner/members/${member.id}`}>
                        <Button size="sm" variant="outline" data-testid={`button-view-member-${member.id}`}>
                          View
                        </Button>
                      </Link>
                    </div>
                    {member.recommendation && (
                      <div className="mt-2 flex items-start gap-1.5 pl-1">
                        <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-muted-foreground leading-tight">{member.recommendation}</p>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <ReachOutDialog member={member} onSuccess={handleInterventionSuccess} />
                      <LogReachOutButton member={member} onSuccess={handleInterventionSuccess} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-follow-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" />
              Follow-up Reminders
            </CardTitle>
            <CardDescription>
              {insights.followUpReminders.count} action{insights.followUpReminders.count !== 1 ? 's' : ''} needed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insights.followUpReminders.items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No follow-ups needed right now
              </p>
            ) : (
              <div className="space-y-3">
                {insights.followUpReminders.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-background">
                        {getTypeIcon(item.type)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.message}</p>
                      </div>
                    </div>
                    <Badge variant={getPriorityColor(item.priority) as any}>
                      {item.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-attendance-patterns">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Attendance Patterns
            </CardTitle>
            <CardDescription>Based on last 30 days of data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">Daily Average</p>
                <p className="text-2xl font-bold">{insights.attendancePatterns.averageDaily}</p>
              </div>
              <div className="flex items-center gap-2">
                {getTrendIcon(insights.attendancePatterns.trend)}
                <span className={`text-sm font-medium ${
                  insights.attendancePatterns.trend === 'up' ? 'text-green-500' :
                  insights.attendancePatterns.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  {insights.attendancePatterns.trendPercent > 0 ? '+' : ''}{insights.attendancePatterns.trendPercent}%
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Busiest Days
              </h4>
              <div className="space-y-2">
                {insights.attendancePatterns.busiestDays.slice(0, 3).map((day) => (
                  <div key={day.day} className="flex items-center justify-between">
                    <span className="text-sm">{day.day}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ 
                            width: `${(day.count / (insights.attendancePatterns.busiestDays[0]?.count || 1)) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8">{day.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {insights.attendancePatterns.peakHours.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Peak Hours
                </h4>
                <div className="space-y-2">
                  {insights.attendancePatterns.peakHours.slice(0, 3).map((hour) => (
                    <div key={hour.hour} className="flex items-center justify-between">
                      <span className="text-sm">{hour.hour}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ 
                              width: `${(hour.count / (insights.attendancePatterns.peakHours[0]?.count || 1)) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8">{hour.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-ai-recommendations">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              AI Recommendations
            </CardTitle>
            <CardDescription>Suggested actions based on your data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {insights.churnRisk.count > 0 && (
                <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
                  <p className="font-medium text-orange-800 dark:text-orange-200">Reduce Member Churn</p>
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                    {insights.churnRisk.members.filter(m => m.riskLevel === 'high').length} high-risk and {insights.churnRisk.members.filter(m => m.riskLevel === 'medium').length} medium-risk members detected. 
                    {insights.churnRisk.members[0] && ` Top concern: ${insights.churnRisk.members[0].name} (score ${insights.churnRisk.members[0].churnScore}/100).`}
                  </p>
                </div>
              )}

              {insights.followUpReminders.items.some(i => i.type === 'no_trainer') && (
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="font-medium text-blue-800 dark:text-blue-200">Assign Trainers</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    {insights.followUpReminders.items.filter(i => i.type === 'no_trainer').length} members don't have trainers. Members with trainers show 40% better retention.
                  </p>
                </div>
              )}

              {insights.attendancePatterns.trend === 'down' && (
                <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
                  <p className="font-medium text-red-800 dark:text-red-200">Attendance Declining</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Attendance is down {Math.abs(insights.attendancePatterns.trendPercent)}% compared to last 2 weeks. 
                    Consider launching a challenge or promotion to boost engagement.
                  </p>
                </div>
              )}

              {insights.monthComparison && insights.monthComparison.attendance.changePercent > 10 && (
                <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
                  <p className="font-medium text-green-800 dark:text-green-200">Momentum Building</p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Attendance is up {insights.monthComparison.attendance.changePercent}% vs last month. Keep this energy going with member challenges.
                  </p>
                </div>
              )}

              {insights.memberInsights.newThisMonth > 0 && (
                <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
                  <p className="font-medium text-green-800 dark:text-green-200">Welcome New Members</p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    {insights.memberInsights.newThisMonth} new member{insights.memberInsights.newThisMonth !== 1 ? 's' : ''} this month. 
                    First 30 days are critical - ensure they have workout plans and trainer support.
                  </p>
                </div>
              )}

              {insights.churnRisk.count === 0 && insights.attendancePatterns.trend !== 'down' && (
                <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
                  <p className="font-medium text-green-800 dark:text-green-200">Looking Good!</p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Your gym is performing well. Keep up the great work with member engagement!
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {insights.equipmentActions && insights.equipmentActions.length > 0 && (
        <Card className="card-elevated" data-testid="card-equipment-actions">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-orange-500/10">
                <Wrench className="w-4 h-4 text-orange-500" />
              </div>
              Equipment Actions
              <Badge variant="secondary" className="text-[10px] ml-auto">{insights.equipmentActions.length} item{insights.equipmentActions.length !== 1 ? 's' : ''}</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Equipment that needs your attention based on usage patterns</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {insights.equipmentActions.map((item, idx) => {
                const urgencyStyles = {
                  high: { bg: 'bg-red-500/5', border: 'border-red-500/20', badge: 'bg-red-500/10 text-red-600 dark:text-red-400', icon: 'text-red-500' },
                  medium: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', icon: 'text-amber-500' },
                  low: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', icon: 'text-blue-500' },
                };
                const style = urgencyStyles[item.urgency as keyof typeof urgencyStyles] || urgencyStyles.low;
                const actionLabels: Record<string, string> = {
                  overloaded: 'Overloaded',
                  growing_fast: 'Growing Fast',
                  unused: 'Unused',
                  declining: 'Declining',
                };
                const confidenceLabels: Record<string, { text: string; color: string }> = {
                  high: { text: 'High confidence', color: 'text-emerald-600 dark:text-emerald-400' },
                  medium: { text: 'Medium confidence', color: 'text-amber-600 dark:text-amber-400' },
                  low: { text: 'Low confidence', color: 'text-muted-foreground' },
                };
                const conf = confidenceLabels[item.confidence] || confidenceLabels.low;

                return (
                  <div key={idx} className={`rounded-xl border ${style.border} ${style.bg} p-3`} data-testid={`equipment-action-${idx}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 shrink-0 ${style.icon}`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold">{item.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${style.badge}`}>{actionLabels[item.action] || item.action}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-1.5">{item.reason}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-[10px] text-muted-foreground/70">
                            <span className="font-semibold tabular-nums">{item.usage}</span> uses this month
                          </span>
                          {item.changePercent !== 0 && (
                            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${item.changePercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                              {item.changePercent > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {item.changePercent > 0 ? '+' : ''}{item.changePercent}%
                            </span>
                          )}
                          <span className={`text-[10px] ${conf.color} ml-auto`}>{conf.text}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {insights.paymentFollowUps && insights.paymentFollowUps.length > 0 && (
        <Card className="card-elevated" data-testid="card-payment-followups">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              Payment Follow-ups
              <Badge variant="secondary" className="text-[10px] ml-auto">{insights.paymentFollowUps.length} pending</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Members with outstanding payments this month</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {insights.paymentFollowUps.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-border/50 bg-muted/5 p-3 flex items-center gap-3" data-testid={`payment-followup-${idx}`}>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0">
                    <CreditCard className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold truncate">{item.name}</span>
                      {item.daysOverdue > 7 && (
                        <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 dark:text-red-400">{item.daysOverdue}d overdue</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Owes <span className="font-semibold tabular-nums">${item.amount.toFixed(0)}</span> for {item.month}
                    </p>
                  </div>
                  <Link href={`/owner/payments`}>
                    <Button variant="ghost" size="sm" className="text-[10px] px-2 py-1 h-auto" data-testid={`button-followup-${idx}`}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <WeeklyBriefingSection />
      <TrainerPerformanceSection />
      <ReengagementSection />
    </div>
  );
}

function WeeklyBriefingSection() {
  const clientDate = new Date().toISOString().split('T')[0];
  const isIOSNative = isNative() && isIOS();
  const { data: briefing, isLoading, isError, refetch, isFetching } = useQuery<{
    summary: string;
    priorities: string[];
    highlights: { label: string; value: string; trend: 'up' | 'down' | 'stable' }[];
    memberAlerts: { name: string; reason: string }[];
    generatedAt: string;
  }>({
    queryKey: [`/api/owner/ai/weekly-briefing?clientDate=${clientDate}`],
    staleTime: 1000 * 60 * 30,
    enabled: !isIOSNative,
  });

  if (isIOSNative) return null;

  return (
    <Card data-testid="card-weekly-briefing">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-violet-500" />
              AI Weekly Briefing
            </CardTitle>
            <CardDescription>GPT-generated summary of your gym's week</CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-briefing"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Generating...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-briefing-error">Could not generate briefing right now. Tap Refresh to try again.</p>
        ) : briefing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="grid-briefing-highlights">
              {briefing.highlights.map((h, i) => (
                <div key={i} className="text-center p-3 rounded-lg bg-muted/50" data-testid={`highlight-${i}`}>
                  <p className="text-xs text-muted-foreground" data-testid={`text-highlight-label-${i}`}>{h.label}</p>
                  <p className="text-lg font-bold" data-testid={`text-highlight-value-${i}`}>{h.value}</p>
                  <span className={`text-[10px] ${h.trend === 'up' ? 'text-green-600 dark:text-green-400' : h.trend === 'down' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                    {h.trend === 'up' ? 'Trending up' : h.trend === 'down' ? 'Needs attention' : 'Stable'}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900">
              <p className="text-sm leading-relaxed" data-testid="text-briefing-summary">{briefing.summary}</p>
            </div>

            {briefing.priorities.length > 0 && (
              <div data-testid="section-priorities">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">This Week's Priorities</p>
                <div className="space-y-2">
                  {briefing.priorities.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
                      <Badge variant="secondary" className="text-[10px] mt-0.5 flex-shrink-0">{i + 1}</Badge>
                      <p className="text-sm" data-testid={`text-priority-${i}`}>{p}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {briefing.memberAlerts.length > 0 && (
              <div data-testid="section-member-alerts">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Member Alerts</p>
                <div className="space-y-1.5">
                  {briefing.memberAlerts.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm" data-testid={`alert-member-${i}`}>
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500 flex-shrink-0" />
                      <span className="font-medium" data-testid={`text-alert-name-${i}`}>{a.name}</span>
                      <span className="text-muted-foreground" data-testid={`text-alert-reason-${i}`}>— {a.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-right" data-testid="text-briefing-generated-at">
              Generated {new Date(briefing.generatedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-briefing-empty">Unable to generate briefing</p>
        )}
      </CardContent>
    </Card>
  );
}

function TrainerPerformanceSection() {
  const clientDate = new Date().toISOString().split('T')[0];
  const isIOSNative = isNative() && isIOS();
  const { data, isLoading, isError } = useQuery<{
    trainers: { id: number; name: string; memberCount: number; avgAttendance: number; atRiskMembers: number; topPerformer: string | null; aiSummary: string }[];
    generatedAt: string;
  }>({
    queryKey: [`/api/owner/ai/trainer-performance?clientDate=${clientDate}`],
    staleTime: 1000 * 60 * 30,
    enabled: !isIOSNative,
  });

  if (isIOSNative) return null;

  if (isLoading) {
    return (
      <Card data-testid="card-trainer-performance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5 text-teal-500" />
            AI Trainer Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card data-testid="card-trainer-performance">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5 text-teal-500" />
            AI Trainer Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-trainer-error">Could not load trainer performance analysis.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.trainers.length === 0) return null;

  return (
    <Card data-testid="card-trainer-performance">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-5 w-5 text-teal-500" />
          AI Trainer Performance
        </CardTitle>
        <CardDescription>How each trainer's members are doing (30-day analysis)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.trainers.map((trainer) => (
            <div key={trainer.id} className="p-4 rounded-lg bg-muted/50" data-testid={`trainer-card-${trainer.id}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium text-sm" data-testid={`text-trainer-name-${trainer.id}`}>{trainer.name}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-muted-foreground" data-testid={`text-trainer-members-${trainer.id}`}>{trainer.memberCount} members</span>
                    <span className="text-xs text-muted-foreground" data-testid={`text-trainer-attendance-${trainer.id}`}>Avg {trainer.avgAttendance} visits/mo</span>
                    {trainer.atRiskMembers > 0 && (
                      <Badge variant="destructive" className="text-[10px]">{trainer.atRiskMembers} at risk</Badge>
                    )}
                    {trainer.topPerformer && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                        <UserCheck className="h-3 w-3" /> Top: {trainer.topPerformer}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2 p-2.5 rounded-md bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-900/50">
                <div className="flex items-start gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-teal-800 dark:text-teal-200 leading-relaxed" data-testid={`text-trainer-summary-${trainer.id}`}>{trainer.aiSummary}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-right mt-3">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function ReengagementSection() {
  const clientDate = new Date().toISOString().split('T')[0];
  const isIOSNative = isNative() && isIOS();
  const { data, isLoading, isError } = useQuery<{
    expiredMembers: { id: number; name: string; lastVisit: string | null; daysSinceExpiry: number; suggestedAction: string }[];
    campaignIdea: string;
    generatedAt: string;
  }>({
    queryKey: [`/api/owner/ai/reengagement?clientDate=${clientDate}`],
    staleTime: 1000 * 60 * 30,
    enabled: !isIOSNative,
  });

  if (isIOSNative) return null;

  if (isLoading) {
    return (
      <Card data-testid="card-reengagement">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-5 w-5 text-amber-500" />
            AI Re-engagement Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card data-testid="card-reengagement">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-5 w-5 text-amber-500" />
            AI Re-engagement Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-reengagement-error">Could not load re-engagement suggestions.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.expiredMembers.length === 0) {
    return (
      <Card data-testid="card-reengagement">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-5 w-5 text-amber-500" />
            AI Re-engagement Campaigns
          </CardTitle>
          <CardDescription>Smart strategies to bring back expired members</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-reengagement-empty">No expired members in the last 60 days — great retention!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-reengagement">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="h-5 w-5 text-amber-500" />
          AI Re-engagement Campaigns
        </CardTitle>
        <CardDescription>{data.expiredMembers.length} expired members in the last 60 days</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-1">Campaign Idea</p>
              <p className="text-sm text-amber-700 dark:text-amber-300" data-testid="text-campaign-idea">{data.campaignIdea}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {data.expiredMembers.slice(0, 8).map((member) => (
            <div key={member.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50" data-testid={`reengagement-member-${member.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{member.name}</p>
                  <Badge variant="outline" className="text-[10px]">Expired {member.daysSinceExpiry}d ago</Badge>
                </div>
                <div className="flex items-start gap-1.5 mt-1.5">
                  <Brain className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-tight">{member.suggestedAction}</p>
                </div>
              </div>
              <Link href={`/owner/members/${member.id}`}>
                <Button size="sm" variant="outline" data-testid={`button-view-expired-${member.id}`}>
                  View
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted-foreground text-right">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
