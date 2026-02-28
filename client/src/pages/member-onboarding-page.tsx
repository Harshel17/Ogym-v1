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
import { Dumbbell, User, Target, Ruler, ArrowRight, Loader2, CheckCircle2, ChevronDown, ChevronUp, Flame, Heart, Scale, Activity } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const COUNTRY_CODES = [
  { code: "+91", country: "IN", flag: "🇮🇳", label: "India" },
  { code: "+1", country: "US", flag: "🇺🇸", label: "United States" },
  { code: "+44", country: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { code: "+61", country: "AU", flag: "🇦🇺", label: "Australia" },
  { code: "+971", country: "AE", flag: "🇦🇪", label: "UAE" },
  { code: "+966", country: "SA", flag: "🇸🇦", label: "Saudi Arabia" },
  { code: "+65", country: "SG", flag: "🇸🇬", label: "Singapore" },
  { code: "+60", country: "MY", flag: "🇲🇾", label: "Malaysia" },
  { code: "+49", country: "DE", flag: "🇩🇪", label: "Germany" },
  { code: "+33", country: "FR", flag: "🇫🇷", label: "France" },
  { code: "+81", country: "JP", flag: "🇯🇵", label: "Japan" },
  { code: "+86", country: "CN", flag: "🇨🇳", label: "China" },
  { code: "+82", country: "KR", flag: "🇰🇷", label: "South Korea" },
  { code: "+55", country: "BR", flag: "🇧🇷", label: "Brazil" },
  { code: "+27", country: "ZA", flag: "🇿🇦", label: "South Africa" },
  { code: "+234", country: "NG", flag: "🇳🇬", label: "Nigeria" },
  { code: "+254", country: "KE", flag: "🇰🇪", label: "Kenya" },
  { code: "+63", country: "PH", flag: "🇵🇭", label: "Philippines" },
  { code: "+62", country: "ID", flag: "🇮🇩", label: "Indonesia" },
  { code: "+7", country: "RU", flag: "🇷🇺", label: "Russia" },
] as const;

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string()
    .min(1, "Phone number is required")
    .refine(
      (val) => {
        const digits = val.replace(/[^0-9]/g, "");
        return digits.length >= 7 && digits.length <= 15;
      },
      "Enter a valid phone number (7-15 digits)"
    ),
  gender: z.enum(["male", "female", "prefer_not_to_say"], {
    required_error: "Please select your gender",
  }),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  address: z.string().optional(),
});

const goalsSchema = z.object({
  primaryGoal: z.enum(["lose_fat", "build_muscle", "maintain", "improve_endurance", "general_health"], {
    required_error: "Please select a goal",
  }),
  targetWeight: z.string().optional(),
  targetWeightUnit: z.enum(["kg", "lbs"]).default("kg"),
  weeklyWorkoutDays: z.number().min(1).max(7).optional(),
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
type GoalsFormData = z.infer<typeof goalsSchema>;
type BodyFormData = z.infer<typeof bodyMeasurementSchema>;

type StepType = "profile" | "goals" | "body";

const PRIMARY_GOALS = [
  { value: "lose_fat", label: "Lose Fat", icon: Flame, color: "text-orange-500" },
  { value: "build_muscle", label: "Build Muscle", icon: Dumbbell, color: "text-blue-500" },
  { value: "maintain", label: "Stay Fit", icon: Scale, color: "text-emerald-500" },
  { value: "improve_endurance", label: "Build Endurance", icon: Activity, color: "text-purple-500" },
  { value: "general_health", label: "General Health", icon: Heart, color: "text-rose-500" },
] as const;

const STEPS: { key: StepType; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "goals", label: "Goals" },
  { key: "body", label: "Body" },
];

export default function MemberOnboardingPage() {
  const [step, setStep] = useState<StepType>("profile");
  const [showExtraMeasurements, setShowExtraMeasurements] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
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

  const goalsForm = useForm<GoalsFormData>({
    resolver: zodResolver(goalsSchema),
    defaultValues: {
      primaryGoal: undefined,
      targetWeight: "",
      targetWeightUnit: "kg",
      weeklyWorkoutDays: undefined,
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
      setStep("goals");
      toast({ title: "Profile saved", description: "Now let's set your fitness goals." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const goalsMutation = useMutation({
    mutationFn: async (data: GoalsFormData) => {
      const res = await apiRequest("PUT", "/api/user/goals", {
        primaryGoal: data.primaryGoal,
        targetWeight: data.targetWeight || null,
        targetWeightUnit: data.targetWeightUnit,
        weeklyWorkoutDays: data.weeklyWorkoutDays || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setStep("body");
      toast({ title: "Goals saved", description: "Last step - your body measurements." });
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
    const fullPhone = `${countryCode} ${data.phone.replace(/^0+/, "")}`;
    profileMutation.mutate({ ...data, phone: fullPhone });
  };

  const handleGoalsSubmit = (data: GoalsFormData) => {
    goalsMutation.mutate(data);
  };

  const handleSkipGoals = () => {
    setStep("body");
  };

  const handleBodySubmit = (data: BodyFormData) => {
    bodyMutation.mutate(data);
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

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
          <h1 className="text-2xl font-bold" data-testid="text-onboarding-title">Welcome! Let's get you set up</h1>
          <p className="text-muted-foreground mt-2">Complete your profile to get started</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6" data-testid="stepper-member">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${i <= currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />}
              <div className="flex items-center gap-1.5">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  i < currentStepIndex
                    ? 'bg-emerald-500 text-white'
                    : i === currentStepIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {i < currentStepIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`text-xs font-medium ${i === currentStepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {step === "profile" && (
          <Card data-testid="card-profile-step">
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
                        <div className="flex gap-2">
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                              className="flex items-center gap-1.5 h-10 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors min-w-[90px]"
                              data-testid="button-country-code"
                            >
                              <span>{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                              <span className="font-medium">{countryCode}</span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
                            </button>
                            {countryDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setCountryDropdownOpen(false)} />
                                <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl max-h-52 overflow-y-auto w-56" data-testid="dropdown-country-codes">
                                  {COUNTRY_CODES.map((c) => (
                                    <button
                                      key={c.code}
                                      type="button"
                                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent transition-colors text-left ${countryCode === c.code ? 'bg-accent font-medium' : ''}`}
                                      onClick={() => { setCountryCode(c.code); setCountryDropdownOpen(false); }}
                                      data-testid={`option-country-${c.country}`}
                                    >
                                      <span>{c.flag}</span>
                                      <span className="flex-1">{c.label}</span>
                                      <span className="text-muted-foreground">{c.code}</span>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="98765 43210"
                              className="flex-1"
                              data-testid="input-phone"
                              {...field}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9\s-]/g, "");
                                field.onChange(val);
                              }}
                            />
                          </FormControl>
                        </div>
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
                    Next: Set Your Goals
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === "goals" && (
          <Card data-testid="card-goals-step">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Your Fitness Goal</CardTitle>
                  <CardDescription>This powers smarter AI recommendations for you</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...goalsForm}>
                <form onSubmit={goalsForm.handleSubmit(handleGoalsSubmit)} className="space-y-4">
                  <FormField
                    control={goalsForm.control}
                    name="primaryGoal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>What's your main goal?</FormLabel>
                        <div className="grid grid-cols-1 gap-2">
                          {PRIMARY_GOALS.map((goal) => {
                            const GoalIcon = goal.icon;
                            return (
                              <button
                                key={goal.value}
                                type="button"
                                onClick={() => field.onChange(goal.value)}
                                className={`flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-all ${
                                  field.value === goal.value
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                                }`}
                                data-testid={`goal-option-${goal.value}`}
                              >
                                <GoalIcon className={`h-5 w-5 ${goal.color}`} />
                                <span className="font-medium">{goal.label}</span>
                                {field.value === goal.value && (
                                  <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={goalsForm.control}
                      name="targetWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Weight <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="70" 
                              data-testid="input-target-weight"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={goalsForm.control}
                      name="weeklyWorkoutDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Workouts / Week <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                          <Select 
                            onValueChange={(v) => field.onChange(v ? Number(v) : undefined)} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-workout-days">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {[1,2,3,4,5,6,7].map(n => (
                                <SelectItem key={n} value={n.toString()}>{n} day{n > 1 ? 's' : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button 
                      type="button"
                      variant="outline"
                      className="flex-1" 
                      onClick={handleSkipGoals}
                      data-testid="button-skip-goals"
                    >
                      Skip for Now
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1" 
                      disabled={goalsMutation.isPending}
                      data-testid="button-next-body"
                    >
                      {goalsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      Next: Body
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {step === "body" && (
          <Card data-testid="card-body-step">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ruler className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Body Measurements</CardTitle>
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
                          <FormLabel>Height (cm) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="170" 
                              data-testid="input-height"
                              {...field}
                              value={field.value ?? ""}
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
                          <FormLabel>Weight (kg) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="70" 
                              data-testid="input-weight"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowExtraMeasurements(!showExtraMeasurements)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-1"
                    data-testid="button-toggle-extra-measurements"
                  >
                    {showExtraMeasurements ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showExtraMeasurements ? "Hide" : "Show"} additional measurements (optional)
                  </button>

                  {showExtraMeasurements && (
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
                                value={field.value ?? ""}
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
                                value={field.value ?? ""}
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
                                value={field.value ?? ""}
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
                                value={field.value ?? ""}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

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
