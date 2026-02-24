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
import { Dumbbell, User, Target, Ruler, ArrowRight, Loader2, CheckCircle2, SkipForward, ChevronDown, ChevronUp, Flame, Heart, Scale, Activity } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  gender: z.enum(["male", "female", "prefer_not_to_say"], {
    required_error: "Please select your gender",
  }),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter your date of birth"),
  phone: z.string().optional(),
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
  height: z.number().min(50, "Height must be at least 50 cm").max(300, "Height must be less than 300 cm").optional(),
  weight: z.number().min(20, "Weight must be at least 20 kg").max(500, "Weight must be less than 500 kg").optional(),
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

const STEPS: { key: StepType; label: string; icon: typeof User }[] = [
  { key: "profile", label: "About You", icon: User },
  { key: "goals", label: "Goals", icon: Target },
  { key: "body", label: "Body", icon: Ruler },
];

export default function PersonalOnboardingPage() {
  const [step, setStep] = useState<StepType>("profile");
  const [showExtraMeasurements, setShowExtraMeasurements] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: "",
      gender: undefined,
      dob: "",
      phone: "",
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
      const res = await apiRequest("POST", "/api/profile", {
        ...data,
        phone: data.phone || "N/A",
      });
      return res.json();
    },
    onSuccess: () => {
      setStep("goals");
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
      toast({ title: "You're all set!", description: "Welcome to OGym Personal Mode." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/skip");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleProfileSubmit = (data: ProfileFormData) => {
    profileMutation.mutate(data);
  };

  const handleGoalsSubmit = (data: GoalsFormData) => {
    goalsMutation.mutate(data);
  };

  const handleSkipGoals = () => {
    setStep("body");
  };

  const handleBodySubmit = (data: BodyFormData) => {
    const hasAnyData = data.height || data.weight || data.bodyFat || data.chest || data.waist || data.hips;
    if (hasAnyData) {
      bodyMutation.mutate(data);
    } else {
      skipMutation.mutate();
    }
  };

  const handleSkipBody = () => {
    skipMutation.mutate();
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 py-8 bg-background overflow-y-auto"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 32px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}
    >
      <div className="absolute right-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}>
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-lg my-auto">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Dumbbell className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">OGym</span>
          </div>
          <h1 className="text-xl font-bold" data-testid="text-onboarding-title">Welcome to Personal Mode!</h1>
          <p className="text-muted-foreground text-sm mt-1">Let's set you up for success</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6" data-testid="stepper-personal">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-6 ${i <= currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />}
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
                <span className={`text-xs font-medium hidden sm:inline ${i === currentStepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {step === "profile" && (
          <Card data-testid="card-profile-step">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">About You</CardTitle>
                  <CardDescription className="text-xs">This helps us personalize your experience</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-3">
                  <FormField
                    control={profileForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Your Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your name" data-testid="input-fullname" {...field} />
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
                        <FormLabel className="text-sm">Gender</FormLabel>
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
                        <FormLabel className="text-sm">Date of Birth</FormLabel>
                        <FormControl>
                          <Input type="date" data-testid="input-dob" {...field} />
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
                        <FormLabel className="text-sm">Phone <span className="text-muted-foreground">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="+91 98765 43210" data-testid="input-phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={profileMutation.isPending}
                    data-testid="button-next-goals"
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
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Your Fitness Goal</CardTitle>
                  <CardDescription className="text-xs">This powers smarter AI recommendations for you</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Form {...goalsForm}>
                <form onSubmit={goalsForm.handleSubmit(handleGoalsSubmit)} className="space-y-4">
                  <FormField
                    control={goalsForm.control}
                    name="primaryGoal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">What's your main goal?</FormLabel>
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

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={goalsForm.control}
                      name="targetWeight"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Target Weight <span className="text-muted-foreground">(optional)</span></FormLabel>
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
                          <FormLabel className="text-sm">Workouts / Week <span className="text-muted-foreground">(optional)</span></FormLabel>
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
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <Ruler className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Body Measurements</CardTitle>
                  <CardDescription className="text-xs">Optional - helps track your progress over time</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Form {...bodyForm}>
                <form onSubmit={bodyForm.handleSubmit(handleBodySubmit)} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={bodyForm.control}
                      name="height"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Height (cm)</FormLabel>
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
                          <FormLabel className="text-sm">Weight (kg)</FormLabel>
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
                    {showExtraMeasurements ? "Hide" : "Show"} additional measurements
                  </button>

                  {showExtraMeasurements && (
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={bodyForm.control}
                        name="bodyFat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Body Fat %</FormLabel>
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
                            <FormLabel className="text-sm">Chest (cm)</FormLabel>
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
                            <FormLabel className="text-sm">Waist (cm)</FormLabel>
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
                            <FormLabel className="text-sm">Hips (cm)</FormLabel>
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

                  <div className="flex gap-3 pt-1">
                    <Button 
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1" 
                      onClick={handleSkipBody}
                      disabled={skipMutation.isPending || bodyMutation.isPending}
                      data-testid="button-skip-onboarding"
                    >
                      {skipMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <SkipForward className="h-3 w-3 mr-1" />
                      )}
                      Skip for Now
                    </Button>
                    <Button 
                      type="submit" 
                      size="sm"
                      className="flex-1" 
                      disabled={bodyMutation.isPending || skipMutation.isPending}
                      data-testid="button-complete-onboarding"
                    >
                      {bodyMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      Complete Setup
                    </Button>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    You can always update these later in My Body
                  </p>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
