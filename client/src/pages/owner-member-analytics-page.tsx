import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserMinus, ArrowRightLeft, Loader2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Link } from "wouter";

type MemberAnalyticsData = {
  counts: { active: number; ended: number; transferredOut: number; transferredIn: number };
  activeMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; trainerName: string | null }[];
  endedMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; reason: string }[];
  transferredOut: { id: number; username: string; publicId: string | null; toGymName: string; transferDate: string }[];
  transferredIn: { id: number; username: string; publicId: string | null; fromGymName: string; transferDate: string }[];
  monthlyTrend: { month: string; active: number; ended: number }[];
};

export default function OwnerMemberAnalyticsPage() {
  const [activeTab, setActiveTab] = useState("active");

  const { data: analytics, isLoading } = useQuery<MemberAnalyticsData>({
    queryKey: ["/api/owner/member-analytics"]
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const counts = analytics?.counts || { active: 0, ended: 0, transferredOut: 0, transferredIn: 0 };
  const totalMembers = counts.active + counts.ended;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Member Analytics</h1>
          <p className="text-muted-foreground">Overview of all gym members by status</p>
        </div>
        <Link href="/">
          <Button variant="outline" data-testid="button-back-dashboard">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300 uppercase tracking-wider">
              Active Members
            </CardTitle>
            <div className="p-2 bg-green-200 dark:bg-green-800 rounded-full text-green-700 dark:text-green-300">
              <UserCheck className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-800 dark:text-green-200" data-testid="text-active-count">
              {counts.active}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Currently enrolled
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wider">
              Ended / Expired
            </CardTitle>
            <div className="p-2 bg-amber-200 dark:bg-amber-800 rounded-full text-amber-700 dark:text-amber-300">
              <UserMinus className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-800 dark:text-amber-200" data-testid="text-ended-count">
              {counts.ended}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Subscription ended
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300 uppercase tracking-wider">
              Transferred Out
            </CardTitle>
            <div className="p-2 bg-red-200 dark:bg-red-800 rounded-full text-red-700 dark:text-red-300">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-800 dark:text-red-200" data-testid="text-transferred-out">
              {counts.transferredOut}
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Left to other gyms
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              Transferred In
            </CardTitle>
            <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-full text-blue-700 dark:text-blue-300">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-800 dark:text-blue-200" data-testid="text-transferred-in">
              {counts.transferredIn}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Joined from other gyms
            </p>
          </CardContent>
        </Card>
      </div>

      {analytics?.monthlyTrend && analytics.monthlyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Member Trend (Last 6 Months)
            </CardTitle>
            <CardDescription>Active vs ended subscriptions over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="active" name="Active" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ended" name="Ended" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Member Lists</CardTitle>
          <CardDescription>View members by their current status</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="active" data-testid="tab-active">
                Active ({counts.active})
              </TabsTrigger>
              <TabsTrigger value="ended" data-testid="tab-ended">
                Ended ({counts.ended})
              </TabsTrigger>
              <TabsTrigger value="transferred-out" data-testid="tab-transferred-out">
                Out ({counts.transferredOut})
              </TabsTrigger>
              <TabsTrigger value="transferred-in" data-testid="tab-transferred-in">
                In ({counts.transferredIn})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {analytics?.activeMembers && analytics.activeMembers.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Trainer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.activeMembers.map((member) => (
                        <TableRow key={member.id} data-testid={`row-active-${member.id}`}>
                          <TableCell className="font-medium">
                            <Link href={`/owner/members/${member.id}`} className="text-primary hover:underline">
                              {member.username}
                            </Link>
                            {member.publicId && (
                              <span className="text-xs text-muted-foreground ml-2">#{member.publicId}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.planName ? (
                              <Badge variant="outline">{member.planName}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {member.startDate ? format(new Date(member.startDate), "dd MMM yyyy") : '-'}
                          </TableCell>
                          <TableCell>
                            {member.endDate ? format(new Date(member.endDate), "dd MMM yyyy") : '-'}
                          </TableCell>
                          <TableCell>{member.trainerName || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active members</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ended" className="mt-4">
              {analytics?.endedMembers && analytics.endedMembers.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.endedMembers.map((member) => (
                        <TableRow key={member.id} data-testid={`row-ended-${member.id}`}>
                          <TableCell className="font-medium">
                            {member.username}
                            {member.publicId && (
                              <span className="text-xs text-muted-foreground ml-2">#{member.publicId}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.planName ? (
                              <Badge variant="outline">{member.planName}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {member.startDate ? format(new Date(member.startDate), "dd MMM yyyy") : '-'}
                          </TableCell>
                          <TableCell>
                            {member.endDate ? format(new Date(member.endDate), "dd MMM yyyy") : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{member.reason}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserMinus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No ended subscriptions</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transferred-out" className="mt-4">
              {analytics?.transferredOut && analytics.transferredOut.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Transferred To</TableHead>
                        <TableHead>Transfer Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.transferredOut.map((member, index) => (
                        <TableRow key={`${member.id}-${index}`} data-testid={`row-out-${member.id}`}>
                          <TableCell className="font-medium">
                            {member.username}
                            {member.publicId && (
                              <span className="text-xs text-muted-foreground ml-2">#{member.publicId}</span>
                            )}
                          </TableCell>
                          <TableCell>{member.toGymName}</TableCell>
                          <TableCell>
                            {member.transferDate ? format(new Date(member.transferDate), "dd MMM yyyy") : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No members transferred out</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="transferred-in" className="mt-4">
              {analytics?.transferredIn && analytics.transferredIn.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Transferred From</TableHead>
                        <TableHead>Transfer Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.transferredIn.map((member, index) => (
                        <TableRow key={`${member.id}-${index}`} data-testid={`row-in-${member.id}`}>
                          <TableCell className="font-medium">
                            <Link href={`/owner/members/${member.id}`} className="text-primary hover:underline">
                              {member.username}
                            </Link>
                            {member.publicId && (
                              <span className="text-xs text-muted-foreground ml-2">#{member.publicId}</span>
                            )}
                          </TableCell>
                          <TableCell>{member.fromGymName}</TableCell>
                          <TableCell>
                            {member.transferDate ? format(new Date(member.transferDate), "dd MMM yyyy") : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No members transferred in</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
