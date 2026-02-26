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
  MessageSquare, Star, UserPlus, AlertTriangle
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
  const [activeView, setActiveView] = useState<'ai' | 'manual'>(urlParams.get("tab") ? 'manual' : 'ai');
  const [selectedItems, setSelectedItems] = useState<QueueItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState("");

  const aiReason = urlParams.get("reason");
  const aiMemberId = urlParams.get("memberId") ? parseInt(urlParams.get("memberId")!) : undefined;
  const aiSubject = urlParams.get("subject") || undefined;
  const aiMessage = urlParams.get("message") || undefined;
  const manualTab = (urlParams.get("tab") as 'daypass' | 'inactive' | 'payments') || 'inactive';

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
    mutationFn: async (data: { category: string; member_ids: number[]; subject: string; message: string }) => {
      const res = await apiRequest("POST", "/api/followups/send", data);
      return await res.json();
    },
    onSuccess: async (data: any) => {
      for (const item of selectedItems) {
        try {
          await apiRequest("POST", "/api/owner/interventions", {
            memberId: item.memberId,
            actionType: 'email_sent',
            triggerReason: item.category,
            messageSent: 'AI follow-up',
          });
        } catch {}
      }
      toast({ title: `Sent ${data.sent || selectedItems.length} email(s) successfully` });
      setSelectedItems([]);
      setSelectedGoal("");
      queryClient.invalidateQueries({ queryKey: ["/api/followups/ai-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followups/ai-tracking"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    }
  });

  const handleAiSend = (subject: string, message: string, memberIds: number[]) => {
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
      message
    });
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display text-foreground" data-testid="text-page-title">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">
            {activeView === 'ai' ? 'Dika AI prepared everything — just approve and send' : 'Send targeted emails to your members'}
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
      </div>

      {activeView === 'ai' ? (
        <div className="space-y-5">
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
      ) : (
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
      )}
    </div>
  );
}