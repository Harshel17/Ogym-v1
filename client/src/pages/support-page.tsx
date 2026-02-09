import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, MessageSquare, Clock, CheckCircle, AlertCircle, HelpCircle, Mail, CreditCard, Users, Bug, ChevronDown, Dumbbell, UtensilsCrossed, UserCog, Receipt } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

type SupportTicket = {
  id: number;
  userId: number | null;
  userRole: string;
  gymId: number | null;
  contactEmailOrPhone: string | null;
  issueType: string;
  priority: string;
  description: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type SupportMessage = {
  id: number;
  ticketId: number;
  senderType: string;
  senderId: number | null;
  message: string;
  createdAt: Date;
};

const gymIssueTypes = [
  { value: "attendance", label: "Attendance Issue" },
  { value: "payments", label: "Payment Issue" },
  { value: "profile_update", label: "Profile Update" },
  { value: "trainer_assignment", label: "Trainer Assignment" },
  { value: "bug_report", label: "Bug Report" },
  { value: "other", label: "Other" },
];

const personalIssueTypes = [
  { value: "workout", label: "Workout Issue" },
  { value: "nutrition", label: "Nutrition / Calorie Tracking" },
  { value: "account", label: "Account Issue" },
  { value: "subscription", label: "Subscription / Billing" },
  { value: "bug_report", label: "Bug Report" },
  { value: "other", label: "Other" },
];

const allIssueTypeLabels: Record<string, string> = {
  login: "Login Issue",
  otp: "OTP Issue",
  password: "Password Issue",
  gym_code: "Gym Code Issue",
  attendance: "Attendance Issue",
  payments: "Payment Issue",
  profile_update: "Profile Update",
  trainer_assignment: "Trainer Assignment",
  bug_report: "Bug Report",
  workout: "Workout Issue",
  nutrition: "Nutrition / Calorie Tracking",
  account: "Account Issue",
  subscription: "Subscription / Billing",
  other: "Other",
};

export default function SupportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isPersonalMode = user?.role === 'member' && !user?.gymId;
  const issueTypes = isPersonalMode ? personalIssueTypes : gymIssueTypes;
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");

  const [issueType, setIssueType] = useState("other");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [description, setDescription] = useState("");
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const validValues = issueTypes.map(t => t.value);
    if (!validValues.includes(issueType)) {
      setIssueType(issueTypes[0].value);
    }
  }, [isPersonalMode]);

  const { data: tickets, isLoading } = useQuery<SupportTicket[]>({
    queryKey: ["/api/support/my-tickets"],
  });

  const { data: ticketDetails, isLoading: loadingDetails } = useQuery<{
    ticket: SupportTicket;
    messages: SupportMessage[];
  }>({
    queryKey: ["/api/support/ticket", selectedTicket?.id],
    enabled: !!selectedTicket,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: { issueType: string; priority: string; description: string }) => {
      return apiRequest("POST", "/api/support", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/my-tickets"] });
      toast({ title: "Support ticket created successfully" });
      handleCloseCreateDialog();
    },
    onError: () => {
      toast({ title: "Failed to create ticket", variant: "destructive" });
    },
  });

  const addMessageMutation = useMutation({
    mutationFn: async (data: { ticketId: number; message: string }) => {
      return apiRequest("POST", `/api/support/ticket/${data.ticketId}/message`, { message: data.message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/ticket", selectedTicket?.id] });
      setNewMessage("");
      toast({ title: "Message sent" });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const handleCloseCreateDialog = () => {
    setCreateDialogOpen(false);
    setIssueType(issueTypes[0]?.value || "other");
    setPriority("medium");
    setDescription("");
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast({ title: "Please provide a description", variant: "destructive" });
      return;
    }
    createTicketMutation.mutate({ issueType, priority, description });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;
    addMessageMutation.mutate({ ticketId: selectedTicket.id, message: newMessage });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "waiting_user":
        return <MessageSquare className="w-4 h-4 text-orange-500" />;
      case "closed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <HelpCircle className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      open: "default",
      in_progress: "secondary",
      waiting_user: "outline",
      closed: "secondary",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200",
      high: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200",
    };
    return (
      <Badge className={colors[priority] || ""}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getIssueTypeIcon = (type: string) => {
    switch (type) {
      case "workout": return <Dumbbell className="w-4 h-4" />;
      case "nutrition": return <UtensilsCrossed className="w-4 h-4" />;
      case "account": return <UserCog className="w-4 h-4" />;
      case "subscription": return <Receipt className="w-4 h-4" />;
      case "payments": return <CreditCard className="w-4 h-4" />;
      case "bug_report": return <Bug className="w-4 h-4" />;
      default: return <HelpCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-support-title">Support</h1>
          <p className="text-sm text-muted-foreground">Submit and manage your support requests</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-new-ticket">
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !tickets || tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <HelpCircle className="w-7 h-7 text-primary" />
            </div>
            <p className="font-medium mb-1">No support tickets yet</p>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              {isPersonalMode 
                ? "Need help with your workouts, nutrition tracking, or account? Create a support request."
                : "Need help? Create a support request and our team will assist you."
              }
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-ticket">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Tickets</CardTitle>
              <CardDescription>Click on a ticket to view details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-4 border rounded-md cursor-pointer transition-colors hover-elevate ${
                      selectedTicket?.id === ticket.id ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => setSelectedTicket(ticket)}
                    data-testid={`card-ticket-${ticket.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ticket.status)}
                        <span className="font-medium text-sm">#{ticket.id}</span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {getStatusBadge(ticket.status)}
                        {getPriorityBadge(ticket.priority)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      {getIssueTypeIcon(ticket.issueType)}
                      <p className="text-sm text-muted-foreground">
                        {allIssueTypeLabels[ticket.issueType] || ticket.issueType}
                      </p>
                    </div>
                    <p className="text-sm line-clamp-2">{ticket.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created: {format(new Date(ticket.createdAt), "PPp")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ticket Details</CardTitle>
              <CardDescription>
                {selectedTicket ? `Ticket #${selectedTicket.id}` : "Select a ticket to view details"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedTicket ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Select a ticket to view conversation</p>
                </div>
              ) : loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-secondary/50 rounded-md space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(ticketDetails?.ticket.status || selectedTicket.status)}
                      {getPriorityBadge(ticketDetails?.ticket.priority || selectedTicket.priority)}
                    </div>
                    <div className="flex items-center gap-2">
                      {getIssueTypeIcon(ticketDetails?.ticket.issueType || selectedTicket.issueType)}
                      <p className="text-sm font-medium">
                        {allIssueTypeLabels[ticketDetails?.ticket.issueType || selectedTicket.issueType] || selectedTicket.issueType}
                      </p>
                    </div>
                    <p className="text-sm">{ticketDetails?.ticket.description || selectedTicket.description}</p>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-3">Conversation</h4>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {(!ticketDetails?.messages || ticketDetails.messages.length === 0) ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No messages yet</p>
                      ) : (
                        ticketDetails.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-md ${
                              msg.senderType === "admin" 
                                ? "bg-primary/10 ml-0 mr-8" 
                                : "bg-secondary ml-8 mr-0"
                            }`}
                          >
                            <p className="text-xs font-medium mb-1">
                              {msg.senderType === "admin" ? "Support Team" : "You"}
                            </p>
                            <p className="text-sm">{msg.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(msg.createdAt), "PPp")}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {(ticketDetails?.ticket.status || selectedTicket.status) !== "closed" && (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <Input
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-1"
                        data-testid="input-ticket-message"
                      />
                      <Button 
                        type="submit" 
                        disabled={!newMessage.trim() || addMessageMutation.isPending}
                        data-testid="button-send-message"
                      >
                        {addMessageMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Send"
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Collapsible open={contactOpen} onOpenChange={setContactOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-secondary/30 transition-colors rounded-t-md" data-testid="button-contact-toggle">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Contact Us Directly</CardTitle>
                    <CardDescription>Email us for quick assistance</CardDescription>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${contactOpen ? "rotate-180" : ""}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                <a
                  href="mailto:support@ogym.fitness"
                  className="group flex items-start gap-4 p-4 bg-secondary/30 rounded-md transition-all hover:bg-secondary/50"
                  data-testid="link-email-support"
                >
                  <div className="p-2 bg-primary/10 rounded-full shrink-0">
                    <HelpCircle className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">General Support</p>
                    <p className="text-xs text-muted-foreground">Questions about features & accounts</p>
                    <p className="text-xs font-medium text-primary">support@ogym.fitness</p>
                  </div>
                </a>
                
                <a
                  href="mailto:billing@ogym.fitness"
                  className="group flex items-start gap-4 p-4 bg-secondary/30 rounded-md transition-all hover:bg-secondary/50"
                  data-testid="link-email-billing"
                >
                  <div className="p-2 bg-primary/10 rounded-full shrink-0">
                    <CreditCard className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">Billing & Payments</p>
                    <p className="text-xs text-muted-foreground">Subscriptions & invoices</p>
                    <p className="text-xs font-medium text-primary">billing@ogym.fitness</p>
                  </div>
                </a>
                
                <a
                  href="mailto:sales@ogym.fitness"
                  className="group flex items-start gap-4 p-4 bg-secondary/30 rounded-md transition-all hover:bg-secondary/50"
                  data-testid="link-email-sales"
                >
                  <div className="p-2 bg-primary/10 rounded-full shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">New Gym Partnerships</p>
                    <p className="text-xs text-muted-foreground">Interested in OGym for your gym?</p>
                    <p className="text-xs font-medium text-primary">sales@ogym.fitness</p>
                  </div>
                </a>
                
                <a
                  href="mailto:support@ogym.fitness?subject=Bug Report"
                  className="group flex items-start gap-4 p-4 bg-secondary/30 rounded-md transition-all hover:bg-secondary/50"
                  data-testid="link-email-bugs"
                >
                  <div className="p-2 bg-primary/10 rounded-full shrink-0">
                    <Bug className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">Report a Bug</p>
                    <p className="text-xs text-muted-foreground">Help us improve OGym</p>
                    <p className="text-xs font-medium text-primary">support@ogym.fitness</p>
                  </div>
                </a>
              </div>
              
              <div className="mt-4 pt-3 border-t flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Average response time: within 24 hours</span>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) handleCloseCreateDialog();
        else setCreateDialogOpen(true);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Support Request</DialogTitle>
            <DialogDescription>
              Describe your issue and our team will help you.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Issue Type</label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger data-testid="select-ticket-issue">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  {issueTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                <SelectTrigger data-testid="select-ticket-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder={isPersonalMode 
                  ? "Describe your issue in detail (e.g., workout not saving, calorie count incorrect, etc.)..."
                  : "Describe your issue in detail..."
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[120px]"
                data-testid="textarea-ticket-description"
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleCloseCreateDialog}
                data-testid="button-cancel-ticket"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createTicketMutation.isPending}
                data-testid="button-create-ticket"
              >
                {createTicketMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Ticket"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
