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
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  Mail, Loader2, Send, Settings, Search, Calendar, Users, CreditCard,
  UserX, Clock, AlertCircle, Check, Filter, ChevronRight, Sparkles, BarChart3, Brain
} from "lucide-react";
import { Link } from "wouter";
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
      <Card className="border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
        <CardHeader className="pb-4">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Sender Setup</CardTitle>
            <CardDescription className="text-sm">Configure how emails are sent</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup 
          value={sendMode} 
          onValueChange={(v) => setSendMode(v as "ogym" | "custom")}
          className="space-y-3"
        >
          <div 
            className="flex items-center gap-3 p-4 rounded-xl border bg-background/50 hover-elevate cursor-pointer transition-all" 
            onClick={() => setSendMode("ogym")}
          >
            <RadioGroupItem value="ogym" id="ogym" data-testid="radio-send-ogym" />
            <Label htmlFor="ogym" className="flex-1 cursor-pointer">
              <div className="font-medium">Send via OGym</div>
              <div className="text-sm text-muted-foreground">Quick and reliable</div>
            </Label>
            <Badge className="bg-primary/10 text-primary border-0">Recommended</Badge>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl border opacity-50 cursor-not-allowed">
            <RadioGroupItem value="custom" id="custom" disabled data-testid="radio-send-custom" />
            <Label htmlFor="custom" className="flex-1">
              <div className="font-medium">Send via my email</div>
              <div className="text-sm text-muted-foreground">Coming soon</div>
            </Label>
          </div>
        </RadioGroup>

        {sendMode === "ogym" && (
          <div className="space-y-4 pt-2">
            <div className="p-4 bg-muted/50 rounded-xl">
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">From</div>
              <div className="font-medium">{data?.gymName} &lt;no-reply@ogym.fitness&gt;</div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="replyTo" className="text-sm">Reply-To Email</Label>
              <Input 
                id="replyTo"
                type="email"
                placeholder="Your email for replies"
                value={replyToEmail}
                onChange={(e) => setReplyToEmail(e.target.value)}
                className="h-11"
                data-testid="input-reply-to"
              />
            </div>
            <Button 
              onClick={() => saveMutation.mutate({ sendMode, replyToEmail })}
              disabled={saveMutation.isPending}
              className="w-full sm:w-auto"
              data-testid="button-save-settings"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Save Settings
            </Button>
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
    <Card className="border-0 shadow-sm bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-lg">Compose Message</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject" className="text-sm">Subject</Label>
          <Input 
            id="subject"
            placeholder="Enter email subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-11"
            data-testid={`input-subject-${category}`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message" className="text-sm">Message</Label>
          <Textarea 
            id="message"
            placeholder="Write your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="resize-none"
            data-testid={`textarea-message-${category}`}
          />
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {selectedCount} recipient{selectedCount !== 1 ? 's' : ''} selected
            </span>
          </div>
          <Button 
            onClick={handleSend}
            disabled={selectedCount === 0 || !subject || !message || isPending}
            className="w-full sm:w-auto"
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

function MemberCard({ 
  member, 
  isSelected, 
  onToggle, 
  children,
  testIdPrefix
}: { 
  member: { id: number; name: string; email: string | null }; 
  isSelected: boolean; 
  onToggle: () => void;
  children: React.ReactNode;
  testIdPrefix: string;
}) {
  return (
    <div 
      className={`p-3 rounded-lg border transition-all ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-card hover-elevate'}`}
      data-testid={`card-${testIdPrefix}-${member.id}`}
    >
      <div className="flex items-start gap-2">
        <Checkbox 
          checked={isSelected}
          onCheckedChange={onToggle}
          disabled={!member.email}
          className="mt-0.5"
          data-testid={`checkbox-${testIdPrefix}-${member.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">{member.name}</span>
            {!member.email && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">No email</Badge>
            )}
          </div>
          {member.email && (
            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {children}
          </div>
        </div>
      </div>
    </div>
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

  const emailableCount = filteredMembers.filter(m => m.email).length;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From Date</Label>
              <Input 
                type="date" 
                value={fromDate} 
                onChange={(e) => setFromDate(e.target.value)}
                className="h-10"
                data-testid="input-from-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To Date</Label>
              <Input 
                type="date" 
                value={toDate} 
                onChange={(e) => setToDate(e.target.value)}
                className="h-10"
                data-testid="input-to-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Min Visits</Label>
              <Select value={minVisits} onValueChange={setMinVisits}>
                <SelectTrigger className="h-10" data-testid="select-min-visits">
                  <SelectValue placeholder="Min visits" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">All visitors</SelectItem>
                  <SelectItem value="2">2+ visits</SelectItem>
                  <SelectItem value="3">3+ visits</SelectItem>
                  <SelectItem value="5">5+ visits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Name, email, phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                  data-testid="input-search-daypass"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {emailableCount > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={filteredMembers.filter(m => m.email).every(m => selectedIds.includes(m.id))}
              onCheckedChange={toggleAll}
              data-testid="checkbox-select-all-daypass"
            />
            <span className="text-sm text-muted-foreground">Select all ({emailableCount})</span>
          </div>
          {selectedIds.length > 0 && (
            <Badge variant="secondary">{selectedIds.length} selected</Badge>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground text-sm">No day pass visitors found</p>
            <p className="text-xs text-muted-foreground mt-1">Adjust your filters or date range</p>
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[400px] overflow-y-auto rounded-lg border bg-muted/20 p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredMembers.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                isSelected={selectedIds.includes(member.id)}
                onToggle={() => toggleSelect(member.id)}
                testIdPrefix="daypass"
              >
                <Badge variant="secondary" className="gap-1 text-xs px-1.5 py-0">
                  <Users className="w-2.5 h-2.5" />
                  {member.visitsCount}
                </Badge>
                <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0">
                  <Calendar className="w-2.5 h-2.5" />
                  {format(new Date(member.lastVisitDate), "MMM d")}
                </Badge>
              </MemberCard>
            ))}
          </div>
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
  // Read days from URL parameter (from AI Insights link), default to 30
  const urlParams = new URLSearchParams(window.location.search);
  const initialDays = urlParams.get("days") || "30";
  const [inactiveDays, setInactiveDays] = useState(initialDays);

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

  const emailableCount = filteredMembers.filter(m => m.email).length;

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Inactive Since</Label>
              <Select value={inactiveDays} onValueChange={setInactiveDays}>
                <SelectTrigger className="h-10" data-testid="select-inactive-days">
                  <SelectValue placeholder="Inactive since" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7+ days</SelectItem>
                  <SelectItem value="14">14+ days</SelectItem>
                  <SelectItem value="30">30+ days</SelectItem>
                  <SelectItem value="60">60+ days</SelectItem>
                  <SelectItem value="90">90+ days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                  data-testid="input-search-inactive"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {emailableCount > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={filteredMembers.filter(m => m.email).every(m => selectedIds.includes(m.id))}
              onCheckedChange={toggleAll}
              data-testid="checkbox-select-all-inactive"
            />
            <span className="text-sm text-muted-foreground">Select all ({emailableCount})</span>
          </div>
          {selectedIds.length > 0 && (
            <Badge variant="secondary">{selectedIds.length} selected</Badge>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-green-500" />
            </div>
            <p className="font-medium text-foreground text-sm">All members are active!</p>
            <p className="text-xs text-muted-foreground mt-1">Great news - no inactive members</p>
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[400px] overflow-y-auto rounded-lg border bg-muted/20 p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredMembers.map(member => (
              <MemberCard
                key={member.id}
                member={member}
                isSelected={selectedIds.includes(member.id)}
                onToggle={() => toggleSelect(member.id)}
                testIdPrefix="inactive"
              >
                <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0">
                  <Clock className="w-2.5 h-2.5" />
                  {member.lastVisit ? format(new Date(member.lastVisit), "MMM d") : "Never"}
                </Badge>
                <Badge 
                  variant={member.membershipStatus === "active" ? "default" : "secondary"}
                  className="text-xs px-1.5 py-0"
                >
                  {member.membershipStatus.replace("_", " ")}
                </Badge>
              </MemberCard>
            ))}
          </div>
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

  const emailableCount = filteredMembers.filter(m => m.email).length;

  const filterButtons = [
    { key: "expires_soon", label: "Expires 7d", icon: Clock, color: "text-amber-500" },
    { key: "next_month", label: "Next 30d", icon: Calendar, color: "text-blue-500" },
    { key: "balance", label: "Has balance", icon: CreditCard, color: "text-purple-500" },
    { key: "expired", label: "Expired", icon: AlertCircle, color: "text-red-500" },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Quick Filters</span>
          </div>
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {filterButtons.map(({ key, label, icon: Icon, color }) => (
                <Button 
                  key={key}
                  variant={filterType === key ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setFilterType(filterType === key ? "" : key)}
                  className="whitespace-nowrap flex-shrink-0"
                  data-testid={`filter-${key}`}
                >
                  <Icon className={`w-4 h-4 mr-1.5 ${filterType === key ? "" : color}`} />
                  {label}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10"
                data-testid="input-search-payments"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {emailableCount > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={filteredMembers.filter(m => m.email).every(m => selectedIds.includes(m.id))}
              onCheckedChange={toggleAll}
              data-testid="checkbox-select-all-payments"
            />
            <span className="text-sm text-muted-foreground">Select all ({emailableCount})</span>
          </div>
          {selectedIds.length > 0 && (
            <Badge variant="secondary">{selectedIds.length} selected</Badge>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground text-sm">No members found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[400px] overflow-y-auto rounded-lg border bg-muted/20 p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredMembers.map(member => {
              const isExpired = member.expiryDate && new Date(member.expiryDate) < new Date();
              return (
                <MemberCard
                  key={member.id}
                  member={member}
                  isSelected={selectedIds.includes(member.id)}
                  onToggle={() => toggleSelect(member.id)}
                  testIdPrefix="payment"
                >
                  {member.planName && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{member.planName}</Badge>
                  )}
                  {member.expiryDate && (
                    <Badge variant={isExpired ? "destructive" : "outline"} className="gap-1 text-xs px-1.5 py-0">
                      <Calendar className="w-2.5 h-2.5" />
                      {format(new Date(member.expiryDate), "MMM d")}
                    </Badge>
                  )}
                  {member.balance > 0 && (
                    <Badge variant="destructive" className="gap-1 text-xs px-1.5 py-0">
                      <CreditCard className="w-2.5 h-2.5" />
                      {formatAmount(member.balance)}
                    </Badge>
                  )}
                  {member.balance === 0 && (
                    <Badge className="bg-green-500/10 text-green-600 border-0 text-xs px-1.5 py-0">Paid</Badge>
                  )}
                </MemberCard>
              );
            })}
          </div>
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
  // Read ?tab= from URL and default to that tab
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "daypass";
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Send targeted emails to your members</p>
        </div>
        <div className="flex gap-2">
          <Link href="/owner/member-analytics?tab=inactive">
            <Button variant="outline" size="sm" data-testid="link-member-analytics">
              <BarChart3 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Analytics</span>
            </Button>
          </Link>
          <Link href="/owner/ai-insights">
            <Button variant="outline" size="sm" data-testid="link-ai-insights">
              <Brain className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">AI Insights</span>
            </Button>
          </Link>
        </div>
      </div>

      <SenderSetupCard />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <ScrollArea className="w-full">
          <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-3 sm:w-full h-auto p-1 gap-1">
            <TabsTrigger 
              value="daypass" 
              className="flex-1 py-2.5 px-4 data-[state=active]:shadow-sm whitespace-nowrap"
              data-testid="tab-daypass"
            >
              <Users className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Day Pass</span>
              <span className="sm:hidden">Day Pass</span>
            </TabsTrigger>
            <TabsTrigger 
              value="inactive" 
              className="flex-1 py-2.5 px-4 data-[state=active]:shadow-sm whitespace-nowrap"
              data-testid="tab-inactive"
            >
              <UserX className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Inactive</span>
              <span className="sm:hidden">Inactive</span>
            </TabsTrigger>
            <TabsTrigger 
              value="payments" 
              className="flex-1 py-2.5 px-4 data-[state=active]:shadow-sm whitespace-nowrap"
              data-testid="tab-payments"
            >
              <CreditCard className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Payments</span>
              <span className="sm:hidden">Payments</span>
            </TabsTrigger>
          </TabsList>
          <ScrollBar orientation="horizontal" className="sm:hidden" />
        </ScrollArea>

        <TabsContent value="daypass" className="mt-4">
          <DayPassTab />
        </TabsContent>

        <TabsContent value="inactive" className="mt-4">
          <InactiveTab />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
