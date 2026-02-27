import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  UserX, Clock, AlertCircle, Check, Filter, ChevronRight, Sparkles, BarChart3, Brain,
  Target, Zap, TrendingUp, RefreshCw, CheckCircle2, XCircle,
  MessageSquare, Star, UserPlus, AlertTriangle, ArrowRight, Phone, Gift,
  Trophy, DollarSign, UserCheck, Activity
} from "lucide-react";
import { Link } from "wouter";
import { format, subDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type EmailSettings = {
  sendMode: "ogym" | "custom";
  senderName?: string;
  replyToEmail?: string;
  connectedProvider?: "gmail" | "outlook";
  connectedEmail?: string;
};

type QueueItem = {
  memberId: number;
  name: string;
  email: string | null;
  category: 'churn_risk' | 'expiring' | 'inactive' | 'payment_due' | 'new_member';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  details: Record<string, any>;
  alreadyContacted: boolean;
};

type AiQueueData = {
  queue: QueueItem[];
  summary: {
    churnRisk: number;
    expiring: number;
    inactive: number;
    paymentDue: number;
    newMember: number;
    total: number;
    contactedToday: number;
  };
};

type TrackingData = {
  period: string;
  totalSent: number;
  returned: number;
  pending: number;
  notReturned: number;
  successRate: number;
  sentThisWeek: number;
  byReason: Record<string, { sent: number; returned: number }>;
  recentActions: Array<{
    id: number;
    memberId: number;
    actionType: string;
    triggerReason: string;
    returned: boolean | null;
    createdAt: string;
  }>;
};

type AiSuggestion = {
  id: string;
  label: string;
  active: boolean;
};

type OutcomesData = {
  period: string;
  totalSent: number;
  outcomes: {
    returned: number;
    paid: number;
    renewed: number;
    converted: number;
    pending: number;
    noResponse: number;
  };
  successRate: number;
  recentOutcomes: Array<{
    id: number;
    memberId: number;
    memberName: string;
    outcomeType: string;
    followUpGoal: string | null;
    triggerReason: string | null;
    daysSinceIntervention: number | null;
    outcomeDetectedAt: string | null;
    createdAt: string;
  }>;
  pendingActions: Array<{
    id: number;
    memberId: number;
    memberName: string;
    triggerReason: string | null;
    followUpGoal: string | null;
    daysSinceContact: number;
    suggestion: string;
    dueDate: string | null;
    createdAt: string;
  }>;
};

type PerformanceData = {
  period: string;
  totalSent: number;
  goalPerformance: Array<{
    goal: string;
    label: string;
    sent: number;
    returned: number;
    paid: number;
    renewed: number;
    converted: number;
    successRate: number;
  }>;
  categoryPerformance: Array<{
    category: string;
    label: string;
    sent: number;
    returned: number;
    paid: number;
    renewed: number;
    converted: number;
    successRate: number;
  }>;
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  churn_risk: { label: "Churn Risk", icon: AlertTriangle, color: "text-red-500", bgColor: "bg-red-500/10" },
  expiring: { label: "Expiring", icon: Clock, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  inactive: { label: "Inactive", icon: UserX, color: "text-orange-500", bgColor: "bg-orange-500/10" },
  payment_due: { label: "Payment Due", icon: CreditCard, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  new_member: { label: "New Member", icon: UserPlus, color: "text-blue-500", bgColor: "bg-blue-500/10" },
};

const GOAL_OPTIONS = [
  { value: "bring_back", label: "Bring member back", icon: RefreshCw, description: "Motivational message to return" },
  { value: "renew", label: "Renew membership", icon: Star, description: "Encourage renewal" },
  { value: "collect_payment", label: "Collect payment", icon: CreditCard, description: "Professional payment reminder" },
  { value: "welcome", label: "Welcome new member", icon: UserPlus, description: "Warm onboarding message" },
  { value: "general", label: "General check-in", icon: MessageSquare, description: "Friendly follow-up" },
];

function getDefaultGoal(category: string): string {
  switch (category) {
    case 'churn_risk': return 'bring_back';
    case 'expiring': return 'renew';
    case 'inactive': return 'bring_back';
    case 'payment_due': return 'collect_payment';
    case 'new_member': return 'welcome';
    default: return 'general';
  }
}

function AiQueueSummary({ summary, onFilter, activeFilter }: { 
  summary: AiQueueData['summary']; 
  onFilter: (cat: string | null) => void;
  activeFilter: string | null;
}) {
  const categories = [
    { key: 'churn_risk', count: summary.churnRisk, ...CATEGORY_CONFIG.churn_risk },
    { key: 'expiring', count: summary.expiring, ...CATEGORY_CONFIG.expiring },
    { key: 'inactive', count: summary.inactive, ...CATEGORY_CONFIG.inactive },
    { key: 'payment_due', count: summary.paymentDue, ...CATEGORY_CONFIG.payment_due },
    { key: 'new_member', count: summary.newMember, ...CATEGORY_CONFIG.new_member },
  ].filter(c => c.count > 0);

  return (
    <div className="relative overflow-hidden rounded-2xl" data-testid="ai-queue-summary">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/90 via-primary/85 to-indigo-700/90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
      
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/10 shadow-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white tracking-tight">Dika AI Today's Follow-ups</h3>
            <p className="text-white/70 text-sm mt-0.5">
              {summary.total > 0 ? (
                <>
                  <span className="text-white font-semibold">{summary.total}</span> member{summary.total !== 1 ? 's' : ''} need your attention
                  {summary.contactedToday > 0 && (
                    <span className="ml-1.5">
                      · <span className="text-emerald-300">{summary.contactedToday} already contacted</span>
                    </span>
                  )}
                </>
              ) : "Everyone's on track today"}
            </p>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-5">
            {categories.map(({ key, count, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => onFilter(activeFilter === key ? null : key)}
                className={`group flex items-center gap-2.5 p-3 rounded-xl transition-all ${
                  activeFilter === key 
                    ? 'bg-white/30 ring-1 ring-white/40 shadow-lg' 
                    : 'bg-white/15 hover:bg-white/22 border border-white/15'
                }`}
                data-testid={`filter-${key}`}
              >
                <Icon className="w-4 h-4 text-white shrink-0" />
                <div className="text-left min-w-0">
                  <div className="text-lg font-bold text-white leading-none">{count}</div>
                  <div className="text-[10px] text-white/80 uppercase tracking-wider mt-0.5 truncate">{label}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onFilter(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeFilter === null 
                ? 'bg-white text-primary shadow-md' 
                : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10'
            }`}
            data-testid="filter-all"
          >
            Show All ({summary.total})
          </button>
          {activeFilter && (
            <button
              onClick={() => onFilter(null)}
              className="px-3 py-1.5 rounded-full text-xs text-white/60 hover:text-white/90 transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueMemberCard({ 
  item, 
  isSelected, 
  onSelect 
}: { 
  item: QueueItem; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const config = CATEGORY_CONFIG[item.category];
  const Icon = config?.icon || AlertCircle;

  const priorityIndicator = item.priority === 'high' 
    ? 'from-red-500 to-red-600' 
    : item.priority === 'medium' 
    ? 'from-amber-400 to-amber-500' 
    : 'from-gray-300 to-gray-400';

  return (
    <div 
      className={`group relative rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden ${
        isSelected 
          ? 'border-primary/40 bg-primary/5 ring-2 ring-primary/20 shadow-md shadow-primary/5' 
          : 'bg-card hover:bg-accent/30 hover:border-border/80 hover:shadow-sm'
      } ${item.alreadyContacted ? 'opacity-50' : ''}`}
      onClick={() => item.email && onSelect()}
      data-testid={`queue-card-${item.memberId}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-gradient-to-b ${priorityIndicator}`} />
      
      <div className="p-3.5 pl-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${config?.bgColor || 'bg-muted'} shrink-0`}>
            <Icon className={`w-4 h-4 ${config?.color || 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground truncate">{item.name}</span>
              {!item.email && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted/50">No email</Badge>
              )}
              {item.alreadyContacted && (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px] px-1.5 py-0">
                  <Check className="w-2.5 h-2.5 mr-0.5" />
                  Contacted
                </Badge>
              )}
            </div>
            {item.email && (
              <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{item.email}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">{item.reason}</p>
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${
                item.priority === 'high' ? 'bg-red-500/10 text-red-500 dark:text-red-400' :
                item.priority === 'medium' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                'bg-muted text-muted-foreground'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  item.priority === 'high' ? 'bg-red-500' :
                  item.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-400'
                }`} />
                {item.priority}
              </span>
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted/50 font-medium">
                {config?.label || item.category}
              </Badge>
            </div>
          </div>
          {item.email && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <Checkbox 
                checked={isSelected} 
                onCheckedChange={() => onSelect()}
                className="mt-0.5 h-5 w-5"
                data-testid={`checkbox-queue-${item.memberId}`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GoalSelector({ 
  selectedGoal, 
  onSelect, 
  category 
}: { 
  selectedGoal: string; 
  onSelect: (goal: string) => void; 
  category: string;
}) {
  const defaultGoal = getDefaultGoal(category);

  return (
    <Card className="border-0 shadow-sm" data-testid="goal-selector">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">What's your goal?</CardTitle>
            <CardDescription className="text-xs">AI will craft the perfect message</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {GOAL_OPTIONS.map(({ value, label, icon: GoalIcon, description }) => (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                selectedGoal === value 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
                  : 'hover:bg-accent/50 hover:border-accent'
              } ${value === defaultGoal && selectedGoal !== value ? 'border-dashed border-primary/30' : ''}`}
              data-testid={`goal-${value}`}
            >
              <GoalIcon className={`w-4 h-4 mt-0.5 shrink-0 ${selectedGoal === value ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <div className={`text-sm font-medium ${selectedGoal === value ? 'text-primary' : 'text-foreground'}`}>
                  {label}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>
              </div>
              {value === defaultGoal && selectedGoal !== value && (
                <Badge className="bg-primary/10 text-primary border-0 text-[9px] px-1 py-0 ml-auto shrink-0">
                  Suggested
                </Badge>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AiMessageComposer({ 
  selectedItems,
  goal,
  onSend,
  isPending,
}: { 
  selectedItems: QueueItem[];
  goal: string;
  onSend: (subject: string, message: string, memberIds: number[]) => void;
  isPending: boolean;
}) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const prevGenKey = useRef("");

  const firstSelected = selectedItems[0];
  const genKey = `${firstSelected?.memberId}-${firstSelected?.category}-${goal}`;

  const generateMutation = useMutation({
    mutationFn: async (data: { memberId: number; memberName: string; category: string; goal: string; reason: string; details: Record<string, any> }) => {
      const res = await apiRequest("POST", "/api/followups/ai-generate-message", data);
      return await res.json() as { subject: string; message: string; suggestions: AiSuggestion[] };
    },
    onSuccess: (data) => {
      setSubject(data.subject);
      setMessage(data.message);
      setSuggestions(data.suggestions || []);
      setHasGenerated(true);
      prevGenKey.current = genKey;
    },
    onError: (error: Error) => {
      toast({ title: "AI generation failed", description: error.message, variant: "destructive" });
    }
  });

  useEffect(() => {
    if (firstSelected && goal && genKey !== prevGenKey.current) {
      generateMutation.mutate({
        memberId: firstSelected.memberId,
        memberName: firstSelected.name,
        category: firstSelected.category,
        goal,
        reason: firstSelected.reason,
        details: firstSelected.details,
      });
    }
  }, [firstSelected?.memberId, firstSelected?.category, goal]);

  const toggleSuggestion = (id: string) => {
    setSuggestions(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const handleRegenerate = () => {
    if (firstSelected) {
      prevGenKey.current = "";
      generateMutation.mutate({
        memberId: firstSelected.memberId,
        memberName: firstSelected.name,
        category: firstSelected.category,
        goal,
        reason: firstSelected.reason,
        details: firstSelected.details,
      });
    }
  };

  const handleSend = () => {
    if (subject && message && selectedItems.length > 0) {
      const activeSuggestions = suggestions.filter(s => s.active);
      let finalMessage = message;
      if (activeSuggestions.length > 0) {
        finalMessage += "\n\n" + activeSuggestions.map(s => `• ${s.label}`).join("\n");
      }
      onSend(subject, finalMessage, selectedItems.map(i => i.memberId));
    }
  };

  if (selectedItems.length === 0) {
    return (
      <Card className="border-0 shadow-sm border-dashed">
        <CardContent className="py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Mail className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Select a member to get started</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Dika AI will write the message for you</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-card to-primary/5" data-testid="ai-message-composer">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-violet-600 shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">AI-Crafted Message</CardTitle>
              <CardDescription className="text-xs">
                {selectedItems.length === 1 
                  ? `For ${firstSelected?.name}` 
                  : `For ${selectedItems.length} members`}
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRegenerate}
            disabled={generateMutation.isPending}
            data-testid="button-regenerate"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {generateMutation.isPending && !hasGenerated ? (
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Dika is writing the perfect message...</span>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="ai-subject" className="text-xs text-muted-foreground flex items-center gap-1.5">
                Subject
                {generateMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              </Label>
              <Input 
                id="ai-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-10 bg-background text-foreground border-border"
                data-testid="input-ai-subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-message" className="text-xs text-muted-foreground flex items-center gap-1.5">
                Message
                <Badge className="bg-primary/10 text-primary border-0 text-[9px] px-1 py-0">AI Generated</Badge>
              </Label>
              <Textarea 
                id="ai-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="resize-none bg-background text-foreground border-border"
                data-testid="textarea-ai-message"
              />
            </div>

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Suggested actions</Label>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => toggleSuggestion(s.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        s.active 
                          ? 'bg-primary/10 text-primary border-primary/30' 
                          : 'bg-background text-muted-foreground border-border hover:border-primary/20'
                      }`}
                      data-testid={`suggestion-${s.id}`}
                    >
                      {s.active ? <CheckCircle2 className="w-3 h-3" /> : <Check className="w-3 h-3 opacity-40" />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-muted-foreground">
                  {selectedItems.length} recipient{selectedItems.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              <Button 
                onClick={handleSend}
                disabled={!subject || !message || isPending}
                className="w-full sm:w-auto bg-gradient-to-r from-primary to-violet-600 hover:opacity-90"
                data-testid="button-send-ai"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send to {selectedItems.length > 1 ? `${selectedItems.length} Members` : firstSelected?.name}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AiTrackingCard() {
  const { data: tracking, isLoading } = useQuery<TrackingData>({
    queryKey: ["/api/followups/ai-tracking"],
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  if (!tracking || tracking.totalSent === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-card to-muted/10" data-testid="ai-tracking">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Follow-up Results</h4>
              <p className="text-[11px] text-muted-foreground">Last 30 days</p>
            </div>
          </div>
          {tracking.sentThisWeek > 0 && (
            <Badge className="bg-primary/10 text-primary border-0 text-[10px] px-2 py-0.5">
              <Sparkles className="w-3 h-3 mr-1" />
              {tracking.sentThisWeek} this week
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="relative p-3 rounded-xl bg-muted/30 text-center overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-500" />
            <div className="text-xl font-bold text-foreground">{tracking.totalSent}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">Sent</div>
          </div>
          <div className="relative p-3 rounded-xl bg-emerald-500/5 text-center overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-500" />
            <div className="text-xl font-bold text-emerald-600">{tracking.returned}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">Returned</div>
          </div>
          <div className="relative p-3 rounded-xl bg-amber-500/5 text-center overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-500" />
            <div className="text-xl font-bold text-amber-600">{tracking.pending}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">Pending</div>
          </div>
          <div className="relative p-3 rounded-xl bg-primary/5 text-center overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary to-violet-500" />
            <div className="text-xl font-bold text-primary">{tracking.successRate}%</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">Success</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const OUTCOME_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
  returned: { label: "Returned", icon: UserCheck, color: "text-emerald-600", bgColor: "bg-emerald-500/10" },
  paid: { label: "Paid", icon: DollarSign, color: "text-blue-600", bgColor: "bg-blue-500/10" },
  renewed: { label: "Renewed", icon: RefreshCw, color: "text-violet-600", bgColor: "bg-violet-500/10" },
  converted: { label: "Converted", icon: Trophy, color: "text-amber-600", bgColor: "bg-amber-500/10" },
};

function ResultsView() {
  const { data: outcomes, isLoading: outcomesLoading } = useQuery<OutcomesData>({
    queryKey: ["/api/followups/outcomes"],
  });
  const { data: performance, isLoading: perfLoading } = useQuery<PerformanceData>({
    queryKey: ["/api/followups/performance"],
  });

  const { toast } = useToast();
  const detectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/followups/detect-outcomes", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/followups/outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followups/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followups/ai-tracking"] });
      if (data?.updated > 0) {
        toast({ title: `Updated ${data.updated} outcome${data.updated !== 1 ? 's' : ''}` });
      }
    },
    onError: () => {
      toast({ title: "Failed to detect outcomes", variant: "destructive" });
    },
  });

  if (outcomesLoading || perfLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const totalPositive = outcomes ? outcomes.outcomes.returned + outcomes.outcomes.paid + outcomes.outcomes.renewed + outcomes.outcomes.converted : 0;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl" data-testid="outcomes-summary">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/90 via-teal-600/85 to-cyan-700/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />

        <div className="relative p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/10">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Follow-up Outcomes</h3>
                <p className="text-white/70 text-sm">Last 30 days · {outcomes?.totalSent || 0} messages sent</p>
              </div>
            </div>
            <button
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors border border-white/10"
              data-testid="button-detect-outcomes"
            >
              <RefreshCw className={`w-4 h-4 text-white ${detectMutation.isPending ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <div className="p-3 rounded-xl bg-white/15 border border-white/10 text-center">
              <div className="text-2xl font-bold text-white">{outcomes?.totalSent || 0}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Total Sent</div>
            </div>
            <div className="p-3 rounded-xl bg-white/15 border border-white/10 text-center">
              <div className="text-2xl font-bold text-emerald-300">{outcomes?.outcomes.returned || 0}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Returned</div>
            </div>
            <div className="p-3 rounded-xl bg-white/15 border border-white/10 text-center">
              <div className="text-2xl font-bold text-blue-300">{outcomes?.outcomes.paid || 0}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Paid</div>
            </div>
            <div className="p-3 rounded-xl bg-white/15 border border-white/10 text-center">
              <div className="text-2xl font-bold text-violet-300">{outcomes?.outcomes.renewed || 0}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Renewed</div>
            </div>
            <div className="p-3 rounded-xl bg-white/15 border border-white/10 text-center">
              <div className="text-2xl font-bold text-amber-300">{outcomes?.outcomes.converted || 0}</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Converted</div>
            </div>
            <div className="p-3 rounded-xl bg-white/15 border border-white/10 text-center">
              <div className="text-2xl font-bold text-white">{outcomes?.successRate || 0}%</div>
              <div className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Success</div>
            </div>
          </div>

          {totalPositive > 0 && (
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Trophy className="w-4 h-4 text-amber-300" />
              <span>{totalPositive} positive outcome{totalPositive !== 1 ? 's' : ''} from your follow-ups</span>
            </div>
          )}
        </div>
      </div>

      {performance && performance.goalPerformance.length > 0 && (
        <Card className="border-0 shadow-sm" data-testid="performance-by-goal">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">What Worked</h4>
                <p className="text-[11px] text-muted-foreground">Performance by follow-up goal</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {performance.goalPerformance.map(g => (
                <div key={g.goal} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50" data-testid={`perf-goal-${g.goal}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground">{g.label}</span>
                      <span className="text-sm font-bold text-primary">{g.successRate}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all duration-500"
                        style={{ width: `${Math.min(g.successRate, 100)}%` }}
                      />
                    </div>
                    <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span>{g.sent} sent</span>
                      {g.returned > 0 && <span className="text-emerald-600">{g.returned} returned</span>}
                      {g.paid > 0 && <span className="text-blue-600">{g.paid} paid</span>}
                      {g.renewed > 0 && <span className="text-violet-600">{g.renewed} renewed</span>}
                      {g.converted > 0 && <span className="text-amber-600">{g.converted} converted</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {outcomes && outcomes.recentOutcomes.length > 0 && (
        <Card className="border-0 shadow-sm" data-testid="recent-outcomes">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Recent Outcomes</h4>
                <p className="text-[11px] text-muted-foreground">What happened after your messages</p>
              </div>
            </div>
            <div className="space-y-2">
              {outcomes.recentOutcomes.map(o => {
                const config = OUTCOME_CONFIG[o.outcomeType];
                const OutcomeIcon = config?.icon || CheckCircle2;
                return (
                  <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50" data-testid={`outcome-${o.id}`}>
                    <div className={`p-1.5 rounded-lg ${config?.bgColor || 'bg-muted'} shrink-0`}>
                      <OutcomeIcon className={`w-3.5 h-3.5 ${config?.color || 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{o.memberName}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 border-0 ${config?.bgColor} ${config?.color}`}>
                          {config?.label || o.outcomeType}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {o.daysSinceIntervention !== null
                          ? `${o.daysSinceIntervention} day${o.daysSinceIntervention !== 1 ? 's' : ''} after your message`
                          : 'Recently detected'}
                        {o.followUpGoal && ` · Goal: ${o.followUpGoal}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {outcomes && outcomes.pendingActions.length > 0 && (
        <Card className="border-0 shadow-sm" data-testid="pending-actions">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">Needs Your Attention</h4>
                <p className="text-[11px] text-muted-foreground">No response yet — here's what to do next</p>
              </div>
            </div>
            <div className="space-y-2">
              {outcomes.pendingActions.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10" data-testid={`action-${a.id}`}>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{a.memberName}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {a.daysSinceContact}d ago
                      </Badge>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 shrink-0" />
                      {a.suggestion}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!outcomes || outcomes.totalSent === 0) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Activity className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground text-lg">No follow-ups yet</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Start sending follow-ups from the AI Engine tab and outcomes will appear here automatically.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SenderSetupCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  
  const { data, isLoading } = useQuery<{ settings: EmailSettings; gymName: string }>({
    queryKey: ["/api/gym/email/settings"]
  });

  const [sendMode, setSendMode] = useState<"ogym" | "custom">("ogym");
  const [senderName, setSenderName] = useState("");
  const [replyToEmail, setReplyToEmail] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (data: { sendMode: string; replyToEmail: string; senderName: string }) => {
      return apiRequest("POST", "/api/gym/email/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gym/email/settings"] });
      toast({ title: "Settings saved" });
      setExpanded(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    }
  });

  useEffect(() => {
    if (data?.settings) {
      setSendMode(data.settings.sendMode || "ogym");
      setSenderName(data.settings.senderName || "");
      setReplyToEmail(data.settings.replyToEmail || "");
    }
  }, [data]);

  if (isLoading) return null;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
        data-testid="button-expand-settings"
      >
        <Settings className="w-3.5 h-3.5" />
        <span>Sender: {data?.settings?.senderName || data?.gymName} via OGym</span>
        {data?.settings?.replyToEmail && <span className="text-muted-foreground/60">· Reply-to: {data.settings.replyToEmail}</span>}
        <ChevronRight className="w-3 h-3" />
      </button>
    );
  }

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Sender Setup</CardTitle>
              <CardDescription className="text-sm">Configure how emails are sent</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} data-testid="button-collapse-settings">
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup 
          value={sendMode} 
          onValueChange={(v) => setSendMode(v as "ogym" | "custom")}
          className="space-y-3"
        >
          <div 
            className="flex items-center gap-3 p-4 rounded-xl border bg-background/50 hover:bg-accent/30 cursor-pointer transition-all" 
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
              <Label htmlFor="senderName" className="text-sm">Your Name</Label>
              <Input 
                id="senderName"
                type="text"
                placeholder="Name used to sign off emails"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="h-11"
                data-testid="input-sender-name"
              />
              <p className="text-xs text-muted-foreground">AI will use this name to sign off follow-up messages</p>
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
              onClick={() => saveMutation.mutate({ sendMode, replyToEmail, senderName })}
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

type SentEmailItem = {
  id: number;
  recipientEmail: string;
  recipientName: string | null;
  recipientType: string;
  category: string;
  goal: string | null;
  subject: string;
  message: string;
  status: string;
  sentAt: string;
};

function SentHistoryView() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const buildQueryKey = () => {
    const params: string[] = ["/api/followups/sent-history"];
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (categoryFilter) qs.set("category", categoryFilter);
    if (goalFilter) qs.set("goal", goalFilter);
    if (startDate) qs.set("startDate", startDate);
    if (endDate) qs.set("endDate", endDate);
    qs.set("limit", String(pageSize));
    qs.set("offset", String(page * pageSize));
    return [params[0], qs.toString()];
  };

  const { data, isLoading } = useQuery<{ emails: SentEmailItem[]; total: number }>({
    queryKey: buildQueryKey(),
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (search) qs.set("search", search);
      if (categoryFilter) qs.set("category", categoryFilter);
      if (goalFilter) qs.set("goal", goalFilter);
      if (startDate) qs.set("startDate", startDate);
      if (endDate) qs.set("endDate", endDate);
      qs.set("limit", String(pageSize));
      qs.set("offset", String(page * pageSize));
      const res = await fetch(`/api/followups/sent-history?${qs.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const emails = data?.emails || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      INACTIVE: 'Inactive Members', PAYMENTS: 'Payment Reminders', DAY_PASS: 'Walk-in / Day Pass',
      INTERVENTION: 'Direct Outreach', GENERAL: 'General',
    };
    return map[cat] || cat;
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = {
      INACTIVE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      PAYMENTS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      DAY_PASS: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
      INTERVENTION: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return map[cat] || 'bg-muted text-muted-foreground';
  };

  const getGoalLabel = (goal: string) => {
    const map: Record<string, string> = {
      renew: 'Renew', bring_back: 'Bring Back', collect_payment: 'Collect Payment',
      welcome: 'Welcome', general: 'General', convert: 'Convert',
    };
    return map[goal] || goal;
  };

  const grouped = useMemo(() => {
    const groups: Record<string, SentEmailItem[]> = {};
    for (const e of emails) {
      const day = format(new Date(e.sentAt), 'yyyy-MM-dd');
      if (!groups[day]) groups[day] = [];
      groups[day].push(e);
    }
    return groups;
  }, [emails]);

  return (
    <div className="space-y-4" data-testid="sent-history-view">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/10">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Email History</CardTitle>
              <CardDescription className="text-xs">{total} email{total !== 1 ? 's' : ''} sent</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, email, or subject..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9 h-9 text-sm"
                data-testid="input-sent-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v === 'all' ? '' : v); setPage(0); }}>
              <SelectTrigger className="w-[150px] h-9 text-sm" data-testid="select-sent-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="INACTIVE">Inactive Members</SelectItem>
                <SelectItem value="PAYMENTS">Payment Reminders</SelectItem>
                <SelectItem value="DAY_PASS">Walk-in / Day Pass</SelectItem>
                <SelectItem value="INTERVENTION">Direct Outreach</SelectItem>
              </SelectContent>
            </Select>
            <Select value={goalFilter} onValueChange={(v) => { setGoalFilter(v === 'all' ? '' : v); setPage(0); }}>
              <SelectTrigger className="w-[130px] h-9 text-sm" data-testid="select-sent-goal">
                <SelectValue placeholder="All Goals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Goals</SelectItem>
                <SelectItem value="bring_back">Bring Back</SelectItem>
                <SelectItem value="renew">Renew</SelectItem>
                <SelectItem value="collect_payment">Collect Payment</SelectItem>
                <SelectItem value="welcome">Welcome</SelectItem>
                <SelectItem value="convert">Convert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
                className="h-9 text-sm w-[140px]"
                data-testid="input-sent-start-date"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
                className="h-9 text-sm w-[140px]"
                data-testid="input-sent-end-date"
              />
            </div>
            {(search || categoryFilter || goalFilter || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setCategoryFilter(""); setGoalFilter(""); setStartDate(""); setEndDate(""); setPage(0); }}
                className="h-9 text-xs"
                data-testid="button-clear-filters"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : emails.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
              <Mail className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No emails sent yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Emails you send through Follow-ups will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([day, dayEmails]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted-foreground px-2">
                  {format(new Date(day), 'MMM d, yyyy')}
                </span>
                <Badge variant="secondary" className="text-[10px]">{dayEmails.length}</Badge>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {dayEmails.map((email) => (
                  <Card
                    key={email.id}
                    className={`border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${expandedId === email.id ? 'ring-1 ring-primary/30' : ''}`}
                    onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                    data-testid={`sent-email-card-${email.id}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 mt-0.5">
                          <Send className="w-3.5 h-3.5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-semibold truncate" data-testid={`text-recipient-${email.id}`}>
                                {email.recipientName || email.recipientEmail}
                              </span>
                              <Badge className={`text-[10px] px-1.5 ${getCategoryColor(email.category)}`}>
                                {getCategoryLabel(email.category)}
                              </Badge>
                              {email.goal && (
                                <Badge variant="outline" className="text-[10px] px-1.5">
                                  {getGoalLabel(email.goal)}
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(email.sentAt), 'h:mm a')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground truncate">{email.recipientEmail}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <Badge variant="secondary" className={`text-[10px] px-1.5 ${email.recipientType === 'walk_in' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : ''}`}>
                              {email.recipientType === 'walk_in' ? 'Walk-in' : 'Member'}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium mt-1.5 text-foreground/80">{email.subject}</p>
                          {expandedId === email.id && (
                            <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed" data-testid={`text-message-${email.id}`}>
                                {email.message}
                              </p>
                            </div>
                          )}
                        </div>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 mt-1 ${expandedId === email.id ? 'rotate-90' : ''}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ManualTab({ 
  tabType, 
  autoSelectMemberId, 
  initialSubject, 
  initialMessage 
}: { 
  tabType: 'daypass' | 'inactive' | 'payments';
  autoSelectMemberId?: number;
  initialSubject?: string;
  initialMessage?: string;
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(initialSubject || "");
  const [message, setMessage] = useState(initialMessage || "");
  const [inactiveDays, setInactiveDays] = useState("30");
  const [filterType, setFilterType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minVisits, setMinVisits] = useState("1");

  useEffect(() => { if (initialSubject) setSubject(initialSubject); }, [initialSubject]);
  useEffect(() => { if (initialMessage) setMessage(initialMessage); }, [initialMessage]);

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tabType === 'inactive' && inactiveDays) params.set("inactive_days", inactiveDays);
    if (tabType === 'payments' && filterType) params.set("type", filterType);
    if (tabType === 'daypass') {
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (minVisits && minVisits !== "1") params.set("min_visits", minVisits);
    }
    const qs = params.toString();
    return `/api/followups/${tabType}${qs ? `?${qs}` : ""}`;
  };

  const { data: members = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/followups/${tabType}`, search, inactiveDays, filterType, fromDate, toDate, minVisits],
    queryFn: async () => {
      const res = await fetch(buildUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  useEffect(() => {
    if (autoSelectMemberId && members.length > 0) {
      const member = members.find((m: any) => m.id === autoSelectMemberId);
      if (member) setSelectedIds([autoSelectMemberId]);
    }
  }, [autoSelectMemberId, members]);

  const sendMutation = useMutation({
    mutationFn: async (data: { category: string; member_ids: number[]; subject: string; message: string }) => {
      return apiRequest("POST", "/api/followups/send", data);
    },
    onSuccess: (data: any) => {
      toast({ title: `Sent ${data.sent} email(s)` });
      setSelectedIds([]);
      setSubject("");
      setMessage("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const emailableMembers = members.filter((m: any) => m.email);

  const toggleAll = () => {
    if (emailableMembers.every((m: any) => selectedIds.includes(m.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(emailableMembers.map((m: any) => m.id));
    }
  };

  const handleSend = () => {
    if (subject && message && selectedIds.length > 0) {
      sendMutation.mutate({
        category: tabType === 'daypass' ? 'DAY_PASS' : tabType === 'inactive' ? 'INACTIVE' : 'PAYMENTS',
        member_ids: selectedIds,
        subject,
        message
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tabType === 'inactive' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Inactive Since</Label>
                <Select value={inactiveDays} onValueChange={setInactiveDays}>
                  <SelectTrigger className="h-10" data-testid="select-inactive-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7+ days</SelectItem>
                    <SelectItem value="14">14+ days</SelectItem>
                    <SelectItem value="30">30+ days</SelectItem>
                    <SelectItem value="60">60+ days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {tabType === 'payments' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Payment Filter</Label>
                <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
                  <SelectTrigger className="h-10" data-testid="select-payment-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="expires_soon">Expires in 7d</SelectItem>
                    <SelectItem value="balance">Has balance</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {tabType === 'daypass' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">From Date</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10" data-testid="input-from-date" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">To Date</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10" data-testid="input-to-date" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Name or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                  data-testid={`input-search-${tabType}`}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {emailableMembers.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={emailableMembers.every((m: any) => selectedIds.includes(m.id))}
              onCheckedChange={toggleAll}
              data-testid={`checkbox-select-all-${tabType}`}
            />
            <span className="text-sm text-muted-foreground">Select all ({emailableMembers.length})</span>
          </div>
          {selectedIds.length > 0 && <Badge variant="secondary">{selectedIds.length} selected</Badge>}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : members.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground text-sm">No members found</p>
            <p className="text-xs text-muted-foreground mt-1">Adjust your filters</p>
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[400px] overflow-y-auto rounded-lg border bg-muted/20 p-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {members.map((member: any, idx: number) => (
              <div 
                key={`${member.id}-${idx}`}
                className={`p-3 rounded-lg border transition-all ${selectedIds.includes(member.id) ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-card hover:bg-accent/50'}`}
                data-testid={`card-manual-${member.id}`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox 
                    checked={selectedIds.includes(member.id)}
                    onCheckedChange={() => toggleSelect(member.id)}
                    disabled={!member.email}
                    className="mt-0.5"
                    data-testid={`checkbox-manual-${member.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm truncate">{member.name || member.visitorName}</span>
                      {!member.email && <Badge variant="secondary" className="text-xs px-1.5 py-0">No email</Badge>}
                    </div>
                    {member.email && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {member.lastVisit && (
                        <Badge variant="outline" className="gap-1 text-xs px-1.5 py-0">
                          <Clock className="w-2.5 h-2.5" />
                          {format(new Date(member.lastVisit), "MMM d")}
                        </Badge>
                      )}
                      {member.planName && <Badge variant="secondary" className="text-xs px-1.5 py-0">{member.planName}</Badge>}
                      {member.balance > 0 && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">₹{(member.balance / 100).toLocaleString()}</Badge>
                      )}
                      {member.visitsCount && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">{member.visitsCount} visits</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <Label htmlFor={`subject-${tabType}`} className="text-sm">Subject</Label>
            <Input 
              id={`subject-${tabType}`}
              placeholder="Enter email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-11"
              data-testid={`input-subject-${tabType}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`message-${tabType}`} className="text-sm">Message</Label>
            <Textarea 
              id={`message-${tabType}`}
              placeholder="Write your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
              data-testid={`textarea-message-${tabType}`}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} recipient{selectedIds.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <Button 
              onClick={handleSend}
              disabled={selectedIds.length === 0 || !subject || !message || sendMutation.isPending}
              className="w-full sm:w-auto"
              data-testid={`button-send-${tabType}`}
            >
              {sendMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send to Selected
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OwnerFollowUpsPage() {
  const { toast } = useToast();
  const urlParams = new URLSearchParams(window.location.search);
  const walkInId = urlParams.get("walkInId") ? parseInt(urlParams.get("walkInId")!) : undefined;
  const walkInGoal = urlParams.get("goal") || undefined;
  const [activeView, setActiveView] = useState<'ai' | 'manual' | 'results' | 'sent'>(urlParams.get("tab") ? 'manual' : 'ai');
  const [selectedItems, setSelectedItems] = useState<QueueItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState(walkInGoal || "");
  const [walkInVisitor, setWalkInVisitor] = useState<{ id: number; name: string; email: string; phone: string | null } | null>(null);

  const aiReason = urlParams.get("reason");
  const aiMemberId = urlParams.get("memberId") ? parseInt(urlParams.get("memberId")!) : undefined;
  const aiSubject = urlParams.get("subject") || undefined;
  const aiMessage = urlParams.get("message") || undefined;
  const manualTab = (urlParams.get("tab") as 'daypass' | 'inactive' | 'payments') || 'inactive';

  useEffect(() => {
    if (walkInId) {
      fetch(`/api/owner/walk-in-visitors/${walkInId}`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data && data.visitorName) {
            setWalkInVisitor({ id: data.id, name: data.visitorName, email: data.email || '', phone: data.phone });
            const syntheticItem: QueueItem = {
              memberId: data.id,
              name: data.visitorName,
              email: data.email || null,
              category: 'inactive' as const,
              priority: 'high' as const,
              reason: `Walk-in visitor${data.enquiryCategory ? ` — enquired about ${data.enquiryCategory}` : ''}`,
              details: {
                visitType: data.visitType,
                enquiryCategory: data.enquiryCategory,
                enquiryDetails: data.enquiryDetails,
                phone: data.phone,
                isWalkIn: true,
                walkInId: data.id,
              },
              alreadyContacted: false,
            };
            setSelectedItems([syntheticItem]);
            if (walkInGoal) setSelectedGoal(walkInGoal);
          }
        })
        .catch(() => {});
    }
  }, [walkInId]);

  const { data: aiQueue, isLoading: queueLoading } = useQuery<AiQueueData>({
    queryKey: ["/api/followups/ai-queue"],
    enabled: activeView === 'ai',
  });

  const filteredQueue = useMemo(() => {
    if (!aiQueue?.queue) return [];
    let items = aiQueue.queue;
    if (categoryFilter) {
      items = items.filter(i => i.category === categoryFilter);
    }
    return items;
  }, [aiQueue, categoryFilter]);

  useEffect(() => {
    if (selectedItems.length === 1 && !selectedGoal) {
      setSelectedGoal(getDefaultGoal(selectedItems[0].category));
    }
  }, [selectedItems]);

  const toggleQueueItem = (item: QueueItem) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.memberId === item.memberId);
      if (exists) return prev.filter(i => i.memberId !== item.memberId);
      return [...prev, item];
    });
  };

  const sendMutation = useMutation({
    mutationFn: async (data: { category: string; member_ids: number[]; subject: string; message: string; goal?: string }) => {
      const res = await apiRequest("POST", "/api/followups/send", data);
      return await res.json();
    },
    onSuccess: async (data: any) => {
      for (const item of selectedItems) {
        if (item.details?.isWalkIn) {
          try {
            await apiRequest("PATCH", `/api/owner/walk-in-visitors/${item.details.walkInId}`, {
              followUpStatus: 'contacted',
            });
          } catch {}
        } else {
          try {
            await apiRequest("POST", "/api/owner/interventions", {
              memberId: item.memberId,
              actionType: 'email_sent',
              triggerReason: item.category,
              messageSent: 'AI follow-up',
              followUpGoal: selectedGoal,
              messageSubject: data.subject || 'AI follow-up',
            });
          } catch {}
        }
      }
      toast({ title: `Sent ${data.sent || selectedItems.length} email(s) successfully` });
      setSelectedItems([]);
      setSelectedGoal("");
      setWalkInVisitor(null);
      queryClient.invalidateQueries({ queryKey: ["/api/followups/ai-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followups/ai-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followups/outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followups/performance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followups/sent-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
  });

  const handleAiSend = (subject: string, message: string, memberIds: number[]) => {
    const isWalkIn = selectedItems[0]?.details?.isWalkIn;
    if (isWalkIn) {
      sendMutation.mutate({
        category: 'DAY_PASS',
        member_ids: memberIds,
        subject,
        message,
        goal: selectedGoal || undefined,
      });
      return;
    }
    const catMap: Record<string, string> = {
      churn_risk: 'INACTIVE',
      inactive: 'INACTIVE',
      expiring: 'PAYMENTS',
      payment_due: 'PAYMENTS',
      new_member: 'INACTIVE',
    };
    const category = catMap[selectedItems[0]?.category] || 'INACTIVE';
    sendMutation.mutate({
      category,
      member_ids: memberIds,
      subject,
      message,
      goal: selectedGoal || undefined,
    });
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground" data-testid="text-page-title">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">
            {activeView === 'ai' ? 'Dika AI prepared everything — just approve and send' : activeView === 'results' ? 'Track what happened after your follow-ups' : activeView === 'sent' ? 'See every email you\'ve sent and to whom' : 'Send targeted emails to your members'}
          </p>
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
              <span className="hidden sm:inline">Dika AI</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit border border-border/50">
        <button
          onClick={() => setActiveView('ai')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeView === 'ai' 
              ? 'bg-gradient-to-r from-primary to-violet-600 text-white shadow-md shadow-primary/20' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          data-testid="toggle-ai-view"
        >
          <Zap className="w-4 h-4" />
          AI Engine
        </button>
        <button
          onClick={() => setActiveView('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeView === 'manual' 
              ? 'bg-background shadow-sm text-foreground' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          data-testid="toggle-manual-view"
        >
          <Mail className="w-4 h-4" />
          Manual
        </button>
        <button
          onClick={() => setActiveView('results')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeView === 'results' 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          data-testid="toggle-results-view"
        >
          <Trophy className="w-4 h-4" />
          Results
        </button>
        <button
          onClick={() => setActiveView('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeView === 'sent' 
              ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-md shadow-blue-500/20' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          data-testid="toggle-sent-view"
        >
          <Clock className="w-4 h-4" />
          Sent
        </button>
      </div>

      {activeView === 'ai' ? (
        <div className="space-y-5">
          {walkInVisitor && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/10 via-primary/10 to-transparent border border-violet-500/20" data-testid="walk-in-context-banner">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/10">
                  <Zap className="w-4 h-4 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold">Walk-in Follow-up: {walkInVisitor.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {walkInVisitor.email && <span>{walkInVisitor.email}</span>}
                    {walkInVisitor.phone && <span className="ml-2">{walkInVisitor.phone}</span>}
                    {walkInGoal && <span className="ml-2">Goal: {walkInGoal.replace('_', ' ')}</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
          <AiTrackingCard />

          {queueLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
              </div>
            </div>
          ) : aiQueue && aiQueue.summary.total > 0 ? (
            <>
              <AiQueueSummary 
                summary={aiQueue.summary} 
                onFilter={setCategoryFilter}
                activeFilter={categoryFilter}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">
                      {filteredQueue.length} member{filteredQueue.length !== 1 ? 's' : ''} to follow up
                    </span>
                  </div>
                  {selectedItems.length > 0 && (
                    <Badge className="bg-primary/10 text-primary border-0 font-semibold">
                      {selectedItems.length} selected
                    </Badge>
                  )}
                </div>
                <div className="max-h-[450px] overflow-y-auto rounded-xl p-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredQueue.map(item => (
                      <QueueMemberCard
                        key={`${item.memberId}-${item.category}`}
                        item={item}
                        isSelected={!!selectedItems.find(i => i.memberId === item.memberId)}
                        onSelect={() => toggleQueueItem(item)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {selectedItems.length > 0 && (
                <GoalSelector
                  selectedGoal={selectedGoal}
                  onSelect={setSelectedGoal}
                  category={selectedItems[0]?.category || ''}
                />
              )}

              {selectedItems.length > 0 && selectedGoal && (
                <AiMessageComposer
                  selectedItems={selectedItems}
                  goal={selectedGoal}
                  onSend={handleAiSend}
                  isPending={sendMutation.isPending}
                />
              )}
            </>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                </div>
                <p className="font-semibold text-foreground text-lg">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  No members need follow-up right now. Dika AI will alert you when action is needed.
                </p>
              </CardContent>
            </Card>
          )}

          <SenderSetupCard />
        </div>
      ) : activeView === 'results' ? (
        <ResultsView />
      ) : activeView === 'manual' ? (
        <div className="space-y-5">
          {aiReason && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/5 via-violet-500/5 to-transparent border border-primary/20" data-testid="ai-context-bar">
              <div className="p-1.5 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">Dika AI Suggested This</p>
                <p className="text-sm text-foreground mt-0.5">{aiReason}</p>
              </div>
            </div>
          )}

          <Tabs defaultValue={manualTab} className="space-y-4">
            <ScrollArea className="w-full">
              <TabsList className="inline-flex w-auto min-w-full sm:grid sm:grid-cols-3 sm:w-full h-auto p-1 gap-1">
                <TabsTrigger value="daypass" className="flex-1 py-2.5 px-4 data-[state=active]:shadow-sm whitespace-nowrap" data-testid="tab-daypass">
                  <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                  Day Pass
                </TabsTrigger>
                <TabsTrigger value="inactive" className="flex-1 py-2.5 px-4 data-[state=active]:shadow-sm whitespace-nowrap" data-testid="tab-inactive">
                  <UserX className="w-4 h-4 mr-2 flex-shrink-0" />
                  Inactive
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex-1 py-2.5 px-4 data-[state=active]:shadow-sm whitespace-nowrap" data-testid="tab-payments">
                  <CreditCard className="w-4 h-4 mr-2 flex-shrink-0" />
                  Payments
                </TabsTrigger>
              </TabsList>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>

            <TabsContent value="daypass" className="mt-4">
              <ManualTab tabType="daypass" />
            </TabsContent>
            <TabsContent value="inactive" className="mt-4">
              <ManualTab 
                tabType="inactive"
                autoSelectMemberId={aiMemberId}
                initialSubject={aiSubject}
                initialMessage={aiMessage}
              />
            </TabsContent>
            <TabsContent value="payments" className="mt-4">
              <ManualTab 
                tabType="payments"
                autoSelectMemberId={aiMemberId}
                initialSubject={aiSubject}
                initialMessage={aiMessage}
              />
            </TabsContent>
          </Tabs>

          <SenderSetupCard />
        </div>
      ) : activeView === 'sent' ? (
        <SentHistoryView />
      ) : null}
    </div>
  );
}