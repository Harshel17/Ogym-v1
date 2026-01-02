import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2, Loader2, Clock, CheckCircle2, XCircle, Send } from "lucide-react";

type JoinRequest = {
  id: number;
  gymId: number;
  gymName: string;
  gymCode: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
};

const formSchema = z.object({
  gymCode: z.string().min(1, "Gym code is required")
});

export default function JoinGymPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRequest, isLoading } = useQuery<JoinRequest | null>({
    queryKey: ["/api/join-requests/my"]
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gymCode: ""
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/join-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/join-requests/my"] });
      toast({ title: "Join request submitted successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to submit request", variant: "destructive" });
    }
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    submitMutation.mutate(data);
  };

  if (user?.gymId) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">You already belong to a gym</h2>
        <p className="text-muted-foreground">You are already associated with a gym.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (existingRequest && existingRequest.status === "pending") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Join a Gym</h2>
          <p className="text-muted-foreground mt-1">Your request is being reviewed by the gym owner.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Request Pending
            </CardTitle>
            <CardDescription>
              Your request to join {existingRequest.gymName} is awaiting approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gym Name</span>
              <span className="font-medium">{existingRequest.gymName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gym Code</span>
              <Badge variant="outline" className="font-mono">{existingRequest.gymCode}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary">Pending Approval</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Submitted</span>
              <span className="text-sm">{new Date(existingRequest.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (existingRequest && existingRequest.status === "rejected") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Join a Gym</h2>
          <p className="text-muted-foreground mt-1">Your previous request was declined.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Request Rejected
            </CardTitle>
            <CardDescription>
              Your request to join {existingRequest.gymName} was not approved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You can submit a new request to join a different gym, or try again with the same gym.
            </p>
            <Button onClick={() => queryClient.setQueryData(["/api/join-requests/my"], null)} data-testid="button-new-request">
              Submit New Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold font-display text-foreground">Join a Gym</h2>
        <p className="text-muted-foreground mt-1">Enter a gym code to request access.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Request to Join
          </CardTitle>
          <CardDescription>
            Enter the gym code provided by your gym owner to request access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="gymCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gym Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter gym code (e.g., DEMO01)" 
                        {...field} 
                        className="uppercase font-mono"
                        data-testid="input-gym-code" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={submitMutation.isPending} data-testid="button-submit-request">
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Request to Join
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
