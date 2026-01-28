import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Loader2, 
  ChevronRight, 
  ChevronLeft, 
  Copy,
  Check,
  AlertCircle,
  Dumbbell,
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Upload
} from "lucide-react";
import { format, addDays } from "date-fns";
import { createWorker } from "tesseract.js";

interface ParsedExercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  muscleType: string;
  bodyPart: string;
}

interface ParsedDay {
  dayIndex: number;
  name: string;
  exercises: ParsedExercise[];
}

interface ParseResult {
  success: boolean;
  cycleName: string;
  days: ParsedDay[];
  warnings: string[];
}

interface AIImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OGYM_PROMPT = `Now format my workout plan exactly like this for OGym import:

CYCLE: [Plan Name]

DAY 1: [Day Name]
- [Exercise Name] | [Sets] sets | [Reps] reps | [Rest Time]
- [Exercise Name] | [Sets] sets | [Reps] reps | [Rest Time]

DAY 2: [Day Name]
- [Exercise Name] | [Sets] sets | [Reps] reps | [Rest Time]

(Continue for all days)

Rules:
- Use pipe | as separator
- No explanations, just the list
- No emojis
- Reps can be a range like "8-12"
- Rest time format: "60s" or "2min"
- If no rest specified, write "No rest"`;

const muscleTypeOptions = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Forearms",
  "Quadriceps", "Hamstrings", "Glutes", "Calves", "Core", "Full Body", "Cardio", "Other"
];

const bodyPartOptions = ["Upper Body", "Lower Body", "Core", "Full Body"];

export function AIImportWizard({ open, onOpenChange }: AIImportWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [promptCopied, setPromptCopied] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([0]));
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [showOcrWarning, setShowOcrWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [cycleSettings, setCycleSettings] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    progressionMode: 'calendar' as 'calendar' | 'completion',
  });

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(OGYM_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
      toast({ title: "Prompt copied!" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }

    setIsOcrProcessing(true);
    setOcrProgress(0);
    setShowOcrWarning(true);

    try {
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      if (text.trim()) {
        setRawText(text);
        toast({ 
          title: "Screenshot processed!", 
          description: "Review the extracted text below. For best results, we recommend copy-pasting from ChatGPT." 
        });
      } else {
        toast({ 
          title: "No text found", 
          description: "Could not extract text from this image. Try a clearer screenshot.",
          variant: "destructive" 
        });
      }
    } catch (error) {
      console.error("OCR Error:", error);
      toast({ 
        title: "Processing failed", 
        description: "Could not read the screenshot. Please try copy-pasting instead.",
        variant: "destructive" 
      });
    } finally {
      setIsOcrProcessing(false);
      setOcrProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/personal/workout/parse-import", { rawText: text });
      return res.json();
    },
    onSuccess: (data: ParseResult) => {
      setParseResult(data);
      if (data.success && data.days.length > 0) {
        setExpandedDays(new Set([0]));
        setStep(2);
      } else {
        toast({ 
          title: "Could not parse workout", 
          description: "Please check the format and try again",
          variant: "destructive" 
        });
      }
    },
    onError: () => {
      toast({ title: "Parse failed", description: "Something went wrong", variant: "destructive" });
    },
  });

  const createCycleMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      cycleLength: number; 
      days: { dayIndex: number; label: string; items: { exerciseName: string; muscleType: string; bodyPart: string; sets: number; reps: number }[] }[];
      startDate: string;
      endDate: string;
      progressionMode: 'calendar' | 'completion';
      restDays: number[];
    }) => {
      const res = await apiRequest("POST", "/api/personal/cycles/bulk", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personal/cycles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/personal/cycles/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/cycles/my"] });
      toast({ title: "Workout cycle imported successfully!" });
      onOpenChange(false);
      resetWizard();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create cycle", variant: "destructive" });
    },
  });

  const resetWizard = () => {
    setStep(1);
    setRawText("");
    setParseResult(null);
    setPromptCopied(false);
    setExpandedDays(new Set([0]));
    setIsOcrProcessing(false);
    setOcrProgress(0);
    setShowOcrWarning(false);
    setCycleSettings({
      startDate: format(new Date(), 'yyyy-MM-dd'),
      progressionMode: 'calendar',
    });
  };

  const handleParse = () => {
    if (!rawText.trim()) {
      toast({ title: "Please paste your workout plan", variant: "destructive" });
      return;
    }
    parseMutation.mutate(rawText);
  };

  const toggleDayExpand = (dayIndex: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayIndex)) {
        next.delete(dayIndex);
      } else {
        next.add(dayIndex);
      }
      return next;
    });
  };

  const updateCycleName = (name: string) => {
    if (!parseResult) return;
    setParseResult({ ...parseResult, cycleName: name });
  };

  const updateDayName = (dayIndex: number, name: string) => {
    if (!parseResult) return;
    setParseResult({
      ...parseResult,
      days: parseResult.days.map(day => 
        day.dayIndex === dayIndex ? { ...day, name } : day
      )
    });
  };

  const updateExercise = (dayIndex: number, exerciseIndex: number, field: keyof ParsedExercise, value: string | number) => {
    if (!parseResult) return;
    setParseResult({
      ...parseResult,
      days: parseResult.days.map(day => 
        day.dayIndex === dayIndex 
          ? {
              ...day,
              exercises: day.exercises.map((ex, i) => 
                i === exerciseIndex ? { ...ex, [field]: value } : ex
              )
            }
          : day
      )
    });
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    if (!parseResult) return;
    setParseResult({
      ...parseResult,
      days: parseResult.days.map(day => 
        day.dayIndex === dayIndex 
          ? { ...day, exercises: day.exercises.filter((_, i) => i !== exerciseIndex) }
          : day
      )
    });
  };

  const addExercise = (dayIndex: number) => {
    if (!parseResult) return;
    const newExercise: ParsedExercise = {
      name: "New Exercise",
      sets: 3,
      reps: "10",
      rest: "60s",
      muscleType: "Other",
      bodyPart: "Full Body"
    };
    setParseResult({
      ...parseResult,
      days: parseResult.days.map(day => 
        day.dayIndex === dayIndex 
          ? { ...day, exercises: [...day.exercises, newExercise] }
          : day
      )
    });
  };

  const handleSave = () => {
    if (!parseResult) return;
    
    if (!parseResult.cycleName.trim()) {
      toast({ title: "Please enter a cycle name", variant: "destructive" });
      return;
    }
    
    if (parseResult.days.length === 0) {
      toast({ title: "No workout days to save", variant: "destructive" });
      return;
    }
    
    const emptyDays = parseResult.days.filter(d => d.exercises.length === 0);
    if (emptyDays.length > 0) {
      toast({ 
        title: "Some days have no exercises", 
        description: `${emptyDays.map(d => d.name).join(", ")} - add exercises or remove these days`,
        variant: "destructive" 
      });
      return;
    }
    
    const invalidExercises = parseResult.days.flatMap(d => 
      d.exercises.filter(ex => !ex.name.trim()).map(() => d.name)
    );
    if (invalidExercises.length > 0) {
      toast({ title: "Some exercises have empty names", variant: "destructive" });
      return;
    }
    
    const endDate = format(addDays(new Date(cycleSettings.startDate), 28), 'yyyy-MM-dd');
    
    const formattedDays = parseResult.days.map(day => ({
      dayIndex: day.dayIndex,
      label: day.name,
      items: day.exercises.map(ex => ({
        exerciseName: ex.name.trim(),
        muscleType: ex.muscleType,
        bodyPart: ex.bodyPart,
        sets: ex.sets || 3,
        reps: parseInt(ex.reps.split('-')[0]) || 10
      }))
    }));
    
    createCycleMutation.mutate({
      name: parseResult.cycleName,
      cycleLength: parseResult.days.length,
      days: formattedDays,
      startDate: cycleSettings.startDate,
      endDate,
      progressionMode: cycleSettings.progressionMode,
      restDays: []
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
            <Sparkles className="w-5 h-5" />
            {step === 1 && "Import from AI/Chat"}
            {step === 2 && "Review & Edit"}
            {step === 3 && "Cycle Settings"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Paste your ChatGPT or AI-generated workout plan to import it."}
            {step === 2 && "Review the parsed workout and make any changes."}
            {step === 3 && "Configure when your cycle starts."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Recommended: Copy this prompt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Paste this at the end of your ChatGPT conversation about your workout plan. 
                  It will format the response so we can import it accurately.
                </p>
                <div className="relative">
                  <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {OGYM_PROMPT}
                  </pre>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full gap-2"
                  onClick={handleCopyPrompt}
                  data-testid="button-copy-prompt"
                >
                  {promptCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Prompt
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label>Paste ChatGPT's response here</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    data-testid="input-screenshot-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isOcrProcessing}
                    data-testid="button-upload-screenshot"
                  >
                    {isOcrProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Reading... {ocrProgress}%
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        Upload Screenshot
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {showOcrWarning && rawText && (
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Text extracted from screenshot. <strong>For better results, we recommend copy-pasting the text directly from ChatGPT.</strong> Please review and edit below if needed.
                  </AlertDescription>
                </Alert>
              )}

              <Textarea
                placeholder={`CYCLE: My 4-Day Split

DAY 1: Push Day
- Bench Press | 4 sets | 8-10 reps | 90s
- Shoulder Press | 3 sets | 10 reps | 60s
...`}
                className="min-h-[200px] font-mono text-sm"
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (showOcrWarning && e.target.value !== rawText) {
                    setShowOcrWarning(false);
                  }
                }}
                data-testid="textarea-import-paste"
              />
              <p className="text-xs text-muted-foreground">
                Tip: If the format isn't exact, we'll do our best to parse it. You can edit everything in the next step.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={handleParse}
                disabled={parseMutation.isPending || !rawText.trim()}
                data-testid="button-parse-import"
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    Parse & Preview
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && parseResult && (
          <div className="space-y-4">
            {parseResult.warnings.length > 0 && (
              <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">Some items need attention:</p>
                  <ul className="text-xs list-disc list-inside">
                    {parseResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="cycle-name">Cycle Name</Label>
              <Input
                id="cycle-name"
                value={parseResult.cycleName}
                onChange={(e) => updateCycleName(e.target.value)}
                data-testid="input-import-cycle-name"
              />
            </div>

            <div className="space-y-3">
              {parseResult.days.map((day) => {
                const isExpanded = expandedDays.has(day.dayIndex);
                return (
                  <Card key={day.dayIndex}>
                    <CardHeader 
                      className="pb-2 cursor-pointer hover-elevate rounded-t-lg"
                      onClick={() => toggleDayExpand(day.dayIndex)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          <CardTitle className="text-base">Day {day.dayIndex + 1}</CardTitle>
                        </div>
                        <Badge variant="secondary">{day.exercises.length} exercises</Badge>
                      </div>
                    </CardHeader>
                    
                    {isExpanded && (
                      <CardContent className="pt-0 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Day Label</Label>
                          <Input
                            value={day.name}
                            onChange={(e) => updateDayName(day.dayIndex, e.target.value)}
                            className="h-8"
                            data-testid={`input-day-name-${day.dayIndex}`}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          {day.exercises.map((ex, exIdx) => (
                            <div 
                              key={exIdx} 
                              className="flex flex-col gap-2 p-2 bg-muted/30 rounded-md"
                            >
                              <div className="flex items-center gap-2">
                                <Input
                                  value={ex.name}
                                  onChange={(e) => updateExercise(day.dayIndex, exIdx, 'name', e.target.value)}
                                  className="h-8 flex-1"
                                  placeholder="Exercise name"
                                  data-testid={`input-exercise-name-${day.dayIndex}-${exIdx}`}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => removeExercise(day.dayIndex, exIdx)}
                                  data-testid={`button-remove-exercise-${day.dayIndex}-${exIdx}`}
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-4 gap-2">
                                <div>
                                  <Label className="text-xs">Sets</Label>
                                  <Input
                                    type="number"
                                    value={ex.sets}
                                    onChange={(e) => updateExercise(day.dayIndex, exIdx, 'sets', parseInt(e.target.value) || 1)}
                                    className="h-8"
                                    min={1}
                                    data-testid={`input-sets-${day.dayIndex}-${exIdx}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Reps</Label>
                                  <Input
                                    value={ex.reps}
                                    onChange={(e) => updateExercise(day.dayIndex, exIdx, 'reps', e.target.value)}
                                    className="h-8"
                                    placeholder="8-12"
                                    data-testid={`input-reps-${day.dayIndex}-${exIdx}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Rest</Label>
                                  <Input
                                    value={ex.rest}
                                    onChange={(e) => updateExercise(day.dayIndex, exIdx, 'rest', e.target.value)}
                                    className="h-8"
                                    placeholder="60s"
                                    data-testid={`input-rest-${day.dayIndex}-${exIdx}`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Muscle</Label>
                                  <Select
                                    value={ex.muscleType}
                                    onValueChange={(v) => updateExercise(day.dayIndex, exIdx, 'muscleType', v)}
                                  >
                                    <SelectTrigger className="h-8" data-testid={`select-muscle-${day.dayIndex}-${exIdx}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {muscleTypeOptions.map(m => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => addExercise(day.dayIndex)}
                          data-testid={`button-add-exercise-${day.dayIndex}`}
                        >
                          <Plus className="w-4 h-4" />
                          Add Exercise
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-back-step1">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button onClick={() => setStep(3)} data-testid="button-next-step3">
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && parseResult && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={cycleSettings.startDate}
                    onChange={(e) => setCycleSettings(prev => ({ ...prev, startDate: e.target.value }))}
                    data-testid="input-start-date"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Progression Mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCycleSettings(prev => ({ ...prev, progressionMode: 'calendar' }))}
                      className={`p-3 rounded-md border text-left transition-colors ${
                        cycleSettings.progressionMode === 'calendar'
                          ? "border-primary bg-primary/10"
                          : "border-border hover-elevate"
                      }`}
                      data-testid="button-progression-calendar"
                    >
                      <span className="font-medium text-sm">Calendar-based</span>
                      <p className="text-xs text-muted-foreground">Days advance with the calendar</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCycleSettings(prev => ({ ...prev, progressionMode: 'completion' }))}
                      className={`p-3 rounded-md border text-left transition-colors ${
                        cycleSettings.progressionMode === 'completion'
                          ? "border-primary bg-primary/10"
                          : "border-border hover-elevate"
                      }`}
                      data-testid="button-progression-completion"
                    >
                      <span className="font-medium text-sm">Completion-based</span>
                      <p className="text-xs text-muted-foreground">Next day after completing current</p>
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="bg-muted/30 rounded-md p-3">
              <p className="text-sm font-medium mb-2">Summary</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Cycle: {parseResult.cycleName}</li>
                <li>{parseResult.days.length} workout days</li>
                <li>{parseResult.days.reduce((sum, d) => sum + d.exercises.length, 0)} total exercises</li>
                <li>Starts: {cycleSettings.startDate}</li>
              </ul>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)} data-testid="button-back-step2">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleSave}
                disabled={createCycleMutation.isPending}
                data-testid="button-save-import"
              >
                {createCycleMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Dumbbell className="w-4 h-4 mr-2" />
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
