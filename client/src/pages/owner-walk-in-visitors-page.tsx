import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus, Plus, Users, Calendar, IndianRupee, TrendingUp, Phone, Mail, FileText,
  Loader2, Image, CheckCircle, Clock, XCircle, MessageSquare, UserCheck, Ban,
  PhoneCall, MapPin, ArrowRight, Zap, Target, Flame, Heart, RotateCcw, CreditCard,
  Repeat, ChevronRight, Star, Sparkles, Filter
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type FollowUpStatus = "pending" | "contacted" | "follow_up_scheduled" | "converted" | "not_interested";

type WalkInVisitor = {
  id: number;
  gymId: number;
  visitorName: string;
  phone: string | null;
  city: string | null;
  email: string | null;
  visitDate: string;
  visitType: "day_pass" | "trial" | "enquiry";
  daysCount: number | null;
  amountPaid: number | null;
  paymentMethod: string | null;
  paymentScreenshot: string | null;
  checkinCode: string | null;
  codeExpiresAt: string | null;
  paymentVerified: boolean | null;
  notes: string | null;
  source: "owner" | "trainer" | "kiosk" | null;
  convertedToMember: boolean | null;
  followUpStatus: FollowUpStatus | null;
  followUpNotes: string | null;
  followUpDate: string | null;
  enquiryCategory: string | null;
  enquiryDetails: string | null;
  createdAt: string;
};

type ScoredVisitor = WalkInVisitor & {
  leadScore: number;
  reasons: string[];
  repeatVisitCount: number;
};

type WalkInStats = {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  todayRevenue: number;
  conversionRate: number;
};

type ConversionFunnel = {
  enquiry: number;
  trial: number;
  dayPass: number;
  converted: number;
  total: number;
  conversionRate: number;
};

type AiSuggestion = {
  visitorId: number;
  visitorName: string;
  email: string | null;
  phone: string | null;
  visitType: string;
  visitDate: string;
  leadScore: number;
  repeatVisitCount: number;
  daysSinceVisit: number;
  enquiryCategory: string | null;
  reason: string;
  suggestedGoal: string;
};

type AiSuggestionLanes = {
  hotLeads: AiSuggestion[];
  nurture: AiSuggestion[];
  winBack: AiSuggestion[];
  paymentPending: AiSuggestion[];
};

const walkInSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  visitDate: z.string().min(1, "Visit date is required"),
  visitType: z.enum(["day_pass", "trial", "enquiry"]),
  daysCount: z.coerce.number().min(1).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  enquiryCategory: z.string().optional(),
  enquiryDetails: z.string().optional(),
});

type WalkInForm = z.infer<typeof walkInSchema>;

function LeadScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${color}`} data-testid="badge-lead-score">
      <Star className="w-2.5 h-2.5" />
      {score}
    </span>
  );
}

function RepeatBadge({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid="badge-repeat-visitor">
      <Repeat className="w-2.5 h-2.5 mr-0.5" />
      {count === 2 ? '2nd visit' : count === 3 ? '3rd visit' : `${count}th visit`}
    </Badge>
  );
}

function ConversionFunnelCard({ funnel }: { funnel: ConversionFunnel }) {
  const stages = [
    { label: 'Enquiry', count: funnel.enquiry, color: 'from-amber-500 to-amber-600' },
    { label: 'Trial', count: funnel.trial, color: 'from-blue-500 to-blue-600' },
    { label: 'Day Pass', count: funnel.dayPass, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Converted', count: funnel.converted, color: 'from-violet-500 to-violet-600' },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl" data-testid="conversion-funnel">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
      <div className="relative p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-white/10 border border-white/5">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Conversion Pipeline</h3>
            <p className="text-[11px] text-white/50">{funnel.total} total visitors · {funnel.conversionRate}% conversion</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {stages.map((stage, i) => (
            <div key={stage.label} className="relative">
              <div className={`p-3 rounded-xl bg-gradient-to-b ${stage.color} text-center`}>
                <div className="text-xl font-bold text-white">{stage.count}</div>
                <div className="text-[10px] text-white/80 uppercase tracking-wider mt-0.5">{stage.label}</div>
              </div>
              {i < 3 && (
                <ChevronRight className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 z-10" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AiSuggestionCard({ lane, title, icon, color, suggestions, onTakeAction }: {
  lane: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  suggestions: AiSuggestion[];
  onTakeAction: (s: AiSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className={`rounded-xl border ${color} overflow-hidden`} data-testid={`ai-lane-${lane}`}>
      <div className="px-3.5 py-2.5 flex items-center gap-2 border-b border-inherit bg-muted/30">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        <Badge variant="secondary" className="ml-auto text-[10px]">{suggestions.length}</Badge>
      </div>
      <div className="divide-y divide-border/50">
        {suggestions.map(s => (
          <div key={s.visitorId} className="px-3.5 py-3 flex items-center gap-3" data-testid={`suggestion-${s.visitorId}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium truncate">{s.visitorName}</span>
                <LeadScoreBadge score={s.leadScore} />
              </div>
              <p className="text-xs text-muted-foreground truncate">{s.reason}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 text-xs h-7 px-2.5"
              onClick={() => onTakeAction(s)}
              data-testid={`button-take-action-${s.visitorId}`}
            >
              Take Action
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OwnerWalkInVisitorsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [dateEndFilter, setDateEndFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [followUpVisitor, setFollowUpVisitor] = useState<WalkInVisitor | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [editingEnquiry, setEditingEnquiry] = useState<number | null>(null);
  const [editEnquiryCategory, setEditEnquiryCategory] = useState("");
  const [editEnquiryDetails, setEditEnquiryDetails] = useState("");

  const today = new Date().toISOString().split('T')[0];

  const form = useForm<WalkInForm>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      name: "", phone: "", email: "", city: "", visitDate: today,
      visitType: "day_pass", daysCount: 1, amountPaid: 0, notes: "",
      enquiryCategory: "", enquiryDetails: "",
    }
  });
  const watchVisitType = form.watch("visitType");

  const { data: leadScores = [], isLoading } = useQuery<ScoredVisitor[]>({
    queryKey: ["/api/owner/walk-in-visitors/lead-scores"],
  });

  const { data: stats } = useQuery<WalkInStats>({
    queryKey: ["/api/owner/walk-in-visitors/stats"]
  });

  const { data: funnel } = useQuery<ConversionFunnel>({
    queryKey: ["/api/owner/walk-in-visitors/conversion-funnel"]
  });

  const { data: aiSuggestions, isLoading: suggestionsLoading } = useQuery<AiSuggestionLanes>({
    queryKey: ["/api/owner/walk-in-visitors/ai-suggestions"]
  });

  const filteredVisitors = useMemo(() => {
    let list = leadScores;
    if (typeFilter && typeFilter !== 'all') {
      list = list.filter(v => v.visitType === typeFilter);
    }
    if (dateFilter) {
      list = list.filter(v => v.visitDate >= dateFilter);
    }
    if (dateEndFilter) {
      list = list.filter(v => v.visitDate <= dateEndFilter);
    }
    return list;
  }, [leadScores, typeFilter, dateFilter, dateEndFilter]);

  const groupedByDate = useMemo(() => {
    if (typeFilter === 'all' && !dateFilter) return null;
    const groups: Record<string, ScoredVisitor[]> = {};
    for (const v of filteredVisitors) {
      const d = v.visitDate;
      if (!groups[d]) groups[d] = [];
      groups[d].push(v);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredVisitors, typeFilter, dateFilter]);

  const createMutation = useMutation({
    mutationFn: async (data: WalkInForm) => {
      return apiRequest("POST", "/api/owner/walk-in-visitors", {
        ...data,
        amountPaid: (data.amountPaid || 0) * 100,
        email: data.email || undefined,
        city: data.city || undefined,
        enquiryCategory: data.visitType === 'enquiry' ? (data.enquiryCategory || undefined) : undefined,
        enquiryDetails: data.visitType === 'enquiry' ? (data.enquiryDetails || undefined) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/lead-scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/ai-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/conversion-funnel"] });
      form.reset({ name: "", phone: "", email: "", city: "", visitDate: today, visitType: "day_pass", daysCount: 1, amountPaid: 0, notes: "", enquiryCategory: "", enquiryDetails: "" });
      setIsOpen(false);
      toast({ title: "Visitor recorded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add visitor", description: error.message, variant: "destructive" });
    }
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: async (visitorId: number) => {
      return apiRequest("POST", `/api/owner/walk-in-visitors/${visitorId}/verify-payment`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/lead-scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/ai-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/conversion-funnel"] });
      toast({ title: "Payment verified successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to verify payment", description: error.message, variant: "destructive" });
    }
  });

  const followUpMutation = useMutation({
    mutationFn: async ({ visitorId, status, notes }: { visitorId: number; status: FollowUpStatus; notes?: string }) => {
      return apiRequest("PATCH", `/api/owner/walk-in-visitors/${visitorId}/follow-up`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/lead-scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/ai-suggestions"] });
      setFollowUpVisitor(null);
      setFollowUpNotes("");
      toast({ title: "Follow-up updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update follow-up", description: error.message, variant: "destructive" });
    }
  });

  const updateEnquiryMutation = useMutation({
    mutationFn: async ({ id, enquiryCategory, enquiryDetails }: { id: number; enquiryCategory: string; enquiryDetails: string }) => {
      return apiRequest("PATCH", `/api/owner/walk-in-visitors/${id}`, { enquiryCategory, enquiryDetails });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/lead-scores"] });
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors/ai-suggestions"] });
      setEditingEnquiry(null);
      toast({ title: "Enquiry details updated" });
    },
  });

  const onSubmit = (data: WalkInForm) => createMutation.mutate(data);

  const getVisitTypeBadge = (type: string) => {
    switch (type) {
      case "day_pass": return <Badge className="bg-green-500 text-[10px] px-1.5">Day Pass</Badge>;
      case "trial": return <Badge className="bg-blue-500 text-[10px] px-1.5">Trial</Badge>;
      case "enquiry": return <Badge className="bg-amber-500 text-[10px] px-1.5">Enquiry</Badge>;
      default: return <Badge className="text-[10px] px-1.5">{type}</Badge>;
    }
  };

  const getFollowUpStatusBadge = (status: FollowUpStatus | null) => {
    switch (status) {
      case "contacted": return <Badge variant="outline" className="text-blue-600 border-blue-600 text-[10px] px-1.5"><PhoneCall className="w-2.5 h-2.5 mr-0.5" />Contacted</Badge>;
      case "follow_up_scheduled": return <Badge variant="outline" className="text-purple-600 border-purple-600 text-[10px] px-1.5"><Clock className="w-2.5 h-2.5 mr-0.5" />Scheduled</Badge>;
      case "converted": return <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1.5"><UserCheck className="w-2.5 h-2.5 mr-0.5" />Converted</Badge>;
      case "not_interested": return <Badge variant="outline" className="text-red-600 border-red-600 text-[10px] px-1.5"><Ban className="w-2.5 h-2.5 mr-0.5" />Not Interested</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] px-1.5"><Clock className="w-2.5 h-2.5 mr-0.5" />Pending</Badge>;
    }
  };

  const formatAmount = (paise: number | null) => {
    if (!paise) return "-";
    return `₹${(paise / 100).toLocaleString()}`;
  };

  const handleTakeAction = (s: AiSuggestion) => {
    navigate(`/owner/follow-ups?walkInId=${s.visitorId}&goal=${s.suggestedGoal}`);
  };

  const startEditEnquiry = (v: WalkInVisitor) => {
    setEditingEnquiry(v.id);
    setEditEnquiryCategory(v.enquiryCategory || "");
    setEditEnquiryDetails(v.enquiryDetails || "");
  };

  const saveEnquiry = (id: number) => {
    updateEnquiryMutation.mutate({ id, enquiryCategory: editEnquiryCategory, enquiryDetails: editEnquiryDetails });
  };

  const renderVisitorCard = (visitor: ScoredVisitor) => (
    <div key={visitor.id} className="p-3 md:p-4 border rounded-xl bg-card hover:border-primary/20 transition-colors" data-testid={`visitor-card-${visitor.id}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <h4 className="font-medium text-sm md:text-base">{visitor.visitorName}</h4>
          <LeadScoreBadge score={visitor.leadScore} />
          {getVisitTypeBadge(visitor.visitType)}
          <RepeatBadge count={visitor.repeatVisitCount} />
          {getFollowUpStatusBadge(visitor.followUpStatus)}
          {visitor.source === "kiosk" && (
            <Badge variant="secondary" className="text-[10px] px-1.5">Kiosk</Badge>
          )}
          {visitor.visitType === "day_pass" && visitor.paymentVerified && (
            <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] px-1.5">
              <CheckCircle className="w-2.5 h-2.5 mr-0.5" />Verified
            </Badge>
          )}
          {visitor.visitType === "day_pass" && visitor.paymentScreenshot && !visitor.paymentVerified && (
            <Badge variant="outline" className="text-amber-600 border-amber-600 text-[10px] px-1.5">
              <Clock className="w-2.5 h-2.5 mr-0.5" />Payment Pending
            </Badge>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-semibold text-sm">{formatAmount(visitor.amountPaid)}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {visitor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{visitor.phone}</span>}
        {visitor.email && <span className="flex items-center gap-1 truncate max-w-[150px] md:max-w-none"><Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{visitor.email}</span></span>}
        {visitor.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{visitor.city}</span>}
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(visitor.visitDate), "MMM d, yyyy")}</span>
        {visitor.daysCount && visitor.daysCount > 1 && <span>{visitor.daysCount} days</span>}
        {visitor.checkinCode && <span className="font-mono font-medium text-primary">Code: {visitor.checkinCode}</span>}
      </div>

      {visitor.reasons.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {visitor.reasons.slice(0, 3).map((r, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/5 text-primary/70 border border-primary/10">{r}</span>
          ))}
        </div>
      )}

      {visitor.notes && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{visitor.notes}</span>
        </div>
      )}

      {visitor.visitType === 'enquiry' && (
        <div className="mt-2">
          {editingEnquiry === visitor.id ? (
            <div className="space-y-2 p-2 rounded-lg bg-muted/30 border border-border/50">
              <select
                value={editEnquiryCategory}
                onChange={(e) => setEditEnquiryCategory(e.target.value)}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                data-testid={`select-edit-enquiry-category-${visitor.id}`}
              >
                <option value="">Select category</option>
                <option value="Pricing">Pricing</option>
                <option value="Personal Training">Personal Training</option>
                <option value="Weight Loss">Weight Loss</option>
                <option value="Strength">Strength</option>
                <option value="Other">Other</option>
              </select>
              <Textarea
                value={editEnquiryDetails}
                onChange={(e) => setEditEnquiryDetails(e.target.value)}
                placeholder="Enquiry details..."
                className="min-h-[50px] text-xs"
                data-testid={`input-edit-enquiry-details-${visitor.id}`}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => saveEnquiry(visitor.id)} disabled={updateEnquiryMutation.isPending} data-testid={`button-save-enquiry-${visitor.id}`}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingEnquiry(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs">
              {visitor.enquiryCategory && (
                <Badge variant="outline" className="text-[10px]">{visitor.enquiryCategory}</Badge>
              )}
              {visitor.enquiryDetails && (
                <span className="text-muted-foreground truncate">{visitor.enquiryDetails}</span>
              )}
              <button
                onClick={() => startEditEnquiry(visitor)}
                className="text-primary/60 hover:text-primary text-[10px] underline ml-auto shrink-0"
                data-testid={`button-edit-enquiry-${visitor.id}`}
              >
                {visitor.enquiryCategory || visitor.enquiryDetails ? 'Edit' : 'Add details'}
              </button>
            </div>
          )}
        </div>
      )}

      {visitor.followUpNotes && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <MessageSquare className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{visitor.followUpNotes}</span>
        </div>
      )}

      <div className="mt-2.5 pt-2.5 border-t flex flex-wrap items-center gap-2">
        {(visitor.visitType === "enquiry" || visitor.visitType === "trial") && visitor.followUpStatus !== "converted" && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setFollowUpVisitor(visitor); setFollowUpNotes(visitor.followUpNotes || ""); }} data-testid={`button-follow-up-${visitor.id}`}>
            <MessageSquare className="w-3 h-3 mr-1" />Follow-up
          </Button>
        )}
        {visitor.visitType === "day_pass" && visitor.paymentScreenshot && (
          <>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setScreenshotPreview(visitor.paymentScreenshot)} data-testid={`button-view-screenshot-${visitor.id}`}>
              <Image className="w-3 h-3 mr-1" />View Payment
            </Button>
            {!visitor.paymentVerified && (
              <Button size="sm" className="h-7 text-xs" onClick={() => verifyPaymentMutation.mutate(visitor.id)} disabled={verifyPaymentMutation.isPending} data-testid={`button-verify-payment-${visitor.id}`}>
                <CheckCircle className="w-3 h-3 mr-1" />Verify
              </Button>
            )}
          </>
        )}
        {visitor.email && !visitor.convertedToMember && (
          <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => handleTakeAction({ visitorId: visitor.id, visitorName: visitor.visitorName, email: visitor.email, phone: visitor.phone, visitType: visitor.visitType, visitDate: visitor.visitDate, leadScore: visitor.leadScore, repeatVisitCount: visitor.repeatVisitCount, daysSinceVisit: 0, enquiryCategory: visitor.enquiryCategory, reason: '', suggestedGoal: visitor.visitType === 'day_pass' ? 'bring_back' : 'convert' })} data-testid={`button-quick-action-${visitor.id}`}>
            <Zap className="w-3 h-3 mr-1" />AI Follow-up
          </Button>
        )}
      </div>
    </div>
  );

  const totalSuggestions = aiSuggestions
    ? aiSuggestions.hotLeads.length + aiSuggestions.nurture.length + aiSuggestions.winBack.length + aiSuggestions.paymentPending.length
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground" data-testid="page-title">Walk-in Visitors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">AI-powered conversion pipeline</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-visitor">
              <Plus className="w-4 h-4 mr-1" />Add Visitor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Walk-in Visitor</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="Visitor name" {...field} data-testid="input-visitor-name" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone *</FormLabel><FormControl><Input placeholder="Phone" {...field} data-testid="input-visitor-phone" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="Email" type="email" {...field} data-testid="input-visitor-email" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="City" {...field} data-testid="input-visitor-city" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="visitDate" render={({ field }) => (
                    <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} data-testid="input-visit-date" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="visitType" render={({ field }) => (
                    <FormItem><FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger data-testid="select-visit-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="day_pass">Day Pass</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="enquiry">Enquiry</SelectItem>
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="daysCount" render={({ field }) => (
                    <FormItem><FormLabel>Days</FormLabel><FormControl><Input type="number" min="1" {...field} data-testid="input-days-count" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="amountPaid" render={({ field }) => (
                    <FormItem><FormLabel>Amount (₹)</FormLabel><FormControl><Input type="number" min="0" placeholder="0" {...field} data-testid="input-amount-paid" /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                {watchVisitType === 'enquiry' && (
                  <>
                    <FormField control={form.control} name="enquiryCategory" render={({ field }) => (
                      <FormItem><FormLabel>Enquiry Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl><SelectTrigger data-testid="select-enquiry-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Pricing">Pricing</SelectItem>
                            <SelectItem value="Personal Training">Personal Training</SelectItem>
                            <SelectItem value="Weight Loss">Weight Loss</SelectItem>
                            <SelectItem value="Strength">Strength</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="enquiryDetails" render={({ field }) => (
                      <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea placeholder="What are they enquiring about?" className="min-h-[60px]" {...field} data-testid="input-enquiry-details" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </>
                )}
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Additional notes..." {...field} data-testid="input-visitor-notes" /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-visitor">
                  {createMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : <><UserPlus className="w-4 h-4 mr-2" />Add Visitor</>}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {funnel && <ConversionFunnelCard funnel={funnel} />}

      {stats && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</span>
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">{stats.todayCount}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">This Week</span>
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">{stats.weekCount}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</span>
                <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">{formatAmount(stats.todayRevenue)}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Conversion</span>
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold">{stats.conversionRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="p-3 pb-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Visitors</CardTitle>
              <span className="text-xs text-muted-foreground">{filteredVisitors.length} records</span>
            </div>
            <div className="flex gap-1.5" data-testid="type-filter-tabs">
              {[
                { value: 'all', label: 'All' },
                { value: 'day_pass', label: 'Day Pass' },
                { value: 'enquiry', label: 'Enquiry' },
                { value: 'trial', label: 'Trial' },
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setTypeFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === tab.value ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                  data-testid={`filter-tab-${tab.value}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">From</span>
                <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-[130px] h-8 text-xs" data-testid="filter-date-start" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">To</span>
                <Input type="date" value={dateEndFilter} onChange={(e) => setDateEndFilter(e.target.value)} className="w-[130px] h-8 text-xs" data-testid="filter-date-end" />
              </div>
              {(dateFilter || dateEndFilter) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setDateFilter(""); setDateEndFilter(""); }} data-testid="button-clear-dates">Clear</Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : filteredVisitors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No visitors found</p>
              <p className="text-xs">Try adjusting your filters or add a visitor</p>
            </div>
          ) : groupedByDate ? (
            <div className="space-y-4">
              {groupedByDate.map(([date, visitors]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <h4 className="text-xs font-semibold text-foreground">{format(new Date(date), "EEEE, MMM d, yyyy")}</h4>
                    <Badge variant="secondary" className="text-[10px] px-1.5">{visitors.length}</Badge>
                  </div>
                  <div className="space-y-2 ml-5">
                    {visitors.map(renderVisitorCard)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVisitors.map(renderVisitorCard)}
            </div>
          )}
        </CardContent>
      </Card>

      {suggestionsLoading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <div>
              <Skeleton className="h-4 w-40 mb-1" />
              <Skeleton className="h-3 w-52" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : totalSuggestions > 0 ? (
        <div data-testid="ai-suggestions-section">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-primary/10">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Dika AI Suggestions</h3>
              <p className="text-[11px] text-muted-foreground">Who to approach next — {totalSuggestions} suggestions</p>
            </div>
          </div>
          <div className="space-y-3">
            <AiSuggestionCard
              lane="hot-leads"
              title="Hot Leads"
              icon={<Flame className="w-3.5 h-3.5 text-orange-500" />}
              color="border-orange-200 dark:border-orange-900/50"
              suggestions={aiSuggestions?.hotLeads || []}
              onTakeAction={handleTakeAction}
            />
            <AiSuggestionCard
              lane="nurture"
              title="Nurture"
              icon={<Heart className="w-3.5 h-3.5 text-pink-500" />}
              color="border-pink-200 dark:border-pink-900/50"
              suggestions={aiSuggestions?.nurture || []}
              onTakeAction={handleTakeAction}
            />
            <AiSuggestionCard
              lane="win-back"
              title="Win Back"
              icon={<RotateCcw className="w-3.5 h-3.5 text-blue-500" />}
              color="border-blue-200 dark:border-blue-900/50"
              suggestions={aiSuggestions?.winBack || []}
              onTakeAction={handleTakeAction}
            />
            <AiSuggestionCard
              lane="payment-pending"
              title="Payment Pending"
              icon={<CreditCard className="w-3.5 h-3.5 text-amber-500" />}
              color="border-amber-200 dark:border-amber-900/50"
              suggestions={aiSuggestions?.paymentPending || []}
              onTakeAction={handleTakeAction}
            />
          </div>
        </div>
      ) : (
        <div className="text-center py-8 px-4" data-testid="ai-suggestions-empty">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No AI suggestions right now</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Dika AI will surface leads as visitors check in</p>
        </div>
      )}

      <Dialog open={!!screenshotPreview} onOpenChange={() => setScreenshotPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Payment Screenshot</DialogTitle></DialogHeader>
          {screenshotPreview && <img src={screenshotPreview} alt="Payment screenshot" className="w-full rounded-lg border mt-2" />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!followUpVisitor} onOpenChange={(open) => !open && setFollowUpVisitor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Follow-up: {followUpVisitor?.visitorName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {followUpVisitor?.visitType === "enquiry" ? "Enquiry" : "Trial"} visit on {followUpVisitor?.visitDate && format(new Date(followUpVisitor.visitDate), "MMM d, yyyy")}
              </p>
              {followUpVisitor?.phone && <p className="text-sm flex items-center gap-2"><Phone className="w-4 h-4" />{followUpVisitor.phone}</p>}
              {followUpVisitor?.email && <p className="text-sm flex items-center gap-2"><Mail className="w-4 h-4" />{followUpVisitor.email}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <Textarea placeholder="Add notes..." value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} rows={3} data-testid="input-follow-up-notes" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium block">Update Status</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { status: "contacted" as FollowUpStatus, icon: <PhoneCall className="w-4 h-4 mr-2 text-blue-600" />, label: "Contacted" },
                  { status: "follow_up_scheduled" as FollowUpStatus, icon: <Clock className="w-4 h-4 mr-2 text-purple-600" />, label: "Scheduled" },
                  { status: "converted" as FollowUpStatus, icon: <UserCheck className="w-4 h-4 mr-2 text-green-600" />, label: "Converted" },
                  { status: "not_interested" as FollowUpStatus, icon: <Ban className="w-4 h-4 mr-2 text-red-600" />, label: "Not Interested" },
                ]).map(item => (
                  <Button key={item.status} variant="outline" onClick={() => { if (followUpVisitor) followUpMutation.mutate({ visitorId: followUpVisitor.id, status: item.status, notes: followUpNotes || undefined }); }} disabled={followUpMutation.isPending} className="justify-start" data-testid={`button-status-${item.status}`}>
                    {item.icon}{item.label}
                  </Button>
                ))}
              </div>
            </div>
            {followUpMutation.isPending && <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
