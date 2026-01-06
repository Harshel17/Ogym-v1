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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2, Clock, CheckCircle2, XCircle, Send } from "lucide-react";

type GymRequest = {
  id: number;
  gymName: string;
  phone: string | null;
  address: string | null;
  pointOfContactName: string | null;
  pointOfContactEmail: string | null;
  city: string;
  state: string;
  country: string;
  gymSize: string;
  trainerCount: number;
  preferredStart: string;
  referralSource: string;
  referralOtherText: string | null;
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
  pointOfContactEmail: z.string().email().optional().or(z.literal("")),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  gymSize: z.enum(["0-50", "51-150", "151-300", "300+"], {
    errorMap: () => ({ message: "Please select gym size" })
  }),
  trainerCount: z.coerce.number().int().min(0, "Must be 0 or greater"),
  preferredStart: z.enum(["immediately", "next_week", "next_month"], {
    errorMap: () => ({ message: "Please select when you want to start" })
  }),
  referralSource: z.enum(["friend", "instagram", "direct_visit", "other"], {
    errorMap: () => ({ message: "Please select how you heard about us" })
  }),
  referralOtherText: z.string().optional(),
}).refine((data) => {
  if (data.referralSource === "other") {
    return data.referralOtherText && data.referralOtherText.trim().length > 0;
  }
  return true;
}, {
  message: "Please specify how you heard about us",
  path: ["referralOtherText"],
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
      pointOfContactEmail: "",
      city: "",
      state: "",
      country: "India",
      gymSize: undefined,
      trainerCount: 0,
      preferredStart: undefined,
      referralSource: undefined,
      referralOtherText: ""
    }
  });

  const referralSource = form.watch("referralSource");

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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter city" {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter state" {...field} data-testid="input-state" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter country" {...field} data-testid="input-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gymSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gym Size (Approximate Members) *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-gym-size">
                            <SelectValue placeholder="Select gym size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0-50">0-50 members</SelectItem>
                          <SelectItem value="51-150">51-150 members</SelectItem>
                          <SelectItem value="151-300">151-300 members</SelectItem>
                          <SelectItem value="300+">300+ members</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trainerCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Trainers *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={0} 
                          placeholder="Enter number of trainers" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                          data-testid="input-trainer-count" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="preferredStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>When do you want to start using OGym? *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-preferred-start">
                          <SelectValue placeholder="Select preferred start time" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="immediately">Immediately</SelectItem>
                        <SelectItem value="next_week">Next week</SelectItem>
                        <SelectItem value="next_month">Next month</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="referralSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How did you hear about OGym? *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-referral-source">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="friend">Friend</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="direct_visit">Direct visit</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {referralSource === "other" && (
                <FormField
                  control={form.control}
                  name="referralOtherText"
                  render={({ field }) => (
                    <FormItem className="animate-in fade-in zoom-in-95 duration-200">
                      <FormLabel>Other (please specify) *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Please specify how you heard about us" 
                          {...field} 
                          data-testid="input-referral-other" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="pt-2">
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
              </div>
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
