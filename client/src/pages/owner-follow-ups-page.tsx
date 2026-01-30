import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Phone, Mail, Calendar, Loader2, CheckCircle, Clock, 
  MessageSquare, UserCheck, Ban, PhoneCall, MapPin, 
  Users, TrendingUp, AlertCircle
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
  notes: string | null;
  source: "owner" | "trainer" | "kiosk" | null;
  convertedToMember: boolean | null;
  followUpStatus: FollowUpStatus | null;
  followUpNotes: string | null;
  followUpDate: string | null;
  createdAt: string;
};

export default function OwnerFollowUpsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVisitor, setSelectedVisitor] = useState<WalkInVisitor | null>(null);
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const { data: allVisitors = [], isLoading } = useQuery<WalkInVisitor[]>({
    queryKey: ["/api/owner/walk-in-visitors"]
  });

  const followUpMutation = useMutation({
    mutationFn: async ({ visitorId, status, notes }: { visitorId: number; status: FollowUpStatus; notes?: string }) => {
      return apiRequest("PATCH", `/api/owner/walk-in-visitors/${visitorId}/follow-up`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/walk-in-visitors"] });
      setSelectedVisitor(null);
      setFollowUpNotes("");
      toast({ title: "Follow-up updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    }
  });

  const enquiryTrialVisitors = allVisitors.filter(v => v.visitType === "enquiry" || v.visitType === "trial");

  const pendingVisitors = enquiryTrialVisitors.filter(v => !v.followUpStatus || v.followUpStatus === "pending");
  const contactedVisitors = enquiryTrialVisitors.filter(v => v.followUpStatus === "contacted");
  const scheduledVisitors = enquiryTrialVisitors.filter(v => v.followUpStatus === "follow_up_scheduled");
  const convertedVisitors = enquiryTrialVisitors.filter(v => v.followUpStatus === "converted");
  const notInterestedVisitors = enquiryTrialVisitors.filter(v => v.followUpStatus === "not_interested");

  const stats = {
    total: enquiryTrialVisitors.length,
    pending: pendingVisitors.length,
    contacted: contactedVisitors.length,
    converted: convertedVisitors.length,
    conversionRate: enquiryTrialVisitors.length > 0 
      ? Math.round((convertedVisitors.length / enquiryTrialVisitors.length) * 100) 
      : 0
  };

  const openFollowUp = (visitor: WalkInVisitor) => {
    setSelectedVisitor(visitor);
    setFollowUpNotes(visitor.followUpNotes || "");
  };

  const handleFollowUpStatus = (status: FollowUpStatus) => {
    if (selectedVisitor) {
      followUpMutation.mutate({ visitorId: selectedVisitor.id, status, notes: followUpNotes || undefined });
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

  const VisitorCard = ({ visitor }: { visitor: WalkInVisitor }) => (
    <Card 
      className="cursor-pointer hover-elevate transition-all"
      onClick={() => openFollowUp(visitor)}
      data-testid={`follow-up-card-${visitor.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {getStatusIcon(visitor.followUpStatus)}
            <h4 className="font-medium truncate">{visitor.visitorName}</h4>
          </div>
          {getVisitTypeBadge(visitor.visitType)}
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          {visitor.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{visitor.phone}</span>
            </div>
          )}
          {visitor.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{visitor.email}</span>
            </div>
          )}
          {visitor.city && (
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{visitor.city}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Visited {format(new Date(visitor.visitDate), "MMM d, yyyy")}</span>
          </div>
        </div>

        {visitor.followUpNotes && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground line-clamp-2">
              <MessageSquare className="w-3 h-3 inline mr-1" />
              {visitor.followUpNotes}
            </p>
          </div>
        )}

        {visitor.notes && !visitor.followUpNotes && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {visitor.notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const VisitorList = ({ visitors, emptyMessage }: { visitors: WalkInVisitor[], emptyMessage: string }) => (
    visitors.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visitors.map((visitor) => (
          <VisitorCard key={visitor.id} visitor={visitor} />
        ))}
      </div>
    )
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
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Follow-ups</h2>
        <p className="text-muted-foreground mt-1">Track and convert your trial and enquiry visitors</p>
      </div>

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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pending" className="relative" data-testid="tab-pending">
            Pending
            {stats.pending > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{stats.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacted" data-testid="tab-contacted">Contacted</TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="converted" data-testid="tab-converted">Converted</TabsTrigger>
          <TabsTrigger value="closed" data-testid="tab-closed">Closed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <VisitorList 
            visitors={pendingVisitors} 
            emptyMessage="No pending follow-ups. Great job!" 
          />
        </TabsContent>

        <TabsContent value="contacted" className="mt-4">
          <VisitorList 
            visitors={contactedVisitors} 
            emptyMessage="No visitors in contacted status" 
          />
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <VisitorList 
            visitors={scheduledVisitors} 
            emptyMessage="No scheduled follow-ups" 
          />
        </TabsContent>

        <TabsContent value="converted" className="mt-4">
          <VisitorList 
            visitors={convertedVisitors} 
            emptyMessage="No converted visitors yet" 
          />
        </TabsContent>

        <TabsContent value="closed" className="mt-4">
          <VisitorList 
            visitors={notInterestedVisitors} 
            emptyMessage="No closed leads" 
          />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedVisitor} onOpenChange={(open) => !open && setSelectedVisitor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedVisitor && getStatusIcon(selectedVisitor.followUpStatus)}
              {selectedVisitor?.visitorName}
            </DialogTitle>
          </DialogHeader>
          
          {selectedVisitor && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getVisitTypeBadge(selectedVisitor.visitType)}
                <span className="text-sm text-muted-foreground">
                  {format(new Date(selectedVisitor.visitDate), "MMM d, yyyy")}
                </span>
              </div>

              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                {selectedVisitor.phone && (
                  <a href={`tel:${selectedVisitor.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                    <Phone className="w-4 h-4" />
                    {selectedVisitor.phone}
                  </a>
                )}
                {selectedVisitor.email && (
                  <a href={`mailto:${selectedVisitor.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                    <Mail className="w-4 h-4" />
                    {selectedVisitor.email}
                  </a>
                )}
                {selectedVisitor.city && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {selectedVisitor.city}
                  </div>
                )}
              </div>

              {selectedVisitor.notes && (
                <div className="text-sm">
                  <p className="font-medium mb-1">Visit Notes:</p>
                  <p className="text-muted-foreground">{selectedVisitor.notes}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium mb-2 block">Follow-up Notes</label>
                <Textarea
                  placeholder="Add notes about this follow-up conversation..."
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  rows={3}
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
                    className="justify-start text-green-600 border-green-200 hover:bg-green-50"
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
