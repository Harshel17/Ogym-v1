import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Utensils, Plus, Shield, Loader2, User, Star } from "lucide-react";

type StarMember = {
  id: number;
  memberId: number;
};

type DietPlan = {
  id: number;
  memberId: number;
  title: string;
  durationWeeks: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function DietPlansPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: starMembers = [] } = useQuery<StarMember[]>({
    queryKey: ["/api/trainer/star-members"]
  });

  const { data: assignedMembers = [] } = useQuery({
    queryKey: ["/api/trainer/members"]
  });

  const { data: dietPlans = [], isLoading } = useQuery<DietPlan[]>({
    queryKey: ["/api/trainer/diet-plans"]
  });

  const form = useForm({
    defaultValues: {
      memberId: "",
      title: "",
      durationWeeks: 4,
      notes: ""
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: { memberId: number; title: string; durationWeeks: number; notes?: string }) => {
      const res = await apiRequest("POST", "/api/trainer/diet-plans", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/diet-plans"] });
      toast({ title: "Diet plan created successfully" });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: error?.message || "Failed to create diet plan", 
        description: "Diet plans can only be created for star members",
        variant: "destructive" 
      });
    }
  });

  if (user?.role !== "trainer") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Trainers Only</h2>
        <p className="text-muted-foreground">This page is only for trainers.</p>
      </div>
    );
  }

  const starMemberIds = new Set(starMembers.map(s => s.memberId));
  const starMembersList = (assignedMembers as any[]).filter(m => starMemberIds.has(m.id));

  const onSubmit = (data: any) => {
    createMutation.mutate({
      memberId: parseInt(data.memberId),
      title: data.title,
      durationWeeks: data.durationWeeks,
      notes: data.notes || undefined
    });
  };

  const getMemberName = (memberId: number) => {
    const member = (assignedMembers as any[]).find(m => m.id === memberId);
    return member?.username || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Diet Plans</h2>
          <p className="text-muted-foreground mt-1">Create and manage diet plans for your star members.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-diet-plan">
              <Plus className="w-4 h-4 mr-2" />
              Create Diet Plan
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Diet Plan</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="memberId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Star Member</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-member">
                            <SelectValue placeholder="Select a star member" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {starMembersList.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground">
                              No star members. Mark members as stars first.
                            </div>
                          ) : (
                            starMembersList.map((m: any) => (
                              <SelectItem key={m.id} value={m.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                  {m.username}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Muscle Building Diet" {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="durationWeeks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (weeks)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={52}
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-duration"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any additional notes..." {...field} data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" disabled={createMutation.isPending || starMembersList.length === 0} data-testid="button-submit-diet-plan">
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Diet Plan
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {starMembersList.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Star className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No Star Members</h3>
            <p className="text-muted-foreground mt-2">
              Mark some members as stars first to create diet plans for them.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/star-members"}>
              Go to Star Members
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : dietPlans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No Diet Plans Yet</h3>
            <p className="text-muted-foreground mt-2">Create your first diet plan for a star member.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dietPlans.map((plan) => (
            <Card key={plan.id} data-testid={`card-diet-plan-${plan.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <User className="w-3 h-3" />
                      {getMemberName(plan.memberId)}
                    </CardDescription>
                  </div>
                  <Badge variant={plan.isActive ? "default" : "secondary"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{plan.durationWeeks} weeks</span>
                </div>
                {plan.notes && (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">{plan.notes}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Created {new Date(plan.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
