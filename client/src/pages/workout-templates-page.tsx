import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Plus, Loader2, Trash2, Copy, FileText, Dumbbell, Users, Calendar, Search, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { format, addMonths } from "date-fns";

type WorkoutTemplate = {
  id: number;
  gymId: number;
  trainerId: number;
  name: string;
  description: string | null;
  daysPerCycle: number;
  dayLabels: string[] | null;
  isActive: boolean;
  createdAt: string;
};

type WorkoutTemplateItem = {
  id: number;
  templateId: number;
  dayIndex: number;
  muscleType: string;
  bodyPart: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: string | null;
  orderIndex: number;
};

type TemplateWithItems = WorkoutTemplate & { items: WorkoutTemplateItem[] };

type MemberInfo = { id: number; username: string; publicId: string };

const MUSCLE_TYPES = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Hamstrings", "Calves", "Cardio", "Rest"];
const BODY_PARTS = ["Upper Body", "Lower Body", "Core", "Full Body"];

export default function WorkoutTemplatesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithItems | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    daysPerCycle: 3,
    dayLabels: ["Day 1", "Day 2", "Day 3"],
    items: [] as { dayIndex: number; muscleType: string; bodyPart: string; exerciseName: string; sets: number; reps: number; weight: string }[]
  });

  const [assignData, setAssignData] = useState({
    memberId: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: format(addMonths(new Date(), 1), "yyyy-MM-dd")
  });
  const [memberSearch, setMemberSearch] = useState("");

  const { data: templates = [], isLoading } = useQuery<WorkoutTemplate[]>({
    queryKey: ["/api/trainer/templates"]
  });

  const { data: members = [] } = useQuery<MemberInfo[]>({
    queryKey: ["/api/trainer/members"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/trainer/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/templates"] });
      toast({ title: "Template created successfully" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Failed to create template", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/trainer/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/templates"] });
      toast({ title: "Template deleted" });
    }
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { templateId: number; memberId: number; startDate: string; endDate: string }) => {
      const res = await apiRequest("POST", `/api/trainer/templates/${data.templateId}/assign`, {
        memberId: data.memberId,
        startDate: data.startDate,
        endDate: data.endDate
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trainer/members"] });
      toast({ title: "Template assigned to member" });
      setIsAssignOpen(false);
      setAssignTemplateId(null);
    },
    onError: () => {
      toast({ title: "Failed to assign template", variant: "destructive" });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      daysPerCycle: 3,
      dayLabels: ["Day 1", "Day 2", "Day 3"],
      items: []
    });
  };

  const handleDaysChange = (days: number) => {
    const newLabels = Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
    setFormData({ ...formData, daysPerCycle: days, dayLabels: newLabels, items: formData.items.filter(i => i.dayIndex < days) });
  };

  const addExercise = (dayIndex: number) => {
    setFormData({
      ...formData,
      items: [...formData.items, { dayIndex, muscleType: "Chest", bodyPart: "Upper Body", exerciseName: "", sets: 3, reps: 10, weight: "" }]
    });
  };

  const removeExercise = (index: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const updateExercise = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    (newItems[index] as any)[field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Template name is required", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      name: formData.name,
      description: formData.description || null,
      daysPerCycle: formData.daysPerCycle,
      dayLabels: formData.dayLabels,
      items: formData.items.map((item, idx) => ({ ...item, orderIndex: idx }))
    });
  };

  const handleAssign = () => {
    if (!assignTemplateId || !assignData.memberId) return;
    assignMutation.mutate({
      templateId: assignTemplateId,
      memberId: parseInt(assignData.memberId),
      startDate: assignData.startDate,
      endDate: assignData.endDate
    });
  };

  const viewTemplate = async (id: number) => {
    try {
      const res = await fetch(`/api/trainer/templates/${id}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSelectedTemplate(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Workout Templates</h2>
          <p className="text-sm text-muted-foreground mt-1">Create reusable workout plans and assign them to members.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-template">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Workout Template</DialogTitle>
              <DialogDescription>Build a reusable workout plan that you can assign to multiple members.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., PPL Split"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-template-name"
                  />
                </div>
                <div>
                  <Label htmlFor="days">Days per Cycle</Label>
                  <Select value={String(formData.daysPerCycle)} onValueChange={v => handleDaysChange(parseInt(v))}>
                    <SelectTrigger data-testid="select-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} days</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the workout plan..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  data-testid="input-template-description"
                />
              </div>

              <div className="space-y-4">
                {formData.dayLabels.map((label, dayIdx) => (
                  <Card key={dayIdx}>
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          className="w-40"
                          value={label}
                          onChange={e => {
                            const newLabels = [...formData.dayLabels];
                            newLabels[dayIdx] = e.target.value;
                            setFormData({ ...formData, dayLabels: newLabels });
                          }}
                          data-testid={`input-day-label-${dayIdx}`}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={() => addExercise(dayIdx)} data-testid={`button-add-exercise-${dayIdx}`}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add Exercise
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {formData.items.filter(i => i.dayIndex === dayIdx).map((item, itemIdx) => {
                        const globalIdx = formData.items.findIndex(i => i === item);
                        return (
                          <div key={globalIdx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                            <Input
                              className="flex-1"
                              placeholder="Exercise name"
                              value={item.exerciseName}
                              onChange={e => updateExercise(globalIdx, "exerciseName", e.target.value)}
                              data-testid={`input-exercise-name-${globalIdx}`}
                            />
                            <Select value={item.muscleType} onValueChange={v => updateExercise(globalIdx, "muscleType", v)}>
                              <SelectTrigger className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MUSCLE_TYPES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input
                              className="w-16"
                              type="number"
                              placeholder="Sets"
                              value={item.sets}
                              onChange={e => updateExercise(globalIdx, "sets", parseInt(e.target.value) || 0)}
                              data-testid={`input-sets-${globalIdx}`}
                            />
                            <Input
                              className="w-16"
                              type="number"
                              placeholder="Reps"
                              value={item.reps}
                              onChange={e => updateExercise(globalIdx, "reps", parseInt(e.target.value) || 0)}
                              data-testid={`input-reps-${globalIdx}`}
                            />
                            <Input
                              className="w-20"
                              placeholder="Weight"
                              value={item.weight}
                              onChange={e => updateExercise(globalIdx, "weight", e.target.value)}
                              data-testid={`input-weight-${globalIdx}`}
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeExercise(globalIdx)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                      {formData.items.filter(i => i.dayIndex === dayIdx).length === 0 && (
                        <p className="text-muted-foreground text-sm py-2">No exercises added yet.</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-template">
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Template
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isAssignOpen} onOpenChange={(open) => { setIsAssignOpen(open); if (!open) setMemberSearch(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Template to Member</DialogTitle>
            <DialogDescription>Select a member and set the workout cycle dates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Member</Label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="pl-9 pr-9"
                  data-testid="input-search-assign-member"
                />
                {memberSearch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setMemberSearch("")}
                    data-testid="button-clear-assign-member-search"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <Select value={assignData.memberId} onValueChange={v => setAssignData({ ...assignData, memberId: v })}>
                <SelectTrigger data-testid="select-member">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {members.filter(m => m.username.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">No members found</div>
                  ) : (
                    members.filter(m => m.username.toLowerCase().includes(memberSearch.toLowerCase())).map(m => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.username} ({m.publicId})</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={assignData.startDate}
                  onChange={e => setAssignData({ ...assignData, startDate: e.target.value })}
                  data-testid="input-start-date"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={assignData.endDate}
                  onChange={e => setAssignData({ ...assignData, endDate: e.target.value })}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <Button className="w-full" onClick={handleAssign} disabled={assignMutation.isPending || !assignData.memberId} data-testid="button-confirm-assign">
              {assignMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Assign Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>{selectedTemplate?.description || "No description"}</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              {Array.from({ length: selectedTemplate.daysPerCycle }).map((_, dayIdx) => {
                const dayItems = selectedTemplate.items.filter(i => i.dayIndex === dayIdx);
                return (
                  <Card key={dayIdx}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-base">{selectedTemplate.dayLabels?.[dayIdx] || `Day ${dayIdx + 1}`}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dayItems.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No exercises</p>
                      ) : (
                        <div className="space-y-1">
                          {dayItems.map(item => (
                            <div key={item.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                              <span className="font-medium">{item.exerciseName}</span>
                              <span className="text-muted-foreground">{item.muscleType} - {item.sets}x{item.reps} {item.weight && `@ ${item.weight}`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Templates Yet</h3>
            <p className="text-muted-foreground mb-4">Create your first workout template to get started.</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-template">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(template => (
            <Card key={template.id} data-testid={`template-card-${template.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-primary" />
                  {template.name}
                </CardTitle>
                <CardDescription>{template.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {template.daysPerCycle} days
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => viewTemplate(template.id)} data-testid={`button-view-${template.id}`}>
                    View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setAssignTemplateId(template.id); setIsAssignOpen(true); }} data-testid={`button-assign-${template.id}`}>
                    <Users className="w-4 h-4 mr-1" />
                    Assign
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(template.id)} data-testid={`button-delete-${template.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
