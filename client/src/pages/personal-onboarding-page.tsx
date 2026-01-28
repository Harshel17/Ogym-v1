import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dumbbell, Ruler, Loader2, CheckCircle2, SkipForward } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const bodyMeasurementSchema = z.object({
  height: z.number().min(50, "Height must be at least 50 cm").max(300, "Height must be less than 300 cm").optional(),
  weight: z.number().min(20, "Weight must be at least 20 kg").max(500, "Weight must be less than 500 kg").optional(),
  bodyFat: z.number().min(1).max(70).optional(),
  chest: z.number().min(30).max(300).optional(),
  waist: z.number().min(30).max(300).optional(),
  hips: z.number().min(30).max(300).optional(),
});

type BodyFormData = z.infer<typeof bodyMeasurementSchema>;

export default function PersonalOnboardingPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const bodyMutation = useMutation({
    mutationFn: async (data: BodyFormData) => {
      const res = await apiRequest("POST", "/api/body-measurements/initial", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Welcome to OGym!", description: "Your measurements have been saved." });
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

  const handleBodySubmit = (data: BodyFormData) => {
    const hasAnyData = data.height || data.weight || data.bodyFat || data.chest || data.waist || data.hips;
    if (hasAnyData) {
      bodyMutation.mutate(data);
    } else {
      skipMutation.mutate();
    }
  };

  const handleSkip = () => {
    skipMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Dumbbell className="h-10 w-10 text-primary" />
            <span className="text-3xl font-bold">OGym</span>
          </div>
          <h1 className="text-2xl font-bold">Welcome to Personal Mode!</h1>
          <p className="text-muted-foreground mt-2">Track your workouts freely, on your own terms</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Ruler className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Body Measurements</CardTitle>
                <CardDescription>Optional - helps track your progress over time</CardDescription>
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
                        <FormLabel>Weight (kg)</FormLabel>
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

                <p className="text-sm text-muted-foreground">Additional measurements (for detailed tracking):</p>

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

                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button"
                    variant="outline"
                    className="flex-1" 
                    onClick={handleSkip}
                    disabled={skipMutation.isPending || bodyMutation.isPending}
                    data-testid="button-skip-onboarding"
                  >
                    {skipMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <SkipForward className="h-4 w-4 mr-2" />
                    )}
                    Skip for Now
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1" 
                    disabled={bodyMutation.isPending || skipMutation.isPending}
                    data-testid="button-save-measurements"
                  >
                    {bodyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Save & Continue
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground mt-2">
                  You can always add or update these later in My Body
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
