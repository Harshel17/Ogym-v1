import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dumbbell, User, Ruler, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  gender: z.enum(["male", "female", "prefer_not_to_say"], {
    required_error: "Please select your gender",
  }),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  address: z.string().optional(),
});

const bodyMeasurementSchema = z.object({
  height: z.number().min(50, "Height must be at least 50 cm").max(300, "Height must be less than 300 cm"),
  weight: z.number().min(20, "Weight must be at least 20 kg").max(500, "Weight must be less than 500 kg"),
  bodyFat: z.number().min(1).max(70).optional(),
  chest: z.number().min(30).max(300).optional(),
  waist: z.number().min(30).max(300).optional(),
  hips: z.number().min(30).max(300).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;
type BodyFormData = z.infer<typeof bodyMeasurementSchema>;

export default function MemberOnboardingPage() {
  const [step, setStep] = useState<"profile" | "body">("profile");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      gender: undefined,
      dob: "",
      address: "",
    },
  });

  const bodyForm = useForm<BodyFormData>({
    resolver: zodResolver(bodyMeasurementSchema),
    defaultValues: {
      height: undefined,
      weight: undefined,
      bodyFat: undefined,
      chest: undefined,
      waist: undefined,
      hips: undefined,
    },
  });

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const res = await apiRequest("POST", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      setStep("body");
      toast({ title: "Profile saved", description: "Now let's record your body measurements." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const bodyMutation = useMutation({
    mutationFn: async (data: BodyFormData) => {
      const res = await apiRequest("POST", "/api/body-measurements/initial", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Welcome to OGym!", description: "Your profile is complete." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleProfileSubmit = (data: ProfileFormData) => {
    profileMutation.mutate(data);
  };

  const handleBodySubmit = (data: BodyFormData) => {
    bodyMutation.mutate(data);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 bg-background overflow-y-auto"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
    >
      <div className="absolute right-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Dumbbell className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold">OGym</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome! Let's get you set up</h1>
          <p className="text-muted-foreground mt-2">Complete your profile to get started</p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-6">
          <div className={`flex items-center gap-2 ${step === "profile" ? "text-primary" : "text-muted-foreground"}`}>
            {step === "body" ? (
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            ) : (
              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">1</div>
            )}
            <span className="font-medium">Profile</span>
          </div>
          <div className="h-px w-8 bg-muted" />
          <div className={`flex items-center gap-2 ${step === "body" ? "text-primary" : "text-muted-foreground"}`}>
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-sm font-medium ${step === "body" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</div>
            <span className="font-medium">Body</span>
          </div>
        </div>

        {step === "profile" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Tell us about yourself</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" data-testid="input-fullname" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 98765 43210" data-testid="input-phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gender">
                              <SelectValue placeholder="Select your gender" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-dob" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main Street, City" data-testid="input-address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={profileMutation.isPending}
                    data-testid="button-next-step"
                  >
                    {profileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Continue to Body Measurements
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === "body" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ruler className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Initial Body Measurements</CardTitle>
                  <CardDescription>These will help track your progress</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...bodyForm}>
                <form onSubmit={bodyForm.handleSubmit(handleBodySubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={bodyForm.control}
                      name="height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Height (cm)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="170" 
                              data-testid="input-height"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bodyForm.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Weight (kg)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="70" 
                              data-testid="input-weight"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <p className="text-sm text-muted-foreground">Optional measurements (for detailed tracking):</p>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={bodyForm.control}
                      name="bodyFat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Body Fat %</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="15" 
                              data-testid="input-bodyfat"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bodyForm.control}
                      name="chest"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chest (cm)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="95" 
                              data-testid="input-chest"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bodyForm.control}
                      name="waist"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Waist (cm)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="80" 
                              data-testid="input-waist"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={bodyForm.control}
                      name="hips"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hips (cm)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="95" 
                              data-testid="input-hips"
                              {...field}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={bodyMutation.isPending}
                    data-testid="button-complete-onboarding"
                  >
                    {bodyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Complete Setup
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
