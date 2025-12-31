import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTrainerCycles, useTrainerMembers, useCreateCycle, useAddWorkoutItem, useTrainerActivity } from "@/hooks/use-workouts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Plus, Dumbbell, Activity } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { formatDistanceToNow } from "date-fns";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TrainerWorkoutPage() {
  const { user } = useAuth();
  const { data: members = [], isLoading: membersLoading } = useTrainerMembers();
  const { data: cycles = [], isLoading: cyclesLoading } = useTrainerCycles();
  const { data: activity = [], isLoading: activityLoading } = useTrainerActivity();

  if (user?.role !== "trainer") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">Only trainers can manage workout cycles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold font-display text-foreground">Workout Cycles</h2>
          <p className="text-muted-foreground mt-1">Create and manage workout plans for your members.</p>
        </div>
        <CreateCycleDialog members={members as any[]} />
      </div>

      {cyclesLoading ? (
        <p className="text-muted-foreground">Loading cycles...</p>
      ) : (cycles as any[]).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Dumbbell className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No workout cycles yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Create a cycle for your assigned members.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(cycles as any[]).map((cycle) => {
            const member = (members as any[]).find(m => m.id === cycle.memberId);
            return (
              <Card key={cycle.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle>{cycle.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      For: {member?.username || 'Unknown'} | {cycle.startDate} to {cycle.endDate}
                    </p>
                  </div>
                  <AddWorkoutDialog cycleId={cycle.id} />
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Activity className="w-5 h-5" />
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <p className="text-muted-foreground">Loading activity...</p>
          ) : (activity as any[]).length === 0 ? (
            <p className="text-muted-foreground">No recent activity from your members.</p>
          ) : (
            <div className="space-y-3">
              {(activity as any[]).slice(0, 10).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.memberName}</p>
                    <p className="text-xs text-muted-foreground">
                      Completed {item.exerciseName} - {item.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CreateCycleDialog({ members }: { members: any[] }) {
  const [open, setOpen] = useState(false);
  const createCycleMutation = useCreateCycle();

  const formSchema = z.object({
    memberId: z.coerce.number().min(1, "Select a member"),
    name: z.string().min(1, "Name is required"),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", startDate: "", endDate: "" },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createCycleMutation.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-cycle">
          <Plus className="w-4 h-4 mr-2" /> New Cycle
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create Workout Cycle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="memberId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Member</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger data-testid="select-member">
                        <SelectValue placeholder="Select a member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cycle Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Push-Pull-Legs" {...field} data-testid="input-cycle-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-start-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-end-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createCycleMutation.isPending} data-testid="button-submit-cycle">
                {createCycleMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AddWorkoutDialog({ cycleId }: { cycleId: number }) {
  const [open, setOpen] = useState(false);
  const addWorkoutMutation = useAddWorkoutItem();

  const formSchema = z.object({
    dayOfWeek: z.coerce.number().min(0).max(6),
    exerciseName: z.string().min(1, "Exercise name is required"),
    sets: z.coerce.number().min(1, "At least 1 set"),
    reps: z.coerce.number().min(1, "At least 1 rep"),
    weight: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { exerciseName: "", sets: 3, reps: 10, weight: "" },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    addWorkoutMutation.mutate({ ...data, cycleId }, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-add-workout-${cycleId}`}>
          <Plus className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="dayOfWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Day</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger data-testid="select-day">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {days.map((day, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="exerciseName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exercise</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Bench Press" {...field} data-testid="input-exercise" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-2">
              <FormField
                control={form.control}
                name="sets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sets</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-sets" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reps</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-reps" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight</FormLabel>
                    <FormControl>
                      <Input placeholder="10kg" {...field} data-testid="input-weight" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addWorkoutMutation.isPending} data-testid="button-submit-workout">
                {addWorkoutMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
