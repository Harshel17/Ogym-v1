import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Check, Loader2, X, Dumbbell, Plus, ArrowRightLeft, ChevronRight, Zap } from "lucide-react";

function getClientLocalDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface QuickLogAction {
  type: "complete" | "complete_with_details" | "replace" | "add_extra" | "batch_complete";
  workoutItemId?: number;
  workoutItemIds?: number[];
  actualSets?: number;
  actualReps?: number;
  actualWeight?: string;
  newExerciseName?: string;
  exerciseName?: string;
  muscleType?: string;
}

interface ParseResult {
  actions: QuickLogAction[];
  summary: string;
  suggestions: string[];
  todayExercises: {
    id: number;
    name: string;
    sets: number;
    reps: number;
    weight: string | null;
    muscleType: string;
    completed: boolean;
  }[];
  completedCount: number;
  totalCount: number;
}

interface ConfirmResult {
  completed: number;
  added: number;
  replaced: number;
  updatedProgress: {
    completed: number;
    total: number;
    allDone: boolean;
  };
}

export function QuickLogBar() {
  const [input, setInput] = useState("");
  const [parseResult, setParsResult] = useState<ParseResult | null>(null);
  const [summaryResult, setSummaryResult] = useState<ConfirmResult | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const parseMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/workouts/quick-log/parse", {
        input: text,
        clientDate: getClientLocalDate(),
      });
      return res.json() as Promise<ParseResult>;
    },
    onSuccess: (data) => {
      setParsResult(data);
      if (data.actions.length === 0) {
        toast({
          title: "Couldn't match that",
          description: "Try something like 'did bench press 3x12' or 'finished everything'",
        });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to parse input. Try again.", variant: "destructive" });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (actions: QuickLogAction[]) => {
      const res = await apiRequest("POST", "/api/workouts/quick-log/confirm", {
        actions,
        clientDate: getClientLocalDate(),
      });
      return res.json() as Promise<ConfirmResult>;
    },
    onSuccess: (data) => {
      setSummaryResult(data);
      setShowSummary(true);
      setParsResult(null);
      setInput("");
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workouts/stats/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/daily-points'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/calendar/enhanced'] });
      queryClient.invalidateQueries({ queryKey: ['/api/member/workout/summary'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log workout. Try again.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    parseMutation.mutate(text);
  };

  const handleConfirm = () => {
    if (!parseResult?.actions.length) return;
    confirmMutation.mutate(parseResult.actions);
  };

  const handleDismiss = () => {
    setParsResult(null);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(`Did ${suggestion}`);
    parseMutation.mutate(`Did ${suggestion}`);
  };

  const handleDismissSummary = () => {
    setShowSummary(false);
    setSummaryResult(null);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'complete':
      case 'complete_with_details':
        return <Check className="w-3.5 h-3.5 text-green-500" />;
      case 'batch_complete':
        return <Zap className="w-3.5 h-3.5 text-amber-500" />;
      case 'replace':
        return <ArrowRightLeft className="w-3.5 h-3.5 text-blue-500" />;
      case 'add_extra':
        return <Plus className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <Check className="w-3.5 h-3.5" />;
    }
  };

  const getActionLabel = (action: QuickLogAction, exercises: ParseResult['todayExercises']) => {
    const exercise = exercises.find(e => e.id === action.workoutItemId);
    switch (action.type) {
      case 'complete':
        return exercise?.name || 'Exercise';
      case 'complete_with_details': {
        const details = [
          action.actualSets && `${action.actualSets} sets`,
          action.actualReps && `${action.actualReps} reps`,
          action.actualWeight && `@ ${action.actualWeight}`,
        ].filter(Boolean).join(', ');
        return `${exercise?.name || 'Exercise'} (${details})`;
      }
      case 'batch_complete':
        return `Complete all ${action.workoutItemIds?.length || 0} exercises`;
      case 'replace':
        return `${exercise?.name || 'Exercise'} → ${action.newExerciseName}`;
      case 'add_extra':
        return `+ ${action.exerciseName}`;
      default:
        return 'Exercise';
    }
  };

  const isParsing = parseMutation.isPending;
  const isConfirming = confirmMutation.isPending;

  return (
    <div className="space-y-2" data-testid="quick-log-bar">
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
          <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="Quick log: 'did bench press 3x12 at 80kg'..."
            className="border-0 bg-transparent h-8 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            disabled={isParsing || isConfirming}
            data-testid="input-quick-log"
          />
          {input.trim() && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => { setInput(""); setParsResult(null); }}
              data-testid="button-clear-quick-log"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!input.trim() || isParsing || isConfirming}
            data-testid="button-send-quick-log"
          >
            {isParsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Confirmation Preview */}
      {parseResult && parseResult.actions.length > 0 && !showSummary && (
        <Card className="border-purple-500/30 bg-purple-500/5 shadow-sm" data-testid="card-quick-log-preview">
          <CardContent className="p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-purple-700 dark:text-purple-300">{parseResult.summary}</p>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleDismiss} data-testid="button-dismiss-preview">
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="space-y-1.5">
              {parseResult.actions.map((action, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 rounded-md bg-background/60">
                  {getActionIcon(action.type)}
                  <span className="flex-1 truncate">{getActionLabel(action, parseResult.todayExercises)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleConfirm}
                disabled={isConfirming}
                data-testid="button-confirm-quick-log"
              >
                {isConfirming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                Confirm
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
                data-testid="button-cancel-quick-log"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post-Confirm Summary */}
      {showSummary && summaryResult && (
        <Card className="border-green-500/30 bg-green-500/5 shadow-sm" data-testid="card-quick-log-summary">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Logged!</p>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleDismissSummary} data-testid="button-dismiss-summary">
                <X className="w-3 h-3" />
              </Button>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {summaryResult.completed > 0 && (
                <span className="flex items-center gap-1">
                  <Check className="w-3 h-3 text-green-500" />
                  {summaryResult.completed} completed
                </span>
              )}
              {summaryResult.added > 0 && (
                <span className="flex items-center gap-1">
                  <Plus className="w-3 h-3 text-purple-500" />
                  {summaryResult.added} added
                </span>
              )}
              {summaryResult.replaced > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                  {summaryResult.replaced} replaced
                </span>
              )}
            </div>

            {summaryResult.updatedProgress && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className={`font-medium ${summaryResult.updatedProgress.allDone ? 'text-green-600' : ''}`}>
                    {summaryResult.updatedProgress.completed}/{summaryResult.updatedProgress.total}
                    {summaryResult.updatedProgress.allDone && ' ✓ All Done!'}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${summaryResult.updatedProgress.allDone ? 'bg-green-500' : 'bg-purple-500'}`}
                    style={{ width: `${summaryResult.updatedProgress.total > 0 ? (summaryResult.updatedProgress.completed / summaryResult.updatedProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Smart Suggestions */}
      {parseResult && parseResult.suggestions && parseResult.suggestions.length > 0 && !showSummary && (
        <div className="flex items-center gap-1.5 flex-wrap" data-testid="quick-log-suggestions">
          <span className="text-[10px] text-muted-foreground">Next up:</span>
          {parseResult.suggestions.map((suggestion, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-[10px] py-0 px-2 cursor-pointer hover:bg-purple-500/10 hover:border-purple-500/30 transition-colors"
              onClick={() => handleSuggestionClick(suggestion)}
              data-testid={`badge-suggestion-${i}`}
            >
              <ChevronRight className="w-2.5 h-2.5 mr-0.5" />
              {suggestion}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
