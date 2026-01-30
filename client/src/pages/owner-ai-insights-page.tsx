import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  Mail
} from "lucide-react";
import { Link } from "wouter";

interface AiInsightsData {
  churnRisk: {
    count: number;
    members: { id: number; name: string; publicId: string | null; daysAbsent: number; lastVisit: string | null; riskLevel: 'high' | 'medium' }[];
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
}

export default function OwnerAiInsightsPage() {
  const clientDate = new Date().toISOString().split('T')[0];
  
  const { data: insights, isLoading } = useQuery<AiInsightsData>({
    queryKey: [`/api/owner/ai-insights/${clientDate}`],
  });

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
            <p className="text-xs text-muted-foreground">Joined recently</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-churn-risk">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Churn Risk Alert
                </CardTitle>
                <CardDescription>
                  {insights.churnRisk.count} member{insights.churnRisk.count !== 1 ? 's' : ''} at risk of leaving
                </CardDescription>
              </div>
              {insights.churnRisk.count > 0 && (
                <Link href="/owner/follow-ups?tab=inactive&days=7">
                  <Button size="sm" variant="default" data-testid="button-send-followup-churn">
                    <Mail className="h-4 w-4 mr-1.5" />
                    Send Follow-ups
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {insights.churnRisk.members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No members at risk right now
              </p>
            ) : (
              <div className="space-y-3">
                {insights.churnRisk.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.lastVisit ? `Last visit: ${member.lastVisit}` : 'Never visited'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                        {member.daysAbsent} days absent
                      </Badge>
                      <Link href={`/owner/members/${member.id}`}>
                        <Button size="sm" variant="outline" data-testid={`button-view-member-${member.id}`}>
                          View
                        </Button>
                      </Link>
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
                        <p className="font-medium">{item.name}</p>
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
                {insights.attendancePatterns.busiestDays.slice(0, 3).map((day, idx) => (
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
                    {insights.churnRisk.count} member{insights.churnRisk.count !== 1 ? 's are' : ' is'} at risk. 
                    Consider reaching out personally or offering a special session to re-engage them.
                  </p>
                </div>
              )}

              {insights.followUpReminders.items.some(i => i.type === 'no_trainer') && (
                <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="font-medium text-blue-800 dark:text-blue-200">Assign Trainers</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    Some members don't have trainers assigned. Members with trainers show 40% better retention.
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

              {insights.memberInsights.newThisMonth > 0 && (
                <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
                  <p className="font-medium text-green-800 dark:text-green-200">Welcome New Members</p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    {insights.memberInsights.newThisMonth} new member{insights.memberInsights.newThisMonth !== 1 ? 's' : ''} joined this month. 
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
    </div>
  );
}
