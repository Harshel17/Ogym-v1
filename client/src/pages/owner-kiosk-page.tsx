import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { QrCode, Plus, Clock, Copy, Power, PowerOff, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface KioskSession {
  id: number;
  gymId: number;
  token: string;
  label: string | null;
  expiresAt: string;
  isActive: boolean | null;
  createdAt: string | null;
}

const createSessionSchema = z.object({
  label: z.string().min(1, "Label is required"),
  expiryHours: z.string(),
});

type CreateSessionForm = z.infer<typeof createSessionSchema>;

export default function OwnerKioskPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [qrSession, setQrSession] = useState<KioskSession | null>(null);

  const form = useForm<CreateSessionForm>({
    resolver: zodResolver(createSessionSchema),
    defaultValues: {
      label: "",
      expiryHours: "8",
    },
  });

  const { data: sessions = [], isLoading } = useQuery<KioskSession[]>({
    queryKey: ["/api/owner/kiosk-sessions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSessionForm) => {
      return apiRequest("POST", "/api/owner/kiosk-sessions", {
        label: data.label,
        expiryHours: parseInt(data.expiryHours),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/kiosk-sessions"] });
      form.reset({ label: "", expiryHours: "8" });
      setIsCreateOpen(false);
      toast({ title: "Check-in link created", description: "You can now share the QR code or link with visitors." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create", description: error.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/owner/kiosk-sessions/${id}/deactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner/kiosk-sessions"] });
      toast({ title: "Link deactivated", description: "This check-in link will no longer work." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to deactivate", description: error.message, variant: "destructive" });
    },
  });

  const getCheckInUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/checkin/${token}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const isSessionActive = (session: KioskSession) => {
    return session.isActive && new Date(session.expiresAt) > new Date();
  };

  const getSessionStatus = (session: KioskSession) => {
    if (!session.isActive) return { label: "Deactivated", variant: "secondary" as const };
    if (new Date(session.expiresAt) < new Date()) return { label: "Expired", variant: "destructive" as const };
    return { label: "Active", variant: "default" as const };
  };

  const activeSessions = sessions.filter(s => isSessionActive(s));
  const inactiveSessions = sessions.filter(s => !isSessionActive(s));

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="owner-kiosk-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Self Check-in</h1>
          <p className="text-muted-foreground">
            Create QR codes for visitors to check themselves in
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-link">
              <Plus className="mr-2 h-4 w-4" />
              Create Check-in Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Check-in Link</DialogTitle>
              <DialogDescription>
                Generate a QR code that visitors can scan to register themselves.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Front Desk, Morning Shift" {...field} data-testid="input-label" />
                      </FormControl>
                      <FormDescription>A name to identify this link</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expiryHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid For</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-expiry">
                            <SelectValue placeholder="Select duration" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="8">8 hours</SelectItem>
                          <SelectItem value="12">12 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="72">3 days</SelectItem>
                          <SelectItem value="168">1 week</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>How long the link stays active</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-create">
                  {createMutation.isPending ? "Creating..." : "Create Link"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <QrCode className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No check-in links yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a QR code for visitors to register themselves when staff is unavailable.
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first">
              <Plus className="mr-2 h-4 w-4" />
              Create First Link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeSessions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Active Links ({activeSessions.length})</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {activeSessions.map((session) => {
                  const status = getSessionStatus(session);
                  const url = getCheckInUrl(session.token);
                  return (
                    <Card key={session.id} data-testid={`card-session-${session.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{session.label || "Unnamed"}</CardTitle>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <CardDescription className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {format(new Date(session.expiresAt), "MMM d, h:mm a")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setQrSession(session)}
                            data-testid={`button-show-qr-${session.id}`}
                          >
                            <QrCode className="mr-2 h-4 w-4" />
                            Show QR
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => copyToClipboard(url)}
                            data-testid={`button-copy-link-${session.id}`}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Link
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => window.open(url, "_blank")}
                            data-testid={`button-open-link-${session.id}`}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            onClick={() => deactivateMutation.mutate(session.id)}
                            disabled={deactivateMutation.isPending}
                            data-testid={`button-deactivate-${session.id}`}
                          >
                            <PowerOff className="mr-2 h-4 w-4" />
                            Deactivate
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {inactiveSessions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 text-muted-foreground">
                Past Links ({inactiveSessions.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inactiveSessions.slice(0, 6).map((session) => {
                  const status = getSessionStatus(session);
                  return (
                    <Card key={session.id} className="opacity-60" data-testid={`card-session-inactive-${session.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm">{session.label || "Unnamed"}</CardTitle>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          Created {format(new Date(session.createdAt || ""), "MMM d")}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!qrSession} onOpenChange={() => setQrSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check-in QR Code</DialogTitle>
            <DialogDescription>
              {qrSession?.label} - Visitors can scan this to register
            </DialogDescription>
          </DialogHeader>
          {qrSession && (
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getCheckInUrl(qrSession.token))}`}
                  alt="QR Code"
                  className="w-48 h-48"
                  data-testid="img-qr-code"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all">
                {getCheckInUrl(qrSession.token)}
              </p>
              <Button
                className="w-full"
                onClick={() => copyToClipboard(getCheckInUrl(qrSession.token))}
                data-testid="button-copy-qr-link"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
