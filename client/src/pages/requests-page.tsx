import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMemberRequests, useTrainerRequests, useCreateRequest, useRespondToRequest } from "@/hooks/use-workouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MessageSquare, Send, CheckCircle2, Clock, MessageCircle, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type MemberRequestType = {
  id: number;
  type: string;
  message: string;
  status: string | null;
  response: string | null;
  trainerName: string | null;
  createdAt: string;
};

type TrainerRequestType = {
  id: number;
  type: string;
  message: string;
  status: string | null;
  response: string | null;
  memberName: string;
  createdAt: string;
};

export default function RequestsPage() {
  const { user } = useAuth();

  if (!user || user.role === "owner") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">This page is for members and trainers.</p>
      </div>
    );
  }

  return user.role === "member" ? <MemberRequestsView /> : <TrainerRequestsView />;
}

function MemberRequestsView() {
  const [open, setOpen] = useState(false);
  const { data: requests = [], isLoading } = useMemberRequests();
  const createMutation = useCreateRequest();

  const requestsList = requests as MemberRequestType[];

  const formSchema = z.object({
    type: z.enum(["feedback", "change_request", "question"]),
    message: z.string().min(5, "Message must be at least 5 characters"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "feedback",
      message: "",
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="page-header-gradient">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold font-display text-foreground">My Requests</h2>
            <p className="text-sm text-muted-foreground mt-1">Send feedback or requests to your trainer.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-request">
              <Send className="w-4 h-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Send a Request to Your Trainer</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-request-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="feedback" data-testid="option-feedback">Feedback</SelectItem>
                          <SelectItem value="change_request" data-testid="option-change-request">Workout Change Request</SelectItem>
                          <SelectItem value="question" data-testid="option-question">Question</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="What would you like to tell your trainer?"
                          className="min-h-24"
                          {...field}
                          data-testid="input-message"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-request">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-request">
                    {createMutation.isPending ? "Sending..." : "Send Request"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : requestsList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No requests yet</h3>
            <p className="text-muted-foreground mt-2">Send a request to your trainer to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requestsList.map((req) => (
            <Card key={req.id} data-testid={`card-request-${req.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <RequestTypeBadge type={req.type} />
                    <StatusBadge status={req.status} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm" data-testid={`text-message-${req.id}`}>{req.message}</p>
                {req.response && (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium text-primary" data-testid={`text-trainer-name-${req.id}`}>
                        Response from {req.trainerName || "Trainer"}
                      </span>
                    </div>
                    <p className="text-sm" data-testid={`text-response-${req.id}`}>{req.response}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainerRequestsView() {
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [response, setResponse] = useState("");
  const { data: requests = [], isLoading } = useTrainerRequests();
  const respondMutation = useRespondToRequest();

  const requestsList = requests as TrainerRequestType[];

  const handleRespond = (requestId: number) => {
    if (response.trim()) {
      respondMutation.mutate(
        { requestId, response },
        {
          onSuccess: () => {
            setRespondingTo(null);
            setResponse("");
          },
        }
      );
    }
  };

  return (
    <div className="space-y-8">
      <div className="page-header-gradient">
        <h2 className="text-2xl font-bold font-display text-foreground">Member Requests</h2>
        <p className="text-sm text-muted-foreground mt-1">View and respond to requests from your members.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : requestsList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No requests yet</h3>
            <p className="text-muted-foreground mt-2">Your members haven't sent any requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requestsList.map((req) => (
            <Card key={req.id} data-testid={`card-request-${req.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" data-testid={`text-member-name-${req.id}`}>{req.memberName}</span>
                    <RequestTypeBadge type={req.type} />
                    <StatusBadge status={req.status} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm" data-testid={`text-trainer-message-${req.id}`}>{req.message}</p>
                {req.response ? (
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-green-600">Your Response</span>
                    </div>
                    <p className="text-sm" data-testid={`text-trainer-response-${req.id}`}>{req.response}</p>
                  </div>
                ) : (
                  <>
                    {respondingTo === req.id ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Write your response..."
                          value={response}
                          onChange={(e) => setResponse(e.target.value)}
                          className="min-h-20"
                          data-testid={`input-response-${req.id}`}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRespondingTo(null);
                              setResponse("");
                            }}
                            data-testid={`button-cancel-response-${req.id}`}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleRespond(req.id)}
                            disabled={respondMutation.isPending || !response.trim()}
                            data-testid={`button-submit-response-${req.id}`}
                          >
                            {respondMutation.isPending ? "Sending..." : "Send Response"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRespondingTo(req.id)}
                        data-testid={`button-respond-${req.id}`}
                      >
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Respond
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    feedback: { label: "Feedback", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
    change_request: { label: "Change Request", className: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
    question: { label: "Question", className: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  };
  const { label, className } = config[type] || { label: type, className: "" };
  return <Badge className={className}>{label}</Badge>;
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "resolved") {
    return (
      <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Resolved
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Clock className="w-3 h-3 mr-1" />
      Pending
    </Badge>
  );
}
