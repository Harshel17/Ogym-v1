import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserCheck, UserMinus, ArrowRightLeft, Loader2, TrendingUp, UserX, Search, Eye, Bell, Flag, ArrowLeft, Mail } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Link } from "wouter";
import { useBackNavigation } from "@/hooks/use-back-navigation";

// Helper to get client's local date in YYYY-MM-DD format
function getClientLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type MemberAnalyticsData = {
  counts: { active: number; ended: number; transferredOut: number; transferredIn: number };
  activeMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; trainerName: string | null }[];
  endedMembers: { id: number; username: string; publicId: string | null; planName: string | null; startDate: string | null; endDate: string | null; reason: string }[];
  transferredOut: { id: number; username: string; publicId: string | null; toGymName: string; transferDate: string }[];
  transferredIn: { id: number; username: string; publicId: string | null; fromGymName: string; transferDate: string }[];
  monthlyTrend: { month: string; active: number; ended: number }[];
};

type InactiveMember = {
  memberId: number;
  name: string;
  email: string | null;
  publicId: string | null;
  status: 'active' | 'ended' | 'transferred';
  lastAttendedDate: string | null;
  daysAbsent: number;
};

export default function OwnerMemberAnalyticsPage() {
  // Read ?tab= from URL and default to that tab
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "overview";
  const [mainTab, setMainTab] = useState(initialTab);
  const [activeTab, setActiveTab] = useState("active");
  
  // Inactive members filters
  const [inactiveDays, setInactiveDays] = useState("3");
  const [customDays, setCustomDays] = useState("");
  const [includeEnded, setIncludeEnded] = useState(false);
  const [trackingMode, setTrackingMode] = useState<'attendance' | 'workouts'>('attendance');
  const [searchQuery, setSearchQuery] = useState("");
  
  // Member list search
  const [memberListSearch, setMemberListSearch] = useState("");

  const { data: analytics, isLoading } = useQuery<MemberAnalyticsData>({
    queryKey: ["/api/owner/member-analytics"]
  });

  // Calculate effective days value
  const effectiveDays = inactiveDays === 'custom' 
    ? (parseInt(customDays) || 3) 
    : parseInt(inactiveDays);

  const { data: inactiveMembers, isLoading: inactiveLoading } = useQuery<InactiveMember[]>({
    queryKey: ["/api/owner/members/inactive", effectiveDays, includeEnded, trackingMode, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        days: String(effectiveDays),
        includeEnded: String(includeEnded),
        mode: trackingMode,
        clientDate: getClientLocalDate(),
        ...(searchQuery && { search: searchQuery })
      });
      const res = await fetch(`/api/owner/members/inactive?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch inactive members');
      return res.json();
    },
    enabled: mainTab === 'inactive'
  });

  const { goBack } = useBackNavigation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const counts = analytics?.counts || { active: 0, ended: 0, transferredOut: 0, transferredIn: 0 };

  const filteredActiveMembers = analytics?.activeMembers?.filter(m => 
    !memberListSearch || 
    m.username.toLowerCase().includes(memberListSearch.toLowerCase()) ||
    (m.publicId && m.publicId.toLowerCase().includes(memberListSearch.toLowerCase()))
  ) || [];

  const filteredEndedMembers = analytics?.endedMembers?.filter(m => 
    !memberListSearch || 
    m.username.toLowerCase().includes(memberListSearch.toLowerCase()) ||
    (m.publicId && m.publicId.toLowerCase().includes(memberListSearch.toLowerCase()))
  ) || [];

  const filteredTransferredOut = analytics?.transferredOut?.filter(m => 
    !memberListSearch || 
    m.username.toLowerCase().includes(memberListSearch.toLowerCase()) ||
    (m.publicId && m.publicId.toLowerCase().includes(memberListSearch.toLowerCase()))
  ) || [];

  const filteredTransferredIn = analytics?.transferredIn?.filter(m => 
    !memberListSearch || 
    m.username.toLowerCase().includes(memberListSearch.toLowerCase()) ||
    (m.publicId && m.publicId.toLowerCase().includes(memberListSearch.toLowerCase()))
  ) || [];

  const getStatusBadge = (status: 'active' | 'ended' | 'transferred') => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800">Active</Badge>;
      case 'ended':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800">Ended</Badge>;
      case 'transferred':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800">Transferred</Badge>;
    }
  };

  const formatDaysAbsent = (days: number) => {
    if (days >= 9999) return "Never";
    if (days === 0) return "Today";
    if (days === 1) return "1 day";
    return `${days} days`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Member Analytics</h1>
          <p className="text-muted-foreground">Overview of all gym members by status</p>
        </div>
        <Button variant="outline" data-testid="button-back-dashboard" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Users className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="inactive" data-testid="tab-inactive">
            <UserX className="h-4 w-4 mr-2" />
            Inactive Members
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
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
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or member code..."
                    value={memberListSearch}
                    onChange={(e) => setMemberListSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-member-list-search"
                  />
                </div>
              </div>
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
                  {filteredActiveMembers.length > 0 ? (
                    <>
                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {filteredActiveMembers.map((member) => (
                          <Link key={member.id} href={`/owner/members/${member.id}?returnTo=/owner/member-analytics`}>
                            <div className="p-4 rounded-xl border bg-card hover:border-primary/30" data-testid={`card-active-${member.id}`}>
                              <div className="flex items-center justify-between gap-3 mb-2">
                                <div>
                                  <p className="font-semibold text-primary">{member.username}</p>
                                  {member.publicId && <p className="text-xs text-muted-foreground">#{member.publicId}</p>}
                                </div>
                                {member.planName && <Badge variant="outline" className="text-xs">{member.planName}</Badge>}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                                <div><span className="text-muted-foreground">Start:</span> {member.startDate ? format(new Date(member.startDate), "dd MMM yy") : '-'}</div>
                                <div><span className="text-muted-foreground">End:</span> {member.endDate ? format(new Date(member.endDate), "dd MMM yy") : '-'}</div>
                                <div className="col-span-2"><span className="text-muted-foreground">Trainer:</span> {member.trainerName || '-'}</div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
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
                            {filteredActiveMembers.map((member) => (
                              <TableRow key={member.id} data-testid={`row-active-${member.id}`}>
                                <TableCell className="font-medium">
                                  <Link href={`/owner/members/${member.id}?returnTo=/owner/member-analytics`} className="text-primary hover:underline">
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
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No active members{memberListSearch ? ' matching your search' : ''}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ended" className="mt-4">
                  {filteredEndedMembers.length > 0 ? (
                    <>
                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {filteredEndedMembers.map((member) => (
                          <div key={member.id} className="p-4 rounded-xl border bg-card border-amber-500/30 bg-amber-500/5" data-testid={`card-ended-${member.id}`}>
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div>
                                <p className="font-semibold">{member.username}</p>
                                {member.publicId && <p className="text-xs text-muted-foreground">#{member.publicId}</p>}
                              </div>
                              <Badge variant="secondary" className="text-xs">{member.reason}</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
                              <div><span className="text-muted-foreground">Plan:</span> {member.planName || '-'}</div>
                              <div><span className="text-muted-foreground">Start:</span> {member.startDate ? format(new Date(member.startDate), "dd MMM yy") : '-'}</div>
                              <div className="col-span-2"><span className="text-muted-foreground">End:</span> {member.endDate ? format(new Date(member.endDate), "dd MMM yy") : '-'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
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
                            {filteredEndedMembers.map((member) => (
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
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserMinus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No ended subscriptions{memberListSearch ? ' matching your search' : ''}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transferred-out" className="mt-4">
                  {filteredTransferredOut.length > 0 ? (
                    <>
                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {filteredTransferredOut.map((member, index) => (
                          <div key={`${member.id}-${index}`} className="p-4 rounded-xl border bg-card border-red-500/30 bg-red-500/5" data-testid={`card-out-${member.id}`}>
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-sm font-bold text-red-600 shrink-0">
                                {member.username?.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold">{member.username}</p>
                                {member.publicId && <p className="text-xs text-muted-foreground">#{member.publicId}</p>}
                              </div>
                            </div>
                            <div className="text-sm pt-2 border-t space-y-1">
                              <div><span className="text-muted-foreground">To:</span> {member.toGymName}</div>
                              <div><span className="text-muted-foreground">Date:</span> {member.transferDate ? format(new Date(member.transferDate), "dd MMM yyyy") : '-'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Transferred To</TableHead>
                              <TableHead>Transfer Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTransferredOut.map((member, index) => (
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
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No members transferred out{memberListSearch ? ' matching your search' : ''}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transferred-in" className="mt-4">
                  {filteredTransferredIn.length > 0 ? (
                    <>
                      {/* Mobile Card View */}
                      <div className="md:hidden space-y-3">
                        {filteredTransferredIn.map((member, index) => (
                          <Link key={`${member.id}-${index}`} href={`/owner/members/${member.id}`}>
                            <div className="p-4 rounded-xl border bg-card border-green-500/30 bg-green-500/5 hover:border-green-500/50" data-testid={`card-in-${member.id}`}>
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-bold text-green-600 shrink-0">
                                  {member.username?.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-primary">{member.username}</p>
                                  {member.publicId && <p className="text-xs text-muted-foreground">#{member.publicId}</p>}
                                </div>
                              </div>
                              <div className="text-sm pt-2 border-t space-y-1">
                                <div><span className="text-muted-foreground">From:</span> {member.fromGymName}</div>
                                <div><span className="text-muted-foreground">Date:</span> {member.transferDate ? format(new Date(member.transferDate), "dd MMM yyyy") : '-'}</div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                      {/* Desktop Table View */}
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Member</TableHead>
                              <TableHead>Transferred From</TableHead>
                              <TableHead>Transfer Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTransferredIn.map((member, index) => (
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
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No members transferred in{memberListSearch ? ' matching your search' : ''}</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserX className="h-5 w-5" />
                    Inactive Members
                  </CardTitle>
                  <CardDescription>
                    Find members who haven't attended for a specified number of days
                  </CardDescription>
                </div>
                {inactiveMembers && inactiveMembers.length > 0 && (
                  <Link href="/owner/follow-ups?tab=inactive">
                    <Button size="sm" variant="default" data-testid="button-send-bulk-email">
                      <Mail className="h-4 w-4 mr-1.5" />
                      Send Bulk Email
                    </Button>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="days-select">Absent for at least</Label>
                  <Select value={inactiveDays} onValueChange={setInactiveDays}>
                    <SelectTrigger className="w-32" id="days-select" data-testid="select-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inactiveDays === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-days">Days</Label>
                    <Input
                      id="custom-days"
                      type="number"
                      min="1"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      placeholder="Enter days"
                      className="w-24"
                      data-testid="input-custom-days"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="mode-select">Track by</Label>
                  <Select value={trackingMode} onValueChange={(v) => setTrackingMode(v as 'attendance' | 'workouts')}>
                    <SelectTrigger className="w-36" id="mode-select" data-testid="select-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="attendance">Attendance</SelectItem>
                      <SelectItem value="workouts">Workouts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch 
                    id="include-ended"
                    checked={includeEnded}
                    onCheckedChange={setIncludeEnded}
                    data-testid="switch-include-ended"
                  />
                  <Label htmlFor="include-ended" className="text-sm">
                    Include Ended/Expired
                  </Label>
                </div>

                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="search" className="sr-only">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by name, email, or code..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                </div>
              </div>

              {inactiveLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : inactiveMembers && inactiveMembers.length > 0 ? (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3">
                    {inactiveMembers.map((member) => (
                      <div key={member.memberId} className="p-4 rounded-xl border bg-card" data-testid={`card-inactive-${member.memberId}`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <Link href={`/owner/members/${member.memberId}?returnTo=/owner/member-analytics`} className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                              {member.name?.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-primary">{member.name}</p>
                              {member.publicId && <p className="text-xs text-muted-foreground">#{member.publicId}</p>}
                              {member.email && <p className="text-xs text-muted-foreground">{member.email}</p>}
                            </div>
                          </Link>
                          {getStatusBadge(member.status)}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm pt-3 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Last Attended</p>
                            <p className="font-medium">
                              {member.lastAttendedDate 
                                ? format(new Date(member.lastAttendedDate), "dd MMM yy")
                                : <span className="italic text-muted-foreground">Never</span>
                              }
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Days Absent</p>
                            <Badge 
                              variant={member.daysAbsent >= 30 ? "destructive" : member.daysAbsent >= 14 ? "secondary" : "outline"}
                              className={
                                member.daysAbsent >= 30 
                                  ? "" 
                                  : member.daysAbsent >= 14 
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" 
                                    : ""
                              }
                            >
                              {formatDaysAbsent(member.daysAbsent)}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1 pt-3 border-t mt-3">
                          <Link href={`/owner/members/${member.memberId}?returnTo=/owner/member-analytics`}>
                            <Button size="icon" variant="ghost" title="View Profile" data-testid={`button-view-mobile-${member.memberId}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button size="icon" variant="ghost" title="Send Reminder" data-testid={`button-remind-mobile-${member.memberId}`}>
                            <Bell className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Mark Follow-up" data-testid={`button-followup-mobile-${member.memberId}`}>
                            <Flag className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Attended</TableHead>
                          <TableHead>Days Absent</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inactiveMembers.map((member) => (
                          <TableRow key={member.memberId} data-testid={`row-inactive-${member.memberId}`}>
                            <TableCell>
                              <div className="flex flex-col">
                                <Link 
                                  href={`/owner/members/${member.memberId}?returnTo=/owner/member-analytics`} 
                                  className="font-medium text-primary hover:underline"
                                >
                                  {member.name}
                                </Link>
                                {member.publicId && (
                                  <span className="text-xs text-muted-foreground">#{member.publicId}</span>
                                )}
                                {member.email && (
                                  <span className="text-xs text-muted-foreground">{member.email}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(member.status)}
                            </TableCell>
                            <TableCell>
                              {member.lastAttendedDate 
                                ? format(new Date(member.lastAttendedDate), "dd MMM yyyy")
                                : <span className="text-muted-foreground italic">Never checked in</span>
                              }
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={member.daysAbsent >= 30 ? "destructive" : member.daysAbsent >= 14 ? "secondary" : "outline"}
                                className={
                                  member.daysAbsent >= 30 
                                    ? "" 
                                    : member.daysAbsent >= 14 
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" 
                                      : ""
                                }
                              >
                                {formatDaysAbsent(member.daysAbsent)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Link href={`/owner/members/${member.memberId}?returnTo=/owner/member-analytics`}>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    title="View Profile"
                                    data-testid={`button-view-${member.memberId}`}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  title="Send Reminder"
                                  data-testid={`button-remind-${member.memberId}`}
                                >
                                  <Bell className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  title="Mark Follow-up"
                                  data-testid={`button-followup-${member.memberId}`}
                                >
                                  <Flag className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No inactive members found</p>
                  <p className="text-sm mt-1">
                    All members have attended within the last {effectiveDays} days
                  </p>
                </div>
              )}

              {inactiveMembers && inactiveMembers.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  Showing {inactiveMembers.length} member{inactiveMembers.length !== 1 ? 's' : ''} 
                  {' '}absent for {effectiveDays}+ days
                  {trackingMode === 'attendance' ? ' (by attendance)' : ' (by workout completion)'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
