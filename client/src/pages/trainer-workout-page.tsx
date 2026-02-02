import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTrainerCycles, useTrainerMembers, useCreateCycle, useAddWorkoutItem, useTrainerActivity, useUpdateDayLabels, useUpdateRestDays, useWorkoutPlanSets, useUpdateWorkoutPlanSets, type WorkoutPlanSet } from "@/hooks/use-workouts";
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
import { Shield, Plus, Dumbbell, Activity, Calendar, ChevronRight, User, Pencil, Trash2, Search, X, Moon, Settings2, PlusCircle, MinusCircle, Layers, Timer, Route } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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


type ActivePhase = {
  id: number;
  memberId: number;
  name: string;
  useCustomExercises: boolean;
  startDate: string;
  endDate: string;
  dayLabels?: string[];
  restDays?: number[];
};

export default function TrainerWorkoutPage() {
  const { user } = useAuth();
  const { data: members = [], isLoading: membersLoading } = useTrainerMembers();
  const { data: cycles = [], isLoading: cyclesLoading } = useTrainerCycles();
  const { data: activity = [], isLoading: activityLoading } = useTrainerActivity();
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [cycleSearch, setCycleSearch] = useState("");
  const detailViewRef = useRef<HTMLDivElement>(null);
  
  const { data: activePhases = [] } = useQuery<ActivePhase[]>({
    queryKey: ["/api/trainer/active-phases"],
    queryFn: async () => {
      const res = await fetch("/api/trainer/active-phases", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  
  const memberActivePhaseMap = new Map<number, ActivePhase>();
  (activePhases as ActivePhase[]).forEach(phase => {
    if (phase.useCustomExercises) {
      memberActivePhaseMap.set(phase.memberId, phase);
    }
  });

  useEffect(() => {
    if (selectedCycleId && detailViewRef.current) {
      detailViewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedCycleId]);

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
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by member or cycle name..."
              value={cycleSearch}
              onChange={e => setCycleSearch(e.target.value)}
              className="pl-9 pr-9"
              data-testid="input-search-cycles"
            />
            {cycleSearch && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setCycleSearch("")}
                data-testid="button-clear-cycle-search"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>

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
          ) : (() => {
            const filteredCycles = (cycles as any[]).filter(cycle => {
              const member = (members as any[]).find(m => m.id === cycle.memberId);
              const memberName = member?.username?.toLowerCase() || '';
              const cycleName = cycle.name?.toLowerCase() || '';
              const search = cycleSearch.toLowerCase();
              return memberName.includes(search) || cycleName.includes(search);
            });
            
            if (filteredCycles.length === 0 && cycleSearch) {
              return (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No cycles found matching "{cycleSearch}"</p>
                </div>
              );
            }
            
            return (
              <div className="space-y-2">
                {filteredCycles.map((cycle) => {
                  const member = (members as any[]).find(m => m.id === cycle.memberId);
                  const isSelected = selectedCycleId === cycle.id;
                  const activePhase = memberActivePhaseMap.get(cycle.memberId);
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate" data-testid={`text-cycle-name-${cycle.id}`}>
                              {cycle.name}
                            </p>
                            {activePhase && (
                              <Badge variant="secondary" className="text-xs">
                                Phase Active
                              </Badge>
                            )}
                          </div>
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
            );
          })()}
        </div>

        <div ref={detailViewRef} className="lg:col-span-2 scroll-mt-4">
          {selectedCycle ? (
            <CycleDetailView 
              cycle={selectedCycle} 
              members={members as any[]} 
              activePhase={memberActivePhaseMap.get(selectedCycle.memberId)}
            />
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

function PhaseExerciseView({ phase, exercises, isLoading }: { phase: ActivePhase; exercises: any[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }
  
  const dayLabels = phase.dayLabels || [];
  const restDays = phase.restDays || [];
  
  const exercisesByDay = exercises.reduce((acc: Record<number, any[]>, ex) => {
    const dayIndex = ex.dayIndex ?? 0;
    if (!acc[dayIndex]) acc[dayIndex] = [];
    acc[dayIndex].push(ex);
    return acc;
  }, {});
  
  const maxDayFromExercises = exercises.length > 0 ? Math.max(...exercises.map(e => e.dayIndex ?? 0)) : -1;
  const maxDayFromLabels = dayLabels.length - 1;
  const maxDayFromRest = restDays.length > 0 ? Math.max(...restDays) : -1;
  const phaseLength = Math.max(maxDayFromExercises, maxDayFromLabels, maxDayFromRest, 0) + 1;
  
  const allDays = Array.from({ length: Math.max(phaseLength, 1) }, (_, i) => i);
  
  if (exercises.length === 0 && restDays.length === 0) {
    return (
      <div className="text-center py-8 bg-muted/30 rounded-lg">
        <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">No phase exercises defined yet.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
        <div className="flex items-center gap-2 flex-wrap">
          <Layers className="w-4 h-4" />
          <span className="font-medium">{phase.name}</span>
          <Badge variant="outline" className="text-xs">
            {phase.startDate} to {phase.endDate}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {exercises.length} exercises
          </Badge>
        </div>
      </div>
      
      <Tabs defaultValue="0" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {allDays.map((dayIndex) => {
            const isRestDay = restDays.includes(dayIndex);
            const label = dayLabels[dayIndex] || `Day ${dayIndex + 1}`;
            const exerciseCount = exercisesByDay[dayIndex]?.length || 0;
            return (
              <TabsTrigger 
                key={dayIndex} 
                value={dayIndex.toString()}
                className="flex-1 min-w-[50px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                data-testid={`tab-phase-day-${dayIndex}`}
              >
                {isRestDay && <Moon className="w-3 h-3 mr-1" />}
                <span className="text-xs">{label.substring(0, 10) || `D${dayIndex + 1}`}</span>
                {!isRestDay && exerciseCount > 0 && (
                  <span className="ml-1 text-[10px] opacity-70">({exerciseCount})</span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
        
        {allDays.map((dayIndex) => {
          const dayExercises = exercisesByDay[dayIndex] || [];
          const isRestDay = restDays.includes(dayIndex);
          const label = dayLabels[dayIndex] || `Day ${dayIndex + 1}`;
          
          return (
            <TabsContent key={dayIndex} value={dayIndex.toString()} className="mt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">{label}</h4>
                  {isRestDay && <Badge variant="secondary"><Moon className="w-3 h-3 mr-1" />Rest Day</Badge>}
                </div>
                
                {isRestDay ? (
                  <div className="py-6 text-center text-muted-foreground bg-muted/30 rounded-lg">
                    <Moon className="w-6 h-6 mx-auto mb-2" />
                    <p>Rest day - No exercises</p>
                  </div>
                ) : dayExercises.length === 0 ? (
                  <div className="py-6 text-center text-muted-foreground bg-muted/30 rounded-lg">
                    <Dumbbell className="w-6 h-6 mx-auto mb-2" />
                    <p>No exercises for this day</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayExercises.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0)).map((ex, idx) => (
                      <div
                        key={ex.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                        data-testid={`phase-exercise-${ex.id}`}
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{ex.exerciseName}</span>
                            {ex.muscleGroup && (
                              <Badge variant="outline" className="text-xs">{ex.muscleGroup}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {ex.sets} sets x {ex.reps} reps
                            {ex.weight && ` @ ${ex.weight}kg`}
                            {ex.category && ` - ${ex.category}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function CycleDetailView({ cycle, members, activePhase }: { cycle: any; members: any[]; activePhase?: ActivePhase }) {
  const member = members.find(m => m.id === cycle.memberId);
  const updateLabelsMutation = useUpdateDayLabels();
  const updateRestDaysMutation = useUpdateRestDays();
  
  const initialCycleLength = cycle.cycleLength || 3;
  const initialLabels = cycle.dayLabels || Array.from({ length: initialCycleLength }, () => "");
  const initialRestDays = cycle.restDays || [];
  const [localCycleLength, setLocalCycleLength] = useState<number>(initialCycleLength);
  const [dayLabels, setDayLabels] = useState<string[]>(initialLabels);
  const [restDays, setRestDays] = useState<number[]>(initialRestDays);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState<"phase" | "cycle">(activePhase ? "phase" : "cycle");
  
  useEffect(() => {
    setViewMode(activePhase ? "phase" : "cycle");
  }, [activePhase?.id]);
  
  const { data: phaseExercises = [], isLoading: phaseLoading } = useQuery<any[]>({
    queryKey: ["/api/trainer/phases", activePhase?.id, "exercises"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/phases/${activePhase?.id}/exercises`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch phase exercises");
      return res.json();
    },
    enabled: !!activePhase && viewMode === "phase",
  });
  
  // Use local state for cycleLength after mutations, fall back to prop
  const cycleLength = localCycleLength;
  
  useEffect(() => {
    setLocalCycleLength(cycle.cycleLength || 3);
    setDayLabels(cycle.dayLabels || Array.from({ length: cycle.cycleLength || 3 }, () => ""));
    setRestDays(cycle.restDays || []);
  }, [cycle.id, cycle.cycleLength, cycle.dayLabels, cycle.restDays]);

  const addDayMutation = useMutation({
    mutationFn: async (data: { cycleId: number; dayLabel?: string; position?: number }) => {
      const res = await apiRequest("POST", `/api/trainer/cycles/${data.cycleId}/add-day`, {
        dayLabel: data.dayLabel || "",
        position: data.position
      });
      return res.json();
    },
    onSuccess: (updatedCycle) => {
      // Update local state immediately with server response
      if (updatedCycle && updatedCycle.cycleLength) {
        setLocalCycleLength(updatedCycle.cycleLength);
      }
      if (updatedCycle && updatedCycle.dayLabels) {
        setDayLabels(updatedCycle.dayLabels);
      }
      if (updatedCycle && updatedCycle.restDays) {
        setRestDays(updatedCycle.restDays);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/cycles", cycle.id, "items"] });
    },
  });

  const removeDayMutation = useMutation({
    mutationFn: async (data: { cycleId: number; dayIndex: number }) => {
      const res = await apiRequest("DELETE", `/api/trainer/cycles/${data.cycleId}/remove-day/${data.dayIndex}`);
      return res.json();
    },
    onSuccess: (updatedCycle) => {
      // Update local state immediately with server response
      if (updatedCycle && updatedCycle.cycleLength) {
        setLocalCycleLength(updatedCycle.cycleLength);
      }
      if (updatedCycle && updatedCycle.dayLabels) {
        setDayLabels(updatedCycle.dayLabels);
      }
      if (updatedCycle && updatedCycle.restDays) {
        setRestDays(updatedCycle.restDays);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/cycles", cycle.id, "items"] });
    },
  });
  
  const toggleRestDay = (dayIndex: number) => {
    const previousRestDays = [...restDays];
    const newRestDays = restDays.includes(dayIndex)
      ? restDays.filter(d => d !== dayIndex)
      : [...restDays, dayIndex];
    setRestDays(newRestDays);
    updateRestDaysMutation.mutate(
      { cycleId: cycle.id, restDays: newRestDays },
      {
        onError: () => {
          setRestDays(previousRestDays);
        }
      }
    );
  };
  
  const { data: items = [], isLoading } = useQuery<WorkoutItem[]>({
    queryKey: ["/api/trainer/cycles", cycle.id, "items"],
    queryFn: async () => {
      const res = await fetch(`/api/trainer/cycles/${cycle.id}/items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async ({ cycleId, itemId }: { cycleId: number; itemId: number }) => {
      await apiRequest("DELETE", `/api/trainer/cycles/${cycleId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/cycles", cycle.id, "items"] });
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
    isRestDay: restDays.includes(idx),
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            data-testid="button-toggle-edit-mode"
          >
            <Settings2 className="w-4 h-4 mr-1" />
            {isEditMode ? "Done" : "Edit"}
          </Button>
          <AddWorkoutDialog cycleId={cycle.id} cycleLength={cycleLength} />
        </div>
      </CardHeader>
      <CardContent>
        {activePhase && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <Button
              variant={viewMode === "phase" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("phase")}
              data-testid="button-view-phase"
            >
              <Layers className="w-4 h-4 mr-1" />
              Phase: {activePhase.name}
            </Button>
            <Button
              variant={viewMode === "cycle" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("cycle")}
              data-testid="button-view-cycle"
            >
              <Dumbbell className="w-4 h-4 mr-1" />
              Cycle
            </Button>
            {viewMode === "phase" && (
              <Badge variant="secondary" className="ml-2">
                Member's active workout
              </Badge>
            )}
          </div>
        )}
        
        {viewMode === "phase" && activePhase ? (
          <PhaseExerciseView 
            phase={activePhase} 
            exercises={phaseExercises} 
            isLoading={phaseLoading}
          />
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : totalExercises === 0 && !isEditMode ? (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No exercises added yet.</p>
            <p className="text-sm text-muted-foreground">Click "Add Exercise" to get started, or "Edit" to manage days.</p>
          </div>
        ) : (
          <Tabs defaultValue={daysWithExercises[0]?.dayIndex.toString() || "0"} className="w-full">
            <div className="flex items-center gap-2 flex-wrap">
              <TabsList className="flex-1 flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                {itemsByDay.map(({ shortLabel, dayIndex, exercises, isRestDay }) => (
                  <TabsTrigger 
                    key={dayIndex} 
                    value={dayIndex.toString()}
                    disabled={exercises.length === 0 && !isRestDay}
                    className="flex-1 min-w-[50px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    data-testid={`tab-day-${dayIndex}`}
                  >
                    {isRestDay && <Moon className="w-3 h-3 mr-1" />}
                    <span className="text-xs">{shortLabel}</span>
                    {exercises.length > 0 && !isRestDay && (
                      <span className="ml-1 text-[10px] opacity-70">({exercises.length})</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              {isEditMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addDayMutation.mutate({ cycleId: cycle.id })}
                  disabled={addDayMutation.isPending}
                  data-testid="button-add-day"
                >
                  <PlusCircle className="w-4 h-4 mr-1" />
                  Add Day
                </Button>
              )}
            </div>
            {itemsByDay.map(({ dayLabel, customLabel, dayIndex, exercises, isRestDay }) => (
              <TabsContent key={dayIndex} value={dayIndex.toString()} className="mt-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
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
                      {isRestDay && <Badge variant="secondary"><Moon className="w-3 h-3 mr-1" />Rest Day</Badge>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Rest Day</span>
                      <Switch
                        checked={isRestDay}
                        onCheckedChange={() => toggleRestDay(dayIndex)}
                        data-testid={`switch-rest-day-${dayIndex}`}
                      />
                      {isEditMode && cycleLength > 1 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="ml-2"
                              data-testid={`button-remove-day-${dayIndex}`}
                            >
                              <MinusCircle className="w-4 h-4 mr-1" />
                              Remove Day
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Day {dayIndex + 1}</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{dayLabel}"? This will delete all exercises on this day. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeDayMutation.mutate({ cycleId: cycle.id, dayIndex })}
                                disabled={removeDayMutation.isPending}
                                className="bg-destructive text-destructive-foreground"
                                data-testid={`button-confirm-remove-day-${dayIndex}`}
                              >
                                {removeDayMutation.isPending ? "Removing..." : "Remove"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive shrink-0"
                                data-testid={`button-delete-exercise-${exercise.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{exercise.exerciseName}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteExerciseMutation.mutate({ cycleId: cycle.id, itemId: exercise.id })}
                                  className="bg-destructive text-destructive-foreground"
                                  data-testid={`button-confirm-delete-exercise-${exercise.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
  const [memberSearch, setMemberSearch] = useState("");
  const createCycleMutation = useCreateCycle();

  const filteredMembers = members.filter(m => 
    m.username.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const formSchema = z.object({
    memberId: z.coerce.number().min(1, "Select a member"),
    name: z.string().min(1, "Name is required"),
    cycleLength: z.coerce.number().min(1).max(7),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    progressionMode: z.enum(["calendar", "completion"]),
    calorieTarget: z.coerce.number().min(500).max(10000).optional().or(z.literal("")),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", cycleLength: 3, startDate: "", endDate: "", progressionMode: "calendar" as const, calorieTarget: "" },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    const submitData = {
      ...data,
      calorieTarget: data.calorieTarget && data.calorieTarget !== "" ? Number(data.calorieTarget) : undefined,
    };
    createCycleMutation.mutate(submitData, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) setMemberSearch(""); }}>
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
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search members..."
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      className="pl-9 pr-9"
                      data-testid="input-search-cycle-member"
                    />
                    {memberSearch && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setMemberSearch("")}
                        data-testid="button-clear-cycle-member-search"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger data-testid="select-member">
                        <SelectValue placeholder="Select a member" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper" className="z-[200] max-h-[200px]">
                      {filteredMembers.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">No members found</div>
                      ) : (
                        filteredMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id.toString()}>
                            {m.username}
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
                    <SelectContent position="popper" className="z-[200]">
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
            <FormField
              control={form.control}
              name="progressionMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Progression Mode</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-progression-mode">
                        <SelectValue placeholder="Select progression mode" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent position="popper" className="z-[200]">
                      <SelectItem value="calendar">Calendar-based (auto-advance daily)</SelectItem>
                      <SelectItem value="completion">Completion-based (advance on workout completion)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {field.value === "completion" 
                      ? "Day advances only when member completes their workout" 
                      : "Day advances automatically based on calendar dates"}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="calorieTarget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Calorie Target (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 2000" 
                      {...field} 
                      value={field.value || ""}
                      data-testid="input-calorie-target" 
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    Set a daily calorie goal for the member's nutrition tracking
                  </p>
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

const muscleTypes = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Glutes", "Full Body", "Cardio", "Rest"];
const bodyParts = ["Upper Body", "Lower Body", "Full Body", "Cardio", "Recovery"];
const cardioExercises = ["Running", "Walking", "Cycling", "Swimming", "Jump Rope", "Rowing", "Elliptical", "Stair Climbing", "HIIT", "Treadmill"];

function AddWorkoutDialog({ cycleId, cycleLength }: { cycleId: number; cycleLength: number }) {
  const [open, setOpen] = useState(false);
  const [sameForAll, setSameForAll] = useState(true);
  const [exerciseType, setExerciseType] = useState<"strength" | "cardio">("strength");
  const [perSetData, setPerSetData] = useState<{ reps: number; weight: string }[]>([]);
  const addWorkoutMutation = useAddWorkoutItem();
  const updatePlanSetsMutation = useUpdateWorkoutPlanSets();
  const queryClient = useQueryClient();

  const formSchema = z.object({
    dayIndex: z.coerce.number().min(0),
    muscleType: z.string().min(1, "Select a muscle type"),
    bodyPart: z.string().min(1, "Select a body part"),
    exerciseName: z.string().min(1, "Exercise name is required"),
    sets: z.coerce.number().min(1, "At least 1 set").max(10, "Max 10 sets"),
    reps: z.coerce.number().min(1, "At least 1 rep"),
    weight: z.string().optional(),
    durationMinutes: z.coerce.number().optional(),
    distanceKm: z.string().optional(),
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
      bodyPart: "Upper Body",
      durationMinutes: 30,
      distanceKm: ""
    },
  });

  const handleExerciseTypeChange = (type: "strength" | "cardio") => {
    setExerciseType(type);
    if (type === "cardio") {
      form.setValue("muscleType", "Cardio");
      form.setValue("bodyPart", "Cardio");
    } else {
      form.setValue("muscleType", "Chest");
      form.setValue("bodyPart", "Upper Body");
    }
  };

  const watchedSets = form.watch("sets");
  const watchedReps = form.watch("reps");
  const watchedWeight = form.watch("weight");

  useEffect(() => {
    const numSets = Number(watchedSets) || 1;
    const currentReps = Number(watchedReps) || 10;
    const currentWeight = watchedWeight || "";
    
    setPerSetData(prev => {
      const newData = [];
      for (let i = 0; i < numSets; i++) {
        newData.push({
          reps: prev[i]?.reps ?? currentReps,
          weight: prev[i]?.weight ?? currentWeight
        });
      }
      return newData;
    });
  }, [watchedSets]);

  useEffect(() => {
    if (sameForAll) {
      const currentReps = Number(watchedReps) || 10;
      const currentWeight = watchedWeight || "";
      setPerSetData(prev => prev.map(() => ({ reps: currentReps, weight: currentWeight })));
    }
  }, [sameForAll, watchedReps, watchedWeight]);

  const updatePerSetReps = (index: number, value: number) => {
    setPerSetData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], reps: value };
      return newData;
    });
  };

  const updatePerSetWeight = (index: number, value: string) => {
    setPerSetData(prev => {
      const newData = [...prev];
      newData[index] = { ...newData[index], weight: value };
      return newData;
    });
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const workoutData = {
      ...data,
      cycleId,
      exerciseType,
      ...(exerciseType === "cardio" ? {
        sets: 1,
        reps: 1,
        weight: undefined,
        durationMinutes: data.durationMinutes || 30,
        distanceKm: data.distanceKm || undefined
      } : {
        durationMinutes: undefined,
        distanceKm: undefined
      })
    };

    addWorkoutMutation.mutate(workoutData, {
      onSuccess: async (response: any) => {
        const newItemId = response?.id;
        
        if (newItemId && exerciseType === "strength" && !sameForAll && perSetData.length > 0) {
          const setsToSave = perSetData.map((set, idx) => ({
            setNumber: idx + 1,
            targetReps: set.reps,
            targetWeight: set.weight || null
          }));
          
          updatePlanSetsMutation.mutate({ 
            cycleId, 
            itemId: newItemId, 
            sets: setsToSave 
          });
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/trainer/cycles", cycleId, "items"] });
        setOpen(false);
        setSameForAll(true);
        setExerciseType("strength");
        setPerSetData([]);
        form.reset({ 
          exerciseName: "", 
          sets: 3, 
          reps: 10, 
          weight: "", 
          dayIndex: data.dayIndex,
          muscleType: "Chest",
          bodyPart: "Upper Body",
          durationMinutes: 30,
          distanceKm: ""
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
      <DialogContent aria-describedby={undefined} className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Exercise to Cycle</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            {/* Exercise Type Toggle */}
            <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={exerciseType === "strength" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => handleExerciseTypeChange("strength")}
                data-testid="button-type-strength"
              >
                <Dumbbell className="w-4 h-4 mr-2" />
                Strength
              </Button>
              <Button
                type="button"
                variant={exerciseType === "cardio" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                onClick={() => handleExerciseTypeChange("cardio")}
                data-testid="button-type-cardio"
              >
                <Activity className="w-4 h-4 mr-2" />
                Cardio
              </Button>
            </div>

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
                    <SelectContent position="popper" className="z-[200]">
                      {dayOptions.map((day) => (
                        <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {exerciseType === "strength" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="muscleType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Muscle Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-muscle-type">
                              <SelectValue placeholder="Select muscle" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper" className="z-[200] max-h-[200px]">
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-body-part">
                              <SelectValue placeholder="Select body part" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper" className="z-[200]">
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
                <FormField
                  control={form.control}
                  name="sets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Sets</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={10} {...field} data-testid="input-sets" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="exerciseName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cardio Exercise</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-cardio-exercise">
                            <SelectValue placeholder="Select cardio exercise" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" className="z-[200]">
                          {cardioExercises.map((ex) => (
                            <SelectItem key={ex} value={ex}>{ex}</SelectItem>
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
                    name="durationMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5" />
                          Duration (minutes)
                        </FormLabel>
                        <FormControl>
                          <Input type="number" min={1} placeholder="30" {...field} data-testid="input-duration" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="distanceKm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Route className="w-3.5 h-3.5" />
                          Distance (optional)
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 5km" {...field} data-testid="input-distance" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {exerciseType === "strength" && (
              <>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Same reps/weight for all sets</span>
                  <Switch 
                    checked={sameForAll} 
                    onCheckedChange={setSameForAll}
                    data-testid="switch-same-for-all"
                  />
                </div>

                {sameForAll ? (
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="reps"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reps (all sets)</FormLabel>
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
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium">
                      <div className="col-span-2">Set</div>
                      <div className="col-span-5">Reps</div>
                      <div className="col-span-5">Weight</div>
                    </div>
                    {Array.from({ length: Number(watchedSets) || 1 }, (_, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-2 text-sm font-medium text-center">
                          {idx + 1}
                        </div>
                        <div className="col-span-5">
                          <Input 
                            type="number" 
                            min={1} 
                            value={perSetData[idx]?.reps || 10}
                            onChange={(e) => updatePerSetReps(idx, parseInt(e.target.value) || 1)}
                            data-testid={`input-set-${idx + 1}-reps`}
                          />
                        </div>
                        <div className="col-span-5">
                          <Input 
                            placeholder="e.g., 50kg"
                            value={perSetData[idx]?.weight || ""}
                            onChange={(e) => updatePerSetWeight(idx, e.target.value)}
                            data-testid={`input-set-${idx + 1}-weight`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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
