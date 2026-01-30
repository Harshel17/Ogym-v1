import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Send, Calendar, Clock, CheckCircle, AlertTriangle, RefreshCw, ArrowLeft, Bell, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { format } from "date-fns";

interface AutomatedEmailStats {
  expiryReminders: {
    sent: number;
    pending: { memberId: number; memberName: string; email: string; daysUntilExpiry: number; endDate: string }[];
  };
  weeklySummaries: {
    lastSent: string | null;
    totalSent: number;
  };
}

interface SendResult {
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
  details: { memberName: string; reminderType: string; status: string }[];
}

function getClientLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function OwnerAutomatedEmailsPage() {
  const { toast } = useToast();
  const [lastResult, setLastResult] = useState<SendResult | null>(null);

  const { data: stats, isLoading } = useQuery<AutomatedEmailStats>({
    queryKey: ["/api/owner/automated-emails/stats"],
  });

  const sendExpiryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/owner/automated-emails/send-expiry-reminders", {
        clientDate: getClientLocalDate()
      });
    },
    onSuccess: (data: SendResult) => {
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/owner/automated-emails/stats"] });
      toast({
        title: "Expiry Reminders Sent",
        description: `Sent ${data.sent} email(s), skipped ${data.skipped}, errors: ${data.errors}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send reminders",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendWeeklySummaryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/owner/automated-emails/send-weekly-summary", {
        clientDate: getClientLocalDate()
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/automated-emails/stats"] });
      toast({
        title: "Weekly Summary Sent",
        description: `Sent ${data.sent} summary email(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send summary",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 pb-24">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-4">
        <Link href="/owner/settings">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">Automated Emails</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Manage subscription reminders and weekly reports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-amber-500" />
                  Subscription Expiry Reminders
                </CardTitle>
                <CardDescription>
                  Automatic emails sent 7, 3, and 1 day(s) before expiry
                </CardDescription>
              </div>
              <Badge variant="secondary">{stats?.expiryReminders.sent || 0} sent</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.expiryReminders.pending && stats.expiryReminders.pending.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Pending Reminders:</p>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {stats.expiryReminders.pending.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{member.memberName}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <Badge variant={member.daysUntilExpiry <= 1 ? "destructive" : member.daysUntilExpiry <= 3 ? "secondary" : "outline"}>
                        {member.daysUntilExpiry === 0 ? "Today" : `${member.daysUntilExpiry}d`}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">All reminders sent - no pending</span>
              </div>
            )}
            
            <Button 
              onClick={() => sendExpiryMutation.mutate()}
              disabled={sendExpiryMutation.isPending}
              className="w-full"
              data-testid="button-send-expiry-reminders"
            >
              {sendExpiryMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Expiry Reminders Now
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  Weekly Summary Emails
                </CardTitle>
                <CardDescription>
                  Performance report sent to you every Monday
                </CardDescription>
              </div>
              <Badge variant="secondary">{stats?.weeklySummaries.totalSent || 0} sent</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.weeklySummaries.lastSent ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm">Last sent:</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(stats.weeklySummaries.lastSent), "PPP 'at' p")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">No weekly summary sent yet</span>
              </div>
            )}

            <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p>Weekly summaries include:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                <li>New member count</li>
                <li>Total attendance & daily average</li>
                <li>Revenue collected</li>
                <li>Expiring subscriptions alert</li>
                <li>Churn risk members</li>
              </ul>
            </div>

            <Button 
              variant="outline"
              onClick={() => sendWeeklySummaryMutation.mutate()}
              disabled={sendWeeklySummaryMutation.isPending}
              className="w-full"
              data-testid="button-send-weekly-summary"
            >
              {sendWeeklySummaryMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Weekly Summary Now
            </Button>
          </CardContent>
        </Card>
      </div>

      {lastResult && lastResult.details.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Last Send Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Badge variant="default">{lastResult.sent} Sent</Badge>
              <Badge variant="secondary">{lastResult.skipped} Skipped</Badge>
              {lastResult.errors > 0 && (
                <Badge variant="destructive">{lastResult.errors} Errors</Badge>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {lastResult.details.map((detail, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30 text-sm">
                  <span>{detail.memberName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{detail.reminderType.replace('expiry_', '').replace('_', ' ')}</span>
                    <Badge 
                      variant={detail.status === 'sent' ? 'default' : detail.status.includes('skipped') ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {detail.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Automatic Scheduling</p>
              <p className="text-xs text-muted-foreground mt-1">
                For production deployments, set up a daily cron job to call <code className="bg-muted px-1 rounded">/api/cron/automated-emails</code> with your CRON_SECRET header. 
                Weekly summaries are automatically sent on Mondays only.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
