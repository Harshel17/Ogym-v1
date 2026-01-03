import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2, Loader2, Clock, CheckCircle2, XCircle, Send } from "lucide-react";

type GymRequest = {
  id: number;
  gymName: string;
  phone: string | null;
  address: string | null;
  pointOfContactName: string | null;
  pointOfContactEmail: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

const formSchema = z.object({
  gymName: z.string().min(2, "Gym name must be at least 2 characters"),
  phone: z.string().optional(),
  address: z.string().optional(),
  pointOfContactName: z.string().optional(),
  pointOfContactEmail: z.string().email().optional().or(z.literal(""))
});

export default function GymRequestPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: existingRequest, isLoading } = useQuery<GymRequest | null>({
    queryKey: ["/api/gym-requests/my"]
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gymName: "",
      phone: "",
      address: "",
      pointOfContactName: "",
      pointOfContactEmail: ""
    }
  });

  const submitMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/gym-requests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gym-requests/my"] });
      toast({ title: "Gym request submitted successfully" });
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
        <h2 className="text-2xl font-bold">You already have a gym</h2>
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
          <h2 className="text-3xl font-bold font-display text-foreground">Gym Request</h2>
          <p className="text-muted-foreground mt-1">Your gym request is being reviewed.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Request Pending
            </CardTitle>
            <CardDescription>
              Your gym request has been submitted and is awaiting approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gym Name</span>
              <span className="font-medium">{existingRequest.gymName}</span>
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
          <h2 className="text-3xl font-bold font-display text-foreground">Gym Request</h2>
          <p className="text-muted-foreground mt-1">Your previous request was declined.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Request Rejected
            </CardTitle>
            <CardDescription>
              Your gym request for "{existingRequest.gymName}" was not approved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingRequest.adminNotes && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">Reason: {existingRequest.adminNotes}</p>
              </div>
            )}
            <Button onClick={() => queryClient.setQueryData<GymRequest | null>(["/api/gym-requests/my"], null)} data-testid="button-new-request">
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
        <h2 className="text-3xl font-bold font-display text-foreground">Register Your Gym</h2>
        <p className="text-muted-foreground mt-1">Submit a request to create your gym on our platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Gym Details
          </CardTitle>
          <CardDescription>
            Fill out the form below to register your gym. Your request will be reviewed by our team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="gymName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gym Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter gym name" {...field} data-testid="input-gym-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter gym address" {...field} data-testid="input-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pointOfContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Point of Contact Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} data-testid="input-poc-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pointOfContactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Point of Contact Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="your@email.com" {...field} data-testid="input-poc-email" />
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
                Submit Request
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
