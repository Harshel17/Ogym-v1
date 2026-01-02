import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTrainerCycles, useTrainerMembers, useCreateCycle, useAddWorkoutItem, useTrainerActivity, useUpdateDayLabels } from "@/hooks/use-workouts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Shield, Plus, Dumbbell, Activity, Calendar, ChevronRight, User, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { WorkoutItem } from "@shared/schema";


export default function TrainerWorkoutPage() {
  const { user } = useAuth();
  const { data: members = [], isLoading: membersLoading } = useTrainerMembers();
  const { data: cycles = [], isLoading: cyclesLoading } = useTrainerCycles();
  const { data: activity = [], isLoading: activityLoading } = useTrainerActivity();
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);

  const deleteCycleMutation = useMutation({
    mutationFn: async (cycleId: number) => {
      await apiRequest("DELETE", `/api/trainer/cycles/${cycleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/cycles"] });
      setSelectedCycleId(null);
    },
  });

  const isLoading = membersLoading || cyclesLoading;

  if (user?.role !== "trainer") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground">Only trainers can manage workout cycles.</p>
      </div>
    );
  }

  const selectedCycle = (cycles as any[]).find(c => c.id === selectedCycleId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-workouts-title">Workout Cycles</h1>
          <p className="text-muted-foreground">Create and manage workout plans for your members.</p>
        </div>
        <CreateCycleDialog members={members as any[]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Cycles</h3>
          
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (cycles as any[]).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Dumbbell className="w-10 h-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground text-center">No workout cycles yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {(cycles as any[]).map((cycle) => {
                const member = (members as any[]).find(m => m.id === cycle.memberId);
                const isSelected = selectedCycleId === cycle.id;
                return (
                  <Card 
                    key={cycle.id} 
                    className={`cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : 'hover-elevate'}`}
                    onClick={() => setSelectedCycleId(cycle.id)}
                    data-testid={`card-cycle-${cycle.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate" data-testid={`text-cycle-name-${cycle.id}`}>
                            {cycle.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {member?.username || 'Unknown'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {cycle.startDate} to {cycle.endDate}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                onClick={(e) => e.stopPropagation()}
                                data-testid={`button-delete-cycle-${cycle.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Workout Cycle</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{cycle.name}"? This will remove all exercises in this cycle. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteCycleMutation.mutate(cycle.id);
                                  }}
                                  disabled={deleteCycleMutation.isPending}
                                  className="bg-destructive text-destructive-foreground"
                                  data-testid={`button-confirm-delete-cycle-${cycle.id}`}
                                >
                                  {deleteCycleMutation.isPending ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {selectedCycle ? (
            <CycleDetailView cycle={selectedCycle} members={members as any[]} />
          ) : (
            <Card className="h-full min-h-[300px]">
              <CardContent className="flex flex-col items-center justify-center h-full py-12">
                <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">Select a cycle to view and edit exercises</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
            <div className="grid gap-2 sm:grid-cols-2">
              {(activity as any[]).slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.memberName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.exerciseName} - {item.date}
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

function CycleDetailView({ cycle, members }: { cycle: any; members: any[] }) {
  const member = members.find(m => m.id === cycle.memberId);
  const cycleLength = cycle.cycleLength || 3;
  const updateLabelsMutation = useUpdateDayLabels();
  
  const initialLabels = cycle.dayLabels || Array.from({ length: cycleLength }, () => "");
  const [dayLabels, setDayLabels] = useState<string[]>(initialLabels);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  
  useEffect(() => {
    setDayLabels(cycle.dayLabels || Array.from({ length: cycleLength }, () => ""));
  }, [cycle.id, cycle.dayLabels, cycleLength]);
  
  const { data: items = [], isLoading } = useQuery<WorkoutItem[]>({
    queryKey: ["/api/trainer/cycles", cycle.id, "items"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/cycles/${cycle.id}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const saveDayLabel = (dayIndex: number, label: string) => {
    const currentLabel = dayLabels[dayIndex] || "";
    if (label === currentLabel) {
      setEditingDay(null);
      return;
    }
    const newLabels = [...dayLabels];
    newLabels[dayIndex] = label;
    setDayLabels(newLabels);
    updateLabelsMutation.mutate({ cycleId: cycle.id, dayLabels: newLabels });
    setEditingDay(null);
  };

  const itemsByDay = Array.from({ length: cycleLength }, (_, idx) => ({
    dayLabel: dayLabels[idx] || `Day ${idx + 1}`,
    customLabel: dayLabels[idx] || "",
    shortLabel: dayLabels[idx] ? dayLabels[idx].substring(0, 10) : `D${idx + 1}`,
    dayIndex: idx,
    exercises: items.filter(item => item.dayIndex === idx).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
  }));

  const daysWithExercises = itemsByDay.filter(d => d.exercises.length > 0);
  const totalExercises = items.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            {cycle.name}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant="secondary">
              <User className="w-3 h-3 mr-1" />
              {member?.username || 'Unknown'}
            </Badge>
            <Badge variant="outline">
              {totalExercises} exercises
            </Badge>
            <Badge variant="outline">
              {cycleLength}-day cycle
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {cycle.startDate} to {cycle.endDate}
          </p>
        </div>
        <AddWorkoutDialog cycleId={cycle.id} cycleLength={cycleLength} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : totalExercises === 0 ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No exercises added yet.</p>
            <p className="text-sm text-muted-foreground">Click "Add Exercise" to get started.</p>
          </div>
        ) : (
          <Tabs defaultValue={daysWithExercises[0]?.dayIndex.toString() || "0"} className="w-full">
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
              {itemsByDay.map(({ shortLabel, dayIndex, exercises }) => (
                <TabsTrigger 
                  key={dayIndex} 
                  value={dayIndex.toString()}
                  disabled={exercises.length === 0}
                  className="flex-1 min-w-[50px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  data-testid={`tab-day-${dayIndex}`}
                >
                  <span className="text-xs">{shortLabel}</span>
                  {exercises.length > 0 && (
                    <span className="ml-1 text-[10px] opacity-70">({exercises.length})</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            {itemsByDay.map(({ dayLabel, customLabel, dayIndex, exercises }) => (
              <TabsContent key={dayIndex} value={dayIndex.toString()} className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {editingDay === dayIndex ? (
                      <Input
                        autoFocus
                        placeholder={`e.g., Chest + Shoulders`}
                        defaultValue={customLabel}
                        className="h-8 text-sm max-w-[200px]"
                        onBlur={(e) => saveDayLabel(dayIndex, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveDayLabel(dayIndex, (e.target as HTMLInputElement).value);
                          } else if (e.key === 'Escape') {
                            setEditingDay(null);
                          }
                        }}
                        data-testid={`input-day-label-${dayIndex}`}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingDay(dayIndex)}
                        className="font-semibold text-sm flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                        data-testid={`button-edit-day-label-${dayIndex}`}
                      >
                        <span>{dayLabel}</span>
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {exercises.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No exercises for this day.</p>
                  ) : (
                    <div className="space-y-2">
                      {exercises.map((exercise, idx) => (
                        <div 
                          key={exercise.id} 
                          className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                          data-testid={`exercise-item-${exercise.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                              {idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{exercise.exerciseName}</p>
                                {exercise.muscleType && (
                                  <Badge variant="secondary" className="text-xs">{exercise.muscleType}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {exercise.sets} sets x {exercise.reps} reps
                                {exercise.weight && ` @ ${exercise.weight}`}
                                {exercise.bodyPart && ` - ${exercise.bodyPart}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function CreateCycleDialog({ members }: { members: any[] }) {
  const [open, setOpen] = useState(false);
  const createCycleMutation = useCreateCycle();

  const formSchema = z.object({
    memberId: z.coerce.number().min(1, "Select a member"),
    name: z.string().min(1, "Name is required"),
    cycleLength: z.coerce.number().min(1).max(7),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", cycleLength: 3, startDate: "", endDate: "" },
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
              name="cycleLength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cycle Pattern (days)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger data-testid="select-cycle-length">
                        <SelectValue placeholder="Select cycle length" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}-day cycle
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createCycleMutation.isPending} data-testid="button-submit-cycle">
                {createCycleMutation.isPending ? "Creating..." : "Create Cycle"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const muscleTypes = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Full Body"];
const bodyParts = ["Upper Body", "Lower Body", "Full Body"];

function AddWorkoutDialog({ cycleId, cycleLength }: { cycleId: number; cycleLength: number }) {
  const [open, setOpen] = useState(false);
  const addWorkoutMutation = useAddWorkoutItem();
  const queryClient = useQueryClient();

  const formSchema = z.object({
    dayIndex: z.coerce.number().min(0),
    muscleType: z.string().min(1, "Select a muscle type"),
    bodyPart: z.string().min(1, "Select a body part"),
    exerciseName: z.string().min(1, "Exercise name is required"),
    sets: z.coerce.number().min(1, "At least 1 set"),
    reps: z.coerce.number().min(1, "At least 1 rep"),
    weight: z.string().optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      exerciseName: "", 
      sets: 3, 
      reps: 10, 
      weight: "", 
      dayIndex: 0,
      muscleType: "Chest",
      bodyPart: "Upper Body"
    },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    addWorkoutMutation.mutate({ ...data, cycleId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/trainer/cycles", cycleId, "items"] });
        setOpen(false);
        form.reset({ 
          exerciseName: "", 
          sets: 3, 
          reps: 10, 
          weight: "", 
          dayIndex: data.dayIndex,
          muscleType: data.muscleType,
          bodyPart: data.bodyPart
        });
      },
    });
  };

  const dayOptions = Array.from({ length: cycleLength }, (_, i) => ({
    value: i.toString(),
    label: `Day ${i + 1}`
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid={`button-add-workout-${cycleId}`}>
          <Plus className="w-4 h-4 mr-2" /> Add Exercise
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Exercise to Cycle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="dayIndex"
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
                      {dayOptions.map((day) => (
                        <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="muscleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Muscle Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-muscle-type">
                          <SelectValue placeholder="Select muscle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {muscleTypes.map((muscle) => (
                          <SelectItem key={muscle} value={muscle}>{muscle}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bodyPart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body Part</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-body-part">
                          <SelectValue placeholder="Select body part" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bodyParts.map((part) => (
                          <SelectItem key={part} value={part}>{part}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="exerciseName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exercise Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Bench Press, Squats, Deadlift" {...field} data-testid="input-exercise" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="sets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sets</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} data-testid="input-sets" />
                    </FormControl>
                    <FormMessage />
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
                      <Input type="number" min={1} {...field} data-testid="input-reps" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 50kg" {...field} data-testid="input-weight" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addWorkoutMutation.isPending} data-testid="button-submit-workout">
                {addWorkoutMutation.isPending ? "Adding..." : "Add Exercise"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
