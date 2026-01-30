import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Mail, Loader2, Send, Settings, Search, Calendar, Users, CreditCard,
  UserX, Clock, AlertCircle, ChevronRight, Check, Filter
} from "lucide-react";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type EmailSettings = {
  sendMode: "ogym" | "custom";
  replyToEmail?: string;
  connectedProvider?: "gmail" | "outlook";
  connectedEmail?: string;
};

type DayPassMember = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  visitsCount: number;
  lastVisitDate: string;
  dayPassCount: number;
};

type InactiveMember = {
  id: number;
  name: string;
  email: string | null;
  lastVisit: string | null;
  membershipStatus: string;
};

type PaymentMember = {
  id: number;
  name: string;
  email: string | null;
  planName: string | null;
  expiryDate: string | null;
  balance: number;
  lastPaymentDate: string | null;
  status: string;
};

function SenderSetupCard() {
  const { toast } = useToast();
  
  const { data, isLoading } = useQuery<{ settings: EmailSettings; gymName: string }>({
    queryKey: ["/api/gym/email/settings"]
  });

  const [sendMode, setSendMode] = useState<"ogym" | "custom">("ogym");
  const [replyToEmail, setReplyToEmail] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (data: { sendMode: string; replyToEmail: string }) => {
      return apiRequest("POST", "/api/gym/email/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gym/email/settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    }
  });

  useEffect(() => {
    if (data?.settings) {
      setSendMode(data.settings.sendMode || "ogym");
      setReplyToEmail(data.settings.replyToEmail || "");
    }
  }, [data]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Sender Setup</CardTitle>
        </div>
        <CardDescription>Configure how emails are sent to your members</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup 
          value={sendMode} 
          onValueChange={(v) => setSendMode(v as "ogym" | "custom")}
          className="space-y-3"
        >
          <div className="flex items-center space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer" onClick={() => setSendMode("ogym")}>
            <RadioGroupItem value="ogym" id="ogym" data-testid="radio-send-ogym" />
            <Label htmlFor="ogym" className="flex-1 cursor-pointer">
              <div className="font-medium">Send via OGym</div>
              <div className="text-sm text-muted-foreground">Quick and recommended</div>
            </Label>
            <Badge variant="secondary">Recommended</Badge>
          </div>
          <div className="flex items-center space-x-3 p-3 rounded-lg border opacity-50 cursor-not-allowed">
            <RadioGroupItem value="custom" id="custom" disabled data-testid="radio-send-custom" />
            <Label htmlFor="custom" className="flex-1">
              <div className="font-medium">Send via my email</div>
              <div className="text-sm text-muted-foreground">Connect Gmail or Outlook (Coming soon)</div>
            </Label>
          </div>
        </RadioGroup>

        {sendMode === "ogym" && (
          <div className="space-y-3 pt-2">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground">From:</div>
              <div className="font-medium">{data?.gymName} &lt;no-reply@ogym.fitness&gt;</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replyTo">Reply-To Email</Label>
              <Input 
                id="replyTo"
                type="email"
                placeholder="Your email for replies"
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
                data-testid="input-reply-to"
              />
            </div>
            <Button 
              onClick={() => saveMutation.mutate({ sendMode, replyToEmail })}
              disabled={saveMutation.isPending}
              data-testid="button-save-settings"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
          </div>
        )}

        {sendMode === "custom" && (
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <Button variant="outline" disabled>
                Connect Gmail
              </Button>
              <Button variant="outline" disabled>
                Connect Outlook
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">OAuth integration coming soon</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageComposer({ 
  selectedCount, 
  onSend, 
  isPending,
  category
}: { 
  selectedCount: number; 
  onSend: (subject: string, message: string) => void; 
  isPending: boolean;
  category: string;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (subject && message) {
      onSend(subject, message);
      setSubject("");
      setMessage("");
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Compose Message</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input 
            id="subject"
            placeholder="Enter email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            data-testid={`input-subject-${category}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea 
            id="message"
            placeholder="Write your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            data-testid={`textarea-message-${category}`}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selectedCount} recipient{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <Button 
            onClick={handleSend}
            disabled={selectedCount === 0 || !subject || !message || isPending}
            data-testid={`button-send-${category}`}
          >
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send to Selected
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DayPassTab() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [minVisits, setMinVisits] = useState("1");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const buildDayPassUrl = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (minVisits && minVisits !== "1") params.set("min_visits", minVisits);
    if (search) params.set("search", search);
    const qs = params.toString();
    return `/api/followups/daypass${qs ? `?${qs}` : ""}`;
  };

  const { data: members = [], isLoading } = useQuery<DayPassMember[]>({
    queryKey: ["/api/followups/daypass", fromDate, toDate, minVisits, search],
    queryFn: async () => {
      const res = await fetch(buildDayPassUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch day pass members");
      return res.json();
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { category: string; member_ids: number[]; subject: string; message: string }) => {
      return apiRequest("POST", "/api/followups/send", data);
    },
    onSuccess: (data: any) => {
      toast({ title: `Sent ${data.sent} email(s)` });
      setSelectedIds([]);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const emailMembers = members.filter(m => m.email);
    if (emailMembers.every(m => selectedIds.includes(m.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(emailMembers.map(m => m.id));
    }
  };

  const handleSend = (subject: string, message: string) => {
    sendMutation.mutate({
      category: "DAY_PASS",
      member_ids: selectedIds,
      subject,
      message
    });
  };

  const filteredMembers = useMemo(() => {
    let filtered = members;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m => 
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phone?.includes(q)
      );
    }
    return filtered;
  }, [members, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">From:</Label>
          <Input 
            type="date" 
            value={fromDate} 
            onChange={(e) => setFromDate(e.target.value)}
            className="w-36 h-8"
            data-testid="input-from-date"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">To:</Label>
          <Input 
            type="date" 
            value={toDate} 
            onChange={(e) => setToDate(e.target.value)}
            className="w-36 h-8"
            data-testid="input-to-date"
          />
        </div>
        <Select value={minVisits} onValueChange={setMinVisits}>
          <SelectTrigger className="w-40 h-8" data-testid="select-min-visits">
            <SelectValue placeholder="Min visits" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">All visitors</SelectItem>
            <SelectItem value="2">2+ visits</SelectItem>
            <SelectItem value="3">3+ visits</SelectItem>
            <SelectItem value="5">5+ visits</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search name, email, phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
            data-testid="input-search-daypass"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No day pass visitors found</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={filteredMembers.filter(m => m.email).every(m => selectedIds.includes(m.id))}
                    onCheckedChange={toggleAll}
                    data-testid="checkbox-select-all-daypass"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-center">Visits</TableHead>
                <TableHead>Last Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map(member => (
                <TableRow key={member.id} data-testid={`row-daypass-${member.id}`}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.includes(member.id)}
                      onCheckedChange={() => toggleSelect(member.id)}
                      disabled={!member.email}
                      data-testid={`checkbox-daypass-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>{member.phone || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{member.visitsCount}</Badge>
                  </TableCell>
                  <TableCell>{format(new Date(member.lastVisitDate), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MessageComposer 
        selectedCount={selectedIds.length} 
        onSend={handleSend}
        isPending={sendMutation.isPending}
        category="daypass"
      />
    </div>
  );
}

function InactiveTab() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [inactiveDays, setInactiveDays] = useState("30");

  const buildInactiveUrl = () => {
    const params = new URLSearchParams();
    if (inactiveDays) params.set("inactive_days", inactiveDays);
    if (search) params.set("search", search);
    const qs = params.toString();
    return `/api/followups/inactive${qs ? `?${qs}` : ""}`;
  };

  const { data: members = [], isLoading } = useQuery<InactiveMember[]>({
    queryKey: ["/api/followups/inactive", inactiveDays, search],
    queryFn: async () => {
      const res = await fetch(buildInactiveUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inactive members");
      return res.json();
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { category: string; member_ids: number[]; subject: string; message: string }) => {
      return apiRequest("POST", "/api/followups/send", data);
    },
    onSuccess: (data: any) => {
      toast({ title: `Sent ${data.sent} email(s)` });
      setSelectedIds([]);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const emailMembers = members.filter(m => m.email);
    if (emailMembers.every(m => selectedIds.includes(m.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(emailMembers.map(m => m.id));
    }
  };

  const handleSend = (subject: string, message: string) => {
    sendMutation.mutate({
      category: "INACTIVE",
      member_ids: selectedIds,
      subject,
      message
    });
  };

  const filteredMembers = useMemo(() => {
    let filtered = members;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m => 
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [members, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={inactiveDays} onValueChange={setInactiveDays}>
          <SelectTrigger className="w-48 h-8" data-testid="select-inactive-days">
            <SelectValue placeholder="Inactive since" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Inactive 7+ days</SelectItem>
            <SelectItem value="14">Inactive 14+ days</SelectItem>
            <SelectItem value="30">Inactive 30+ days</SelectItem>
            <SelectItem value="60">Inactive 60+ days</SelectItem>
            <SelectItem value="90">Inactive 90+ days</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
            data-testid="input-search-inactive"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <UserX className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No inactive members found</p>
          <p className="text-sm mt-1">Great news! All your members are active.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={filteredMembers.filter(m => m.email).every(m => selectedIds.includes(m.id))}
                    onCheckedChange={toggleAll}
                    data-testid="checkbox-select-all-inactive"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map(member => (
                <TableRow key={member.id} data-testid={`row-inactive-${member.id}`}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.includes(member.id)}
                      onCheckedChange={() => toggleSelect(member.id)}
                      disabled={!member.email}
                      data-testid={`checkbox-inactive-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    {member.lastVisit ? format(new Date(member.lastVisit), "MMM d, yyyy") : <span className="text-muted-foreground">Never</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.membershipStatus === "active" ? "default" : "secondary"}>
                      {member.membershipStatus.replace("_", " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MessageComposer 
        selectedCount={selectedIds.length} 
        onSend={handleSend}
        isPending={sendMutation.isPending}
        category="inactive"
      />
    </div>
  );
}

function PaymentsTab() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");

  const buildPaymentsUrl = () => {
    const params = new URLSearchParams();
    if (filterType) params.set("type", filterType);
    if (search) params.set("search", search);
    const qs = params.toString();
    return `/api/followups/payments${qs ? `?${qs}` : ""}`;
  };

  const { data: members = [], isLoading } = useQuery<PaymentMember[]>({
    queryKey: ["/api/followups/payments", filterType, search],
    queryFn: async () => {
      const res = await fetch(buildPaymentsUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payment members");
      return res.json();
    }
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { category: string; member_ids: number[]; subject: string; message: string }) => {
      return apiRequest("POST", "/api/followups/send", data);
    },
    onSuccess: (data: any) => {
      toast({ title: `Sent ${data.sent} email(s)` });
      setSelectedIds([]);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const emailMembers = members.filter(m => m.email);
    if (emailMembers.every(m => selectedIds.includes(m.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(emailMembers.map(m => m.id));
    }
  };

  const handleSend = (subject: string, message: string) => {
    sendMutation.mutate({
      category: "PAYMENTS",
      member_ids: selectedIds,
      subject,
      message
    });
  };

  const filteredMembers = useMemo(() => {
    let filtered = members;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m => 
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [members, search]);

  const formatAmount = (paise: number) => {
    return `₹${(paise / 100).toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/30 rounded-lg">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex flex-wrap gap-2">
          <Button 
            variant={filterType === "expires_soon" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilterType(filterType === "expires_soon" ? "" : "expires_soon")}
            data-testid="filter-expires-soon"
          >
            <Clock className="w-4 h-4 mr-1" />
            Expires in 7 days
          </Button>
          <Button 
            variant={filterType === "next_month" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilterType(filterType === "next_month" ? "" : "next_month")}
            data-testid="filter-next-month"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Expires next month
          </Button>
          <Button 
            variant={filterType === "balance" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilterType(filterType === "balance" ? "" : "balance")}
            data-testid="filter-balance"
          >
            <CreditCard className="w-4 h-4 mr-1" />
            Has balance
          </Button>
          <Button 
            variant={filterType === "expired" ? "default" : "outline"} 
            size="sm"
            onClick={() => setFilterType(filterType === "expired" ? "" : "expired")}
            data-testid="filter-expired"
          >
            <AlertCircle className="w-4 h-4 mr-1" />
            Expired
          </Button>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8"
            data-testid="input-search-payments"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No members found matching this filter</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={filteredMembers.filter(m => m.email).every(m => selectedIds.includes(m.id))}
                    onCheckedChange={toggleAll}
                    data-testid="checkbox-select-all-payments"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Last Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map(member => (
                <TableRow key={member.id} data-testid={`row-payment-${member.id}`}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedIds.includes(member.id)}
                      onCheckedChange={() => toggleSelect(member.id)}
                      disabled={!member.email}
                      data-testid={`checkbox-payment-${member.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  <TableCell>{member.email || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>{member.planName || <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    {member.expiryDate ? (
                      <span className={new Date(member.expiryDate) < new Date() ? "text-red-500" : ""}>
                        {format(new Date(member.expiryDate), "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.balance > 0 ? (
                      <Badge variant="destructive">{formatAmount(member.balance)}</Badge>
                    ) : (
                      <Badge variant="secondary">Paid</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.lastPaymentDate ? format(new Date(member.lastPaymentDate), "MMM d, yyyy") : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <MessageComposer 
        selectedCount={selectedIds.length} 
        onSend={handleSend}
        isPending={sendMutation.isPending}
        category="payments"
      />
    </div>
  );
}

export default function OwnerFollowUpsPage() {
  const [activeTab, setActiveTab] = useState("daypass");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Follow-ups</h2>
        <p className="text-muted-foreground mt-1">Send targeted emails to day pass visitors, inactive members, and payment reminders</p>
      </div>

      <SenderSetupCard />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daypass" data-testid="tab-daypass">
            <Users className="w-4 h-4 mr-2" />
            Day Pass Members
          </TabsTrigger>
          <TabsTrigger value="inactive" data-testid="tab-inactive">
            <UserX className="w-4 h-4 mr-2" />
            Inactive Members
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">
            <CreditCard className="w-4 h-4 mr-2" />
            Payments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daypass">
          <DayPassTab />
        </TabsContent>

        <TabsContent value="inactive">
          <InactiveTab />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
