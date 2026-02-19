import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  HandHeart,
  ArrowLeft,
  Filter,
  MessageSquare,
  User,
  CalendarDays,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";

interface Intervention {
  id: number;
  gymId: number;
  ownerId: number;
  memberId: number;
  actionType: string;
  triggerReason: string | null;
  messageSent: string | null;
  memberReturnedWithin7Days: boolean | null;
  memberReturnDate: string | null;
  createdAt: string;
}

export default function OwnerInterventionHistoryPage() {
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  const interventionUrl = `/api/owner/interventions?limit=200${outcomeFilter !== 'all' ? `&outcome=${outcomeFilter}` : ''}`;
  const { data: interventions, isLoading } = useQuery<Intervention[]>({
    queryKey: [interventionUrl],
  });

  const { data: members } = useQuery<any[]>({
    queryKey: ['/api/gym/members'],
  });

  const memberMap = useMemo(() => {
    const map: Record<number, string> = {};
    if (members) {
      for (const m of members) {
        map[m.id] = m.fullName || m.username || `Member #${m.id}`;
      }
    }
    return map;
  }, [members]);

  const filtered = useMemo(() => {
    if (!interventions) return [];
    let result = [...interventions];

    if (outcomeFilter === "returned") {
      result = result.filter(i => i.memberReturnedWithin7Days === true);
    } else if (outcomeFilter === "not_returned") {
      result = result.filter(i => i.memberReturnedWithin7Days === false);
    } else if (outcomeFilter === "pending") {
      result = result.filter(i => i.memberReturnedWithin7Days === null);
    }

    if (dateFilter !== "all") {
      const now = new Date();
      let cutoff: Date;
      if (dateFilter === "7d") cutoff = new Date(now.getTime() - 7 * 86400000);
      else if (dateFilter === "30d") cutoff = new Date(now.getTime() - 30 * 86400000);
      else if (dateFilter === "90d") cutoff = new Date(now.getTime() - 90 * 86400000);
      else cutoff = new Date(0);
      result = result.filter(i => new Date(i.createdAt) >= cutoff);
    }

    return result;
  }, [interventions, outcomeFilter, dateFilter]);

  const stats = useMemo(() => {
    if (!interventions || interventions.length === 0) return null;
    const total = interventions.length;
    const returned = interventions.filter(i => i.memberReturnedWithin7Days === true).length;
    const notReturned = interventions.filter(i => i.memberReturnedWithin7Days === false).length;
    const pending = interventions.filter(i => i.memberReturnedWithin7Days === null).length;
    const emailsSent = interventions.filter(i => i.actionType === 'email_sent').length;
    const manualOutreach = interventions.filter(i => i.actionType === 'manual_outreach').length;
    return { total, returned, notReturned, pending, emailsSent, manualOutreach, successRate: total > 0 ? Math.round((returned / (returned + notReturned || 1)) * 100) : 0 };
  }, [interventions]);

  const getOutcomeBadge = (intervention: Intervention) => {
    if (intervention.memberReturnedWithin7Days === true) {
      return <Badge variant="default" className="bg-green-600 dark:bg-green-700" data-testid={`badge-returned-${intervention.id}`}><CheckCircle2 className="h-3 w-3 mr-1" />Returned</Badge>;
    }
    if (intervention.memberReturnedWithin7Days === false) {
      return <Badge variant="destructive" data-testid={`badge-not-returned-${intervention.id}`}><XCircle className="h-3 w-3 mr-1" />Not returned</Badge>;
    }
    return <Badge variant="secondary" data-testid={`badge-pending-${intervention.id}`}><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  const getActionIcon = (actionType: string) => {
    if (actionType === 'email_sent') return <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
    return <HandHeart className="h-4 w-4 text-purple-500 dark:text-purple-400" />;
  };

  const getActionLabel = (actionType: string) => {
    if (actionType === 'email_sent') return 'Email Sent';
    if (actionType === 'manual_outreach') return 'Manual Outreach';
    if (actionType === 'contact_member') return 'Contacted';
    return actionType.replace(/_/g, ' ');
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <History className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Intervention History</h1>
            <p className="text-muted-foreground">Track your member outreach and outcomes</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/owner/ai-insights">
          <Button size="icon" variant="ghost" data-testid="button-back-to-insights">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="p-2 bg-primary/10 rounded-lg">
          <History className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Intervention History</h1>
          <p className="text-muted-foreground">Track your member outreach and outcomes</p>
        </div>
      </div>

      {stats && stats.total > 0 && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card data-testid="card-stat-total">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Outreach</p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-success">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.successRate}%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-emails">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.emailsSent}</p>
              <p className="text-xs text-muted-foreground">Emails Sent</p>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-manual">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.manualOutreach}</p>
              <p className="text-xs text-muted-foreground">Manual Outreach</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-4 w-4" />
                Filter Interventions
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Outcome</label>
              <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-outcome-filter">
                  <SelectValue placeholder="All outcomes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All outcomes</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="not_returned">Not returned</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Time Period</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-date-filter">
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 justify-end">
              <label className="text-xs text-muted-foreground invisible">Reset</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setOutcomeFilter("all"); setDateFilter("all"); }}
                data-testid="button-reset-filters"
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium" data-testid="text-no-interventions">No interventions found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {interventions && interventions.length > 0
                ? "Try adjusting your filters"
                : "Start reaching out to at-risk members from the AI Insights page"}
            </p>
            {(!interventions || interventions.length === 0) && (
              <Link href="/owner/ai-insights">
                <Button variant="default" className="mt-4" data-testid="button-go-to-insights">
                  Go to AI Insights
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground" data-testid="text-result-count">
            {filtered.length} intervention{filtered.length !== 1 ? 's' : ''} found
          </p>
          {filtered.map((intervention) => (
            <Card key={intervention.id} data-testid={`card-intervention-${intervention.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-full bg-muted flex-shrink-0 mt-0.5">
                      {getActionIcon(intervention.actionType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm" data-testid={`text-member-name-${intervention.id}`}>
                          <User className="h-3 w-3 inline mr-1" />
                          {memberMap[intervention.memberId] || `Member #${intervention.memberId}`}
                        </p>
                        <Badge variant="outline" className="text-[10px]" data-testid={`badge-action-type-${intervention.id}`}>
                          {getActionLabel(intervention.actionType)}
                        </Badge>
                        {getOutcomeBadge(intervention)}
                      </div>
                      {intervention.triggerReason && (
                        <p className="text-[11px] text-muted-foreground mt-1" data-testid={`text-trigger-reason-${intervention.id}`}>
                          Reason: {intervention.triggerReason.replace(/_/g, ' ')}
                        </p>
                      )}
                      {intervention.messageSent && (
                        <div className="mt-2 p-2 rounded-md bg-muted/50 border border-border/50" data-testid={`div-message-sent-${intervention.id}`}>
                          <div className="flex items-start gap-1.5">
                            <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3" data-testid={`text-message-content-${intervention.id}`}>{intervention.messageSent}</p>
                          </div>
                        </div>
                      )}
                      {intervention.memberReturnedWithin7Days && intervention.memberReturnDate && (
                        <p className="text-[11px] text-green-600 dark:text-green-400 mt-1" data-testid={`text-returned-date-${intervention.id}`}>
                          <CheckCircle2 className="h-3 w-3 inline mr-0.5" />
                          Returned on {new Date(intervention.memberReturnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(intervention.createdAt)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
