import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Phone, Mail, Calendar as CalendarIcon, Loader2, CheckCircle, Clock, 
  MessageSquare, UserCheck, Ban, PhoneCall, MapPin, 
  Users, TrendingUp, AlertCircle, Flame, Thermometer, Snowflake,
  Tag, Filter, ArrowUpDown, X, Plus, Check, ExternalLink,
  MessageCircle, History, User
} from "lucide-react";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type FollowUpStatus = "pending" | "contacted" | "follow_up_scheduled" | "converted" | "not_interested";
type Priority = "hot" | "warm" | "cold";
type InteractionType = "call" | "whatsapp" | "email" | "visit" | "note";

type Interaction = {
  type: InteractionType;
  content: string;
  timestamp: string;
  byUserId: number;
};

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
  notes: string | null;
  source: "owner" | "trainer" | "kiosk" | null;
  convertedToMember: boolean | null;
  followUpStatus: FollowUpStatus | null;
  followUpNotes: string | null;
  followUpDate: string | null;
  priority: Priority | null;
  tags: string[] | null;
  assignedTrainerId: number | null;
  scheduledFollowUpDate: string | null;
  interactionHistory: Interaction[] | null;
  createdAt: string;
};

type Trainer = {
  id: number;
  fullName: string;
  email: string;
};

const AVAILABLE_TAGS = [
  "Weight Loss", "Muscle Gain", "Morning Batch", "Evening Batch", 
  "Referred", "Student", "Corporate", "First Timer", "Returning"
];

export default function OwnerFollowUpsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVisitor, setSelectedVisitor] = useState<WalkInVisitor | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "priority">("date");
  const [filterCity, setFilterCity] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [newInteraction, setNewInteraction] = useState({ type: "note" as InteractionType, content: "" });
  const [showHistory, setShowHistory] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: allVisitors = [], isLoading } = useQuery<WalkInVisitor[]>({
    queryKey: ["/api/owner/walk-in-visitors"]
  });

  const { data: trainers = [] } = useQuery<Trainer[]>({
    queryKey: ["/api/owner/trainers"]
  });

  const followUpMutation = useMutation({
    mutationFn: async (data: { 
      visitorId: number; 
      status?: FollowUpStatus; 
      notes?: string;
      priority?: Priority;
      tags?: string[];
      assignedTrainerId?: number | null;
      scheduledFollowUpDate?: string | null;
      interaction?: { type: InteractionType; content: string };
    }) => {
      const { visitorId, ...body } = data;
      return apiRequest("PATCH", `/api/owner/walk-in-visitors/${visitorId}/follow-up`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      toast({ title: "Follow-up updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    }
  });

  const bulkMutation = useMutation({
    mutationFn: async ({ visitorIds, status, notes }: { visitorIds: number[]; status: FollowUpStatus; notes?: string }) => {
      return apiRequest("PATCH", `/api/owner/walk-in-visitors/bulk-follow-up`, { visitorIds, status, notes });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      setSelectedIds([]);
      setBulkMode(false);
      toast({ title: `Updated ${data.updated} visitors` });
    },
    onError: (error: Error) => {
      toast({ title: "Bulk update failed", description: error.message, variant: "destructive" });
    }
  });

  const enquiryTrialVisitors = useMemo(() => {
    let visitors = allVisitors.filter(v => v.visitType === "enquiry" || v.visitType === "trial");
    
    if (filterCity) {
      visitors = visitors.filter(v => v.city?.toLowerCase().includes(filterCity.toLowerCase()));
    }
    if (filterType !== "all") {
      visitors = visitors.filter(v => v.visitType === filterType);
    }
    if (filterPriority !== "all") {
      visitors = visitors.filter(v => (v.priority || "warm") === filterPriority);
    }
    
    visitors.sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { hot: 0, warm: 1, cold: 2 };
        return (priorityOrder[a.priority || "warm"] || 1) - (priorityOrder[b.priority || "warm"] || 1);
      }
      return new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime();
    });
    
    return visitors;
  }, [allVisitors, filterCity, filterType, filterPriority, sortBy]);

  const pendingVisitors = enquiryTrialVisitors.filter(v => !v.followUpStatus || v.followUpStatus === "pending");
  const contactedVisitors = enquiryTrialVisitors.filter(v => v.followUpStatus === "contacted");
  const scheduledVisitors = enquiryTrialVisitors.filter(v => v.followUpStatus === "follow_up_scheduled");
  const convertedVisitors = enquiryTrialVisitors.filter(v => v.followUpStatus === "converted");
  const notInterestedVisitors = enquiryTrialVisitors.filter(v => v.followUpStatus === "not_interested");

  const overdueVisitors = scheduledVisitors.filter(v => 
    v.scheduledFollowUpDate && isBefore(new Date(v.scheduledFollowUpDate), startOfDay(new Date()))
  );

  const stats = {
    total: enquiryTrialVisitors.length,
    pending: pendingVisitors.length,
    contacted: contactedVisitors.length,
    converted: convertedVisitors.length,
    overdue: overdueVisitors.length,
    conversionRate: enquiryTrialVisitors.length > 0 
      ? Math.round((convertedVisitors.length / enquiryTrialVisitors.length) * 100) 
      : 0
  };

  const cities = useMemo(() => {
    const citySet = new Set<string>();
    allVisitors.forEach(v => { if (v.city) citySet.add(v.city); });
    return Array.from(citySet).sort();
  }, [allVisitors]);

  const openFollowUp = (visitor: WalkInVisitor) => {
    setSelectedVisitor(visitor);
    setFollowUpNotes(visitor.followUpNotes || "");
    setSelectedTags(visitor.tags || []);
    setScheduledDate(visitor.scheduledFollowUpDate ? new Date(visitor.scheduledFollowUpDate) : undefined);
    setNewInteraction({ type: "note", content: "" });
    setShowHistory(false);
  };

  const handleFollowUpStatus = (status: FollowUpStatus) => {
    if (selectedVisitor) {
      followUpMutation.mutate({ 
        visitorId: selectedVisitor.id, 
        status, 
        notes: followUpNotes || undefined 
      }, {
        onSuccess: () => setSelectedVisitor(null)
      });
    }
  };

  const handlePriorityChange = (priority: Priority) => {
    if (selectedVisitor) {
      followUpMutation.mutate({ visitorId: selectedVisitor.id, priority });
    }
  };

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
    if (selectedVisitor) {
      followUpMutation.mutate({ visitorId: selectedVisitor.id, tags });
    }
  };

  const handleAssignTrainer = (trainerId: string) => {
    if (selectedVisitor) {
      followUpMutation.mutate({ 
        visitorId: selectedVisitor.id, 
        assignedTrainerId: trainerId ? parseInt(trainerId) : null 
      });
    }
  };

  const handleScheduleFollowUp = (date: Date | undefined) => {
    setScheduledDate(date);
    if (selectedVisitor) {
      followUpMutation.mutate({ 
        visitorId: selectedVisitor.id, 
        scheduledFollowUpDate: date ? date.toISOString() : null,
        status: date ? "follow_up_scheduled" : undefined
      });
    }
  };

  const handleAddInteraction = () => {
    if (selectedVisitor && newInteraction.content.trim()) {
      followUpMutation.mutate({ 
        visitorId: selectedVisitor.id, 
        interaction: newInteraction 
      }, {
        onSuccess: () => {
          setNewInteraction({ type: "note", content: "" });
          const updated = allVisitors.find(v => v.id === selectedVisitor.id);
          if (updated) setSelectedVisitor(updated);
        }
      });
    }
  };

  const handleBulkAction = (status: FollowUpStatus) => {
    if (selectedIds.length > 0) {
      bulkMutation.mutate({ visitorIds: selectedIds, status });
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = (visitors: WalkInVisitor[]) => {
    const ids = visitors.map(v => v.id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
    }
  };

  const getPriorityIcon = (priority: Priority | null) => {
    switch (priority) {
      case "hot":
        return <Flame className="w-4 h-4 text-red-500" />;
      case "cold":
        return <Snowflake className="w-4 h-4 text-blue-500" />;
      default:
        return <Thermometer className="w-4 h-4 text-amber-500" />;
    }
  };

  const getPriorityBadge = (priority: Priority | null) => {
    switch (priority) {
      case "hot":
        return <Badge className="bg-red-500">Hot</Badge>;
      case "cold":
        return <Badge className="bg-blue-500">Cold</Badge>;
      default:
        return <Badge className="bg-amber-500">Warm</Badge>;
    }
  };

  const getVisitTypeBadge = (type: string) => {
    switch (type) {
      case "trial":
        return <Badge className="bg-blue-500">Trial</Badge>;
      case "enquiry":
        return <Badge className="bg-amber-500">Enquiry</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const getStatusIcon = (status: FollowUpStatus | null) => {
    switch (status) {
      case "contacted":
        return <PhoneCall className="w-4 h-4 text-blue-600" />;
      case "follow_up_scheduled":
        return <Clock className="w-4 h-4 text-purple-600" />;
      case "converted":
        return <UserCheck className="w-4 h-4 text-green-600" />;
      case "not_interested":
        return <Ban className="w-4 h-4 text-red-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
    }
  };

  const getInteractionIcon = (type: InteractionType) => {
    switch (type) {
      case "call":
        return <Phone className="w-3 h-3" />;
      case "whatsapp":
        return <MessageCircle className="w-3 h-3" />;
      case "email":
        return <Mail className="w-3 h-3" />;
      case "visit":
        return <User className="w-3 h-3" />;
      default:
        return <MessageSquare className="w-3 h-3" />;
    }
  };

  const VisitorCard = ({ visitor, showCheckbox }: { visitor: WalkInVisitor; showCheckbox?: boolean }) => {
    const isOverdue = visitor.scheduledFollowUpDate && 
      isBefore(new Date(visitor.scheduledFollowUpDate), startOfDay(new Date()));
    const assignedTrainer = trainers.find(t => t.id === visitor.assignedTrainerId);
    
    return (
      <Card 
        className={`cursor-pointer hover-elevate transition-all ${isOverdue ? 'border-red-300 dark:border-red-800' : ''}`}
        onClick={() => !bulkMode && openFollowUp(visitor)}
        data-testid={`follow-up-card-${visitor.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              {showCheckbox && (
                <Checkbox 
                  checked={selectedIds.includes(visitor.id)}
                  onCheckedChange={() => toggleSelectId(visitor.id)}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`checkbox-visitor-${visitor.id}`}
                />
              )}
              {getPriorityIcon(visitor.priority)}
              <h4 className="font-medium truncate">{visitor.visitorName}</h4>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
              {getVisitTypeBadge(visitor.visitType)}
            </div>
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            {visitor.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{visitor.phone}</span>
              </div>
            )}
            {visitor.city && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{visitor.city}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Visited {format(new Date(visitor.visitDate), "MMM d, yyyy")}</span>
            </div>
            {visitor.scheduledFollowUpDate && (
              <div className="flex items-center gap-2 text-purple-600">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Follow-up: {format(new Date(visitor.scheduledFollowUpDate), "MMM d, h:mm a")}</span>
              </div>
            )}
          </div>

          {assignedTrainer && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span>Assigned to {assignedTrainer.fullName}</span>
            </div>
          )}

          {visitor.tags && visitor.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {visitor.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
              {visitor.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  +{visitor.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {visitor.followUpNotes && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground line-clamp-2">
                <MessageSquare className="w-3 h-3 inline mr-1" />
                {visitor.followUpNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const VisitorList = ({ visitors, emptyMessage }: { visitors: WalkInVisitor[], emptyMessage: string }) => (
    <>
      {bulkMode && visitors.length > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
          <Checkbox 
            checked={visitors.every(v => selectedIds.includes(v.id))}
            onCheckedChange={() => selectAll(visitors)}
            data-testid="checkbox-select-all"
          />
          <span className="text-sm">Select all ({visitors.length})</span>
        </div>
      )}
      {visitors.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visitors.map((visitor) => (
            <VisitorCard key={visitor.id} visitor={visitor} showCheckbox={bulkMode} />
          ))}
        </div>
      )}
    </>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Follow-ups</h2>
          <p className="text-muted-foreground mt-1">Track and convert your trial and enquiry visitors</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={bulkMode ? "default" : "outline"} 
            size="sm"
            onClick={() => { setBulkMode(!bulkMode); setSelectedIds([]); }}
            data-testid="button-bulk-mode"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            {bulkMode ? "Cancel" : "Bulk Actions"}
          </Button>
        </div>
      </div>

      {bulkMode && selectedIds.length > 0 && (
        <Card className="border-primary">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">{selectedIds.length} selected</span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkAction("contacted")} disabled={bulkMutation.isPending}>
                  <PhoneCall className="w-4 h-4 mr-1" /> Mark Contacted
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction("converted")} disabled={bulkMutation.isPending}>
                  <UserCheck className="w-4 h-4 mr-1" /> Mark Converted
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction("not_interested")} disabled={bulkMutation.isPending}>
                  <Ban className="w-4 h-4 mr-1" /> Mark Closed
                </Button>
              </div>
              {bulkMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-4">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Need follow-up</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-4">
            <CardTitle className="text-sm font-medium">Contacted</CardTitle>
            <PhoneCall className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.contacted}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-4">
            <CardTitle className="text-sm font-medium">Converted</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.converted}</div>
            <p className="text-xs text-muted-foreground">Became members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 p-4">
            <CardTitle className="text-sm font-medium">Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">Success rate</p>
          </CardContent>
        </Card>
      </div>

      {stats.overdue > 0 && (
        <Card className="border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              {stats.overdue} overdue follow-up{stats.overdue > 1 ? 's' : ''} need attention
            </span>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32 h-8" data-testid="select-filter-type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="enquiry">Enquiry</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32 h-8" data-testid="select-filter-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="hot">Hot</SelectItem>
            <SelectItem value="warm">Warm</SelectItem>
            <SelectItem value="cold">Cold</SelectItem>
          </SelectContent>
        </Select>
        {cities.length > 0 && (
          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-32 h-8" data-testid="select-filter-city">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Cities</SelectItem>
              {cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "priority")}>
            <SelectTrigger className="w-32 h-8" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">By Date</SelectItem>
              <SelectItem value="priority">By Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending" className="relative" data-testid="tab-pending">
            Pending
            {stats.pending > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{stats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacted" data-testid="tab-contacted">Contacted</TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            Scheduled
            {stats.overdue > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 px-1.5">{stats.overdue}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="converted" data-testid="tab-converted">Converted</TabsTrigger>
          <TabsTrigger value="closed" data-testid="tab-closed">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <VisitorList visitors={pendingVisitors} emptyMessage="No pending follow-ups. Great job!" />
        </TabsContent>
        <TabsContent value="contacted" className="mt-4">
          <VisitorList visitors={contactedVisitors} emptyMessage="No visitors in contacted status" />
        </TabsContent>
        <TabsContent value="scheduled" className="mt-4">
          <VisitorList visitors={scheduledVisitors} emptyMessage="No scheduled follow-ups" />
        </TabsContent>
        <TabsContent value="converted" className="mt-4">
          <VisitorList visitors={convertedVisitors} emptyMessage="No converted visitors yet" />
        </TabsContent>
        <TabsContent value="closed" className="mt-4">
          <VisitorList visitors={notInterestedVisitors} emptyMessage="No closed leads" />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedVisitor} onOpenChange={(open) => !open && setSelectedVisitor(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedVisitor && getStatusIcon(selectedVisitor.followUpStatus)}
              {selectedVisitor?.visitorName}
            </DialogTitle>
            <DialogDescription>
              Manage follow-up for this visitor
            </DialogDescription>
          </DialogHeader>
          
          {selectedVisitor && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {getVisitTypeBadge(selectedVisitor.visitType)}
                {getPriorityBadge(selectedVisitor.priority)}
                <span className="text-sm text-muted-foreground">
                  {format(new Date(selectedVisitor.visitDate), "MMM d, yyyy")}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedVisitor.phone && (
                  <>
                    <Button size="sm" variant="outline" asChild data-testid="button-call">
                      <a href={`tel:${selectedVisitor.phone}`}>
                        <Phone className="w-4 h-4 mr-1" /> Call
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" asChild data-testid="button-whatsapp">
                      <a href={`https://wa.me/${selectedVisitor.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-4 h-4 mr-1" /> WhatsApp
                      </a>
                    </Button>
                  </>
                )}
                {selectedVisitor.email && (
                  <Button size="sm" variant="outline" asChild data-testid="button-email">
                    <a href={`mailto:${selectedVisitor.email}`}>
                      <Mail className="w-4 h-4 mr-1" /> Email
                    </a>
                  </Button>
                )}
              </div>

              <div className="space-y-2 p-3 bg-muted/50 rounded-lg text-sm">
                {selectedVisitor.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {selectedVisitor.phone}
                  </div>
                )}
                {selectedVisitor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {selectedVisitor.email}
                  </div>
                )}
                {selectedVisitor.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {selectedVisitor.city}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Priority</label>
                  <Select 
                    value={selectedVisitor.priority || "warm"} 
                    onValueChange={(v) => handlePriorityChange(v as Priority)}
                  >
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hot">
                        <span className="flex items-center gap-2"><Flame className="w-4 h-4 text-red-500" /> Hot</span>
                      </SelectItem>
                      <SelectItem value="warm">
                        <span className="flex items-center gap-2"><Thermometer className="w-4 h-4 text-amber-500" /> Warm</span>
                      </SelectItem>
                      <SelectItem value="cold">
                        <span className="flex items-center gap-2"><Snowflake className="w-4 h-4 text-blue-500" /> Cold</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Assign to</label>
                  <Select 
                    value={selectedVisitor.assignedTrainerId?.toString() || ""} 
                    onValueChange={handleAssignTrainer}
                  >
                    <SelectTrigger data-testid="select-trainer">
                      <SelectValue placeholder="Select trainer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {trainers.map(trainer => (
                        <SelectItem key={trainer.id} value={trainer.id.toString()}>
                          {trainer.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Schedule Follow-up</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" data-testid="button-schedule">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                      {scheduledDate && (
                        <X 
                          className="w-4 h-4 ml-auto" 
                          onClick={(e) => { e.stopPropagation(); handleScheduleFollowUp(undefined); }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={handleScheduleFollowUp}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TAGS.map(tag => (
                    <Badge 
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const newTags = selectedTags.includes(tag) 
                          ? selectedTags.filter(t => t !== tag)
                          : [...selectedTags, tag];
                        handleTagsChange(newTags);
                      }}
                      data-testid={`tag-${tag.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      {selectedTags.includes(tag) && <Check className="w-3 h-3 mr-1" />}
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedVisitor.notes && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Visit Notes:</p>
                  <p className="text-muted-foreground">{selectedVisitor.notes}</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium">Log Interaction</label>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowHistory(!showHistory)}
                    data-testid="button-toggle-history"
                  >
                    <History className="w-4 h-4 mr-1" />
                    {showHistory ? "Hide" : "Show"} History
                  </Button>
                </div>
                <div className="flex gap-2 mb-2">
                  <Select 
                    value={newInteraction.type} 
                    onValueChange={(v) => setNewInteraction(prev => ({ ...prev, type: v as InteractionType }))}
                  >
                    <SelectTrigger className="w-28" data-testid="select-interaction-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="visit">Visit</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input 
                    placeholder="What happened?"
                    value={newInteraction.content}
                    onChange={(e) => setNewInteraction(prev => ({ ...prev, content: e.target.value }))}
                    className="flex-1"
                    data-testid="input-interaction-content"
                  />
                  <Button 
                    size="icon" 
                    onClick={handleAddInteraction}
                    disabled={!newInteraction.content.trim() || followUpMutation.isPending}
                    data-testid="button-add-interaction"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {showHistory && selectedVisitor.interactionHistory && selectedVisitor.interactionHistory.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto p-2 bg-muted/30 rounded-lg">
                    {[...selectedVisitor.interactionHistory].reverse().map((interaction, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <div className="mt-0.5 p-1 bg-muted rounded">
                          {getInteractionIcon(interaction.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-muted-foreground truncate">{interaction.content}</p>
                          <p className="text-muted-foreground/60">
                            {format(new Date(interaction.timestamp), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Follow-up Notes</label>
                <Textarea
                  placeholder="Add notes about this follow-up conversation..."
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={2}
                  data-testid="input-follow-up-notes"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium block">Update Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleFollowUpStatus("contacted")}
                    disabled={followUpMutation.isPending}
                    className="justify-start"
                    data-testid="button-status-contacted"
                  >
                    <PhoneCall className="w-4 h-4 mr-2 text-blue-600" />
                    Contacted
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleFollowUpStatus("follow_up_scheduled")}
                    disabled={followUpMutation.isPending}
                    className="justify-start"
                    data-testid="button-status-scheduled"
                  >
                    <Clock className="w-4 h-4 mr-2 text-purple-600" />
                    Scheduled
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleFollowUpStatus("converted")}
                    disabled={followUpMutation.isPending}
                    className="justify-start text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950"
                    data-testid="button-status-converted"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Converted
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleFollowUpStatus("not_interested")}
                    disabled={followUpMutation.isPending}
                    className="justify-start"
                    data-testid="button-status-not-interested"
                  >
                    <Ban className="w-4 h-4 mr-2 text-red-600" />
                    Not Interested
                  </Button>
                </div>
              </div>

              {followUpMutation.isPending && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
