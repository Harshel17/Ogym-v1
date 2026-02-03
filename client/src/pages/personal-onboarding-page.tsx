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
          <h1 className="text-xl font-bold">Welcome to Personal Mode!</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your workouts freely, on your own terms</p>
        </div>

        <Card>
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

                <p className="text-xs text-muted-foreground">Additional measurements (for detailed tracking):</p>

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

                <div className="flex gap-3 pt-1">
                  <Button 
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1" 
                    onClick={handleSkip}
                    disabled={skipMutation.isPending || bodyMutation.isPending}
                    data-testid="button-skip-onboarding"
                  >
                    {skipMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <SkipForward className="h-3 w-3 mr-1" />
                    )}
                    Skip
                  </Button>
                  <Button 
                    type="submit" 
                    size="sm"
                    className="flex-1" 
                    disabled={bodyMutation.isPending || skipMutation.isPending}
                    data-testid="button-save-measurements"
                  >
                    {bodyMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    )}
                    Save & Continue
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  You can always update these later in My Body
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
