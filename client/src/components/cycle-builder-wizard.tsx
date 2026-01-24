import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown,
  ChevronUp,
  Dumbbell, 
  Target, 
  Calendar, 
  Zap, 
  Clock,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  GripVertical,
  CalendarDays,
  ListChecks
} from "lucide-react";
import { format, addDays } from "date-fns";

type Goal = "strength" | "muscle" | "fat_loss" | "general";
type Experience = "beginner" | "intermediate" | "advanced";
type Equipment = "dumbbells" | "barbell" | "machines" | "cables" | "cardio" | "no_equipment";
type TimePerWorkout = "30" | "45" | "60" | "75+";
type SplitPreference = "no_pref" | "full_body" | "upper_lower" | "ppl";

interface QuestionnaireData {
  goal: Goal;
  daysPerWeek: number;
  experience: Experience;
  equipment: Equipment[];
  timePerWorkout: TimePerWorkout;
  splitPreference: SplitPreference;
}

interface ExerciseItem {
  exerciseName: string;
  muscleType: string;
  bodyPart: string;
  sets: number;
  reps: number;
}

interface DayTemplate {
  dayIndex: number;
  label: string;
  items: ExerciseItem[];
}

interface CycleTemplate {
  name: string;
  description: string;
  cycleLength: number;
  days: DayTemplate[];
}

interface CycleBuilderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const goalOptions = [
  { value: "strength", label: "Build Strength", icon: Zap, description: "Lift heavier weights" },
  { value: "muscle", label: "Build Muscle", icon: Dumbbell, description: "Gain size and definition" },
  { value: "fat_loss", label: "Lose Fat", icon: Target, description: "Burn calories and tone up" },
  { value: "general", label: "General Fitness", icon: CheckCircle2, description: "Overall health and wellness" },
];

const experienceOptions = [
  { value: "beginner", label: "Beginner", description: "Less than 1 year training" },
  { value: "intermediate", label: "Intermediate", description: "1-3 years training" },
  { value: "advanced", label: "Advanced", description: "3+ years consistent training" },
];

const equipmentOptions = [
  { value: "dumbbells", label: "Dumbbells" },
  { value: "barbell", label: "Barbell" },
  { value: "machines", label: "Machines" },
  { value: "cables", label: "Cables" },
  { value: "cardio", label: "Cardio Equipment" },
  { value: "no_equipment", label: "No Equipment / Bodyweight" },
];

const splitOptions = [
  { value: "no_pref", label: "No Preference", description: "Let us decide" },
  { value: "full_body", label: "Full Body", description: "Work entire body each session" },
  { value: "upper_lower", label: "Upper/Lower", description: "Alternate upper and lower body" },
  { value: "ppl", label: "Push/Pull/Legs", description: "Classic bodybuilding split" },
];

export function CycleBuilderWizard({ open, onOpenChange }: CycleBuilderWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData>({
    goal: "muscle",
    daysPerWeek: 4,
    experience: "intermediate",
    equipment: ["dumbbells", "barbell"],
    timePerWorkout: "60",
    splitPreference: "no_pref",
  });
  
  const [templates, setTemplates] = useState<CycleTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CycleTemplate | null>(null);
  const [expandedTemplates, setExpandedTemplates] = useState<Set<number>>(new Set());
  const [editableCycle, setEditableCycle] = useState<{
    name: string;
    cycleLength: number;
    days: DayTemplate[];
  } | null>(null);
  
  // Cycle settings state
  const [cycleSettings, setCycleSettings] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
    progressionMode: 'calendar' as 'calendar' | 'completion',
  });

  const toggleTemplateExpand = (idx: number) => {
    setExpandedTemplates(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const suggestMutation = useMutation({
    mutationFn: async (data: QuestionnaireData) => {
      const res = await apiRequest("POST", "/api/personal/suggest-cycle", data);
      return res.json();
    },
    onSuccess: (data: CycleTemplate[]) => {
      setTemplates(data);
      setStep(2);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate templates", variant: "destructive" });
    },
  });

  const createCycleMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      cycleLength: number; 
      days: DayTemplate[];
      startDate: string;
      endDate?: string;
      progressionMode: 'calendar' | 'completion';
    }) => {
      const res = await apiRequest("POST", "/api/personal/cycles/bulk", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/cycles/my"] });
      toast({ title: "Success!", description: "Your workout cycle has been created" });
      onOpenChange(false);
      resetWizard();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create cycle", variant: "destructive" });
    },
  });

  const resetWizard = () => {
    setStep(1);
    setTemplates([]);
    setSelectedTemplate(null);
    setExpandedTemplates(new Set());
    setEditableCycle(null);
    setCycleSettings({
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: '',
      progressionMode: 'calendar',
    });
  };

  const handleEquipmentToggle = (equipment: Equipment) => {
    setQuestionnaire(prev => ({
      ...prev,
      equipment: prev.equipment.includes(equipment)
        ? prev.equipment.filter(e => e !== equipment)
        : [...prev.equipment, equipment],
    }));
  };

  const handleSelectTemplate = (template: CycleTemplate) => {
    setSelectedTemplate(template);
    setEditableCycle({
      name: template.name,
      cycleLength: template.cycleLength,
      days: JSON.parse(JSON.stringify(template.days)),
    });
    setStep(3);
  };

  const handleAddExercise = (dayIndex: number) => {
    if (!editableCycle) return;
    const newExercise: ExerciseItem = {
      exerciseName: "New Exercise",
      muscleType: "Other",
      bodyPart: "Full Body",
      sets: 3,
      reps: 10,
    };
    setEditableCycle(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(day =>
          day.dayIndex === dayIndex
            ? { ...day, items: [...day.items, newExercise] }
            : day
        ),
      };
    });
  };

  const handleRemoveExercise = (dayIndex: number, exerciseIndex: number) => {
    if (!editableCycle) return;
    setEditableCycle(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(day =>
          day.dayIndex === dayIndex
            ? { ...day, items: day.items.filter((_, i) => i !== exerciseIndex) }
            : day
        ),
      };
    });
  };

  const handleUpdateExercise = (dayIndex: number, exerciseIndex: number, field: keyof ExerciseItem, value: string | number) => {
    if (!editableCycle) return;
    setEditableCycle(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map(day =>
          day.dayIndex === dayIndex
            ? {
                ...day,
                items: day.items.map((item, i) =>
                  i === exerciseIndex ? { ...item, [field]: value } : item
                ),
              }
            : day
        ),
      };
    });
  };

  const handleSaveCycle = () => {
    if (!editableCycle) return;
    
    // Calculate end date if not provided (default 4 weeks)
    const endDate = cycleSettings.endDate || format(addDays(new Date(cycleSettings.startDate), 28), 'yyyy-MM-dd');
    
    createCycleMutation.mutate({
      ...editableCycle,
      startDate: cycleSettings.startDate,
      endDate,
      progressionMode: cycleSettings.progressionMode,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetWizard();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            {step === 1 && "Tell us about yourself"}
            {step === 2 && "Choose a template"}
            {step === 3 && "Customize your cycle"}
            {step === 4 && "Cycle settings"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Answer a few questions so we can suggest the perfect workout plan for you."}
            {step === 2 && "Select one of these recommended workout programs."}
            {step === 3 && "Review and customize your workout cycle before saving."}
            {step === 4 && "Set when your cycle starts and how you want to track progress."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>What's your main goal?</Label>
              <div className="grid grid-cols-2 gap-2">
                {goalOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setQuestionnaire(prev => ({ ...prev, goal: option.value as Goal }))}
                    className={`p-3 rounded-md border text-left transition-colors ${
                      questionnaire.goal === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover-elevate"
                    }`}
                    data-testid={`goal-${option.value}`}
                  >
                    <div className="flex items-center gap-2">
                      <option.icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{option.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>How many days per week can you train?</Label>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    variant={questionnaire.daysPerWeek === days ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuestionnaire(prev => ({ ...prev, daysPerWeek: days }))}
                    data-testid={`days-${days}`}
                  >
                    {days}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Experience level?</Label>
              <RadioGroup
                value={questionnaire.experience}
                onValueChange={(v) => setQuestionnaire(prev => ({ ...prev, experience: v as Experience }))}
              >
                {experienceOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={option.value} data-testid={`experience-${option.value}`} />
                    <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-muted-foreground text-sm ml-2">- {option.description}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label>What equipment do you have access to?</Label>
              <div className="grid grid-cols-2 gap-2">
                {equipmentOptions.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={option.value}
                      checked={questionnaire.equipment.includes(option.value as Equipment)}
                      onCheckedChange={() => handleEquipmentToggle(option.value as Equipment)}
                      data-testid={`equipment-${option.value}`}
                    />
                    <Label htmlFor={option.value} className="cursor-pointer text-sm">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Time per workout (minutes)?</Label>
              <div className="flex gap-2 flex-wrap">
                {["30", "45", "60", "75+"].map((time) => (
                  <Button
                    key={time}
                    type="button"
                    variant={questionnaire.timePerWorkout === time ? "default" : "outline"}
                    size="sm"
                    onClick={() => setQuestionnaire(prev => ({ ...prev, timePerWorkout: time as TimePerWorkout }))}
                    data-testid={`time-${time}`}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {time}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Workout split preference?</Label>
              <div className="grid grid-cols-2 gap-2">
                {splitOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setQuestionnaire(prev => ({ ...prev, splitPreference: option.value as SplitPreference }))}
                    className={`p-2 rounded-md border text-left text-sm transition-colors ${
                      questionnaire.splitPreference === option.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover-elevate"
                    }`}
                    data-testid={`split-${option.value}`}
                  >
                    <span className="font-medium">{option.label}</span>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => suggestMutation.mutate(questionnaire)}
                disabled={suggestMutation.isPending || questionnaire.equipment.length === 0}
                data-testid="button-generate-templates"
              >
                {suggestMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    Generate Templates
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Click on a template to preview exercises, then select the one you want to customize.</p>
            
            {templates.map((template, idx) => {
              const isExpanded = expandedTemplates.has(idx);
              return (
                <Card
                  key={idx}
                  className="transition-colors"
                  data-testid={`template-card-${idx}`}
                >
                  <CardHeader 
                    className="pb-2 cursor-pointer hover-elevate rounded-t-lg"
                    onClick={() => toggleTemplateExpand(idx)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                      </div>
                      <Badge variant="secondary">{template.cycleLength} days</Badge>
                    </div>
                    <CardDescription className="ml-6">{template.description}</CardDescription>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="space-y-3 border-t pt-3">
                        {template.days.map((day) => (
                          <div key={day.dayIndex} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-medium">
                                {day.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {day.items.length} exercises
                              </span>
                            </div>
                            <div className="ml-2 text-sm text-muted-foreground">
                              {day.items.map((item, i) => (
                                <span key={i}>
                                  {item.exerciseName}
                                  {i < day.items.length - 1 && " • "}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="mt-4 pt-3 border-t">
                        <Button 
                          className="w-full"
                          onClick={() => handleSelectTemplate(template)}
                          data-testid={`button-select-template-${idx}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Use This Template
                        </Button>
                      </div>
                    </CardContent>
                  )}
                  
                  {!isExpanded && (
                    <CardContent className="pt-0">
                      <div className="flex gap-2 flex-wrap">
                        {template.days.map((day) => (
                          <Badge key={day.dayIndex} variant="outline">
                            {day.label} ({day.items.length})
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back-step1">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        )}

        {step === 3 && editableCycle && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cycle-name">Cycle Name</Label>
              <Input
                id="cycle-name"
                value={editableCycle.name}
                onChange={(e) => setEditableCycle(prev => prev ? { ...prev, name: e.target.value } : prev)}
                data-testid="input-cycle-name-edit"
              />
            </div>

            <div className="space-y-3">
              {editableCycle.days.map((day) => (
                <Card key={day.dayIndex}>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base">Day {day.dayIndex + 1}: {day.label}</CardTitle>
                      <Badge variant="outline">{day.items.length} exercises</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 space-y-2">
                    {day.items.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <Input
                          value={item.exerciseName}
                          onChange={(e) => handleUpdateExercise(day.dayIndex, itemIdx, "exerciseName", e.target.value)}
                          className="flex-1 h-8 text-sm"
                          data-testid={`input-exercise-${day.dayIndex}-${itemIdx}`}
                        />
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={item.sets}
                            onChange={(e) => handleUpdateExercise(day.dayIndex, itemIdx, "sets", parseInt(e.target.value) || 1)}
                            className="w-14 h-8 text-sm text-center"
                            min={1}
                            data-testid={`input-sets-${day.dayIndex}-${itemIdx}`}
                          />
                          <span className="text-muted-foreground text-sm">x</span>
                          <Input
                            type="number"
                            value={item.reps}
                            onChange={(e) => handleUpdateExercise(day.dayIndex, itemIdx, "reps", parseInt(e.target.value) || 1)}
                            className="w-14 h-8 text-sm text-center"
                            min={1}
                            data-testid={`input-reps-${day.dayIndex}-${itemIdx}`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveExercise(day.dayIndex, itemIdx)}
                          data-testid={`button-remove-exercise-${day.dayIndex}-${itemIdx}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddExercise(day.dayIndex)}
                      className="w-full"
                      data-testid={`button-add-exercise-${day.dayIndex}`}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Exercise
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)} data-testid="button-back-step2">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!editableCycle.name.trim()}
                data-testid="button-continue-step4"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && editableCycle && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={cycleSettings.startDate}
                onChange={(e) => setCycleSettings(prev => ({ ...prev, startDate: e.target.value }))}
                data-testid="input-start-date"
              />
              <p className="text-xs text-muted-foreground">When should your workout cycle begin?</p>
            </div>

            <div className="space-y-3">
              <Label>End Date (Optional)</Label>
              <Input
                type="date"
                value={cycleSettings.endDate}
                min={cycleSettings.startDate}
                onChange={(e) => setCycleSettings(prev => ({ ...prev, endDate: e.target.value }))}
                data-testid="input-end-date"
              />
              <p className="text-xs text-muted-foreground">Leave empty for a 4-week cycle. You can always extend later.</p>
            </div>

            <div className="space-y-3">
              <Label>How do you want to track progress?</Label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setCycleSettings(prev => ({ ...prev, progressionMode: 'calendar' }))}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    cycleSettings.progressionMode === 'calendar'
                      ? "border-primary bg-primary/10"
                      : "border-border hover-elevate"
                  }`}
                  data-testid="progression-calendar"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${cycleSettings.progressionMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">Calendar-based</p>
                      <p className="text-sm text-muted-foreground">Move to next workout day automatically each day</p>
                    </div>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setCycleSettings(prev => ({ ...prev, progressionMode: 'completion' }))}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    cycleSettings.progressionMode === 'completion'
                      ? "border-primary bg-primary/10"
                      : "border-border hover-elevate"
                  }`}
                  data-testid="progression-completion"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${cycleSettings.progressionMode === 'completion' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <ListChecks className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">Completion-based</p>
                      <p className="text-sm text-muted-foreground">Move to next workout only when you complete the current one</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="py-4">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p><span className="font-medium text-foreground">Cycle:</span> {editableCycle.name}</p>
                  <p><span className="font-medium text-foreground">Days:</span> {editableCycle.cycleLength} workout days</p>
                  <p><span className="font-medium text-foreground">Starts:</span> {format(new Date(cycleSettings.startDate), 'MMM d, yyyy')}</p>
                  <p><span className="font-medium text-foreground">Progress:</span> {cycleSettings.progressionMode === 'calendar' ? 'Calendar-based' : 'Completion-based'}</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(3)} data-testid="button-back-step3">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSaveCycle}
                disabled={createCycleMutation.isPending || !cycleSettings.startDate}
                data-testid="button-save-cycle"
              >
                {createCycleMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Create Cycle
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
