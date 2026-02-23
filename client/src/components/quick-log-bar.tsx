import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Check, Loader2, X, Plus, ArrowRightLeft, ChevronRight, Zap, HelpCircle } from "lucide-react";

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
  const [isFocused, setIsFocused] = useState(false);
  const [extraChoices, setExtraChoices] = useState<Record<number, { choice: 'extra' | 'replace'; replaceId?: number }>>({});
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
      setExtraChoices({});
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
      setExtraChoices({});
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

  const hasIncompleteReplace = parseResult?.actions.some((a, i) =>
    a.type === 'add_extra' && extraChoices[i]?.choice === 'replace' && !extraChoices[i]?.replaceId
  ) ?? false;

  const handleConfirm = () => {
    if (!parseResult?.actions.length || hasIncompleteReplace) return;
    const finalActions = parseResult.actions.map((action, i) => {
      if (action.type === 'add_extra') {
        const choice = extraChoices[i];
        if (choice?.choice === 'replace' && choice.replaceId) {
          return {
            ...action,
            type: 'replace' as const,
            workoutItemId: choice.replaceId,
            newExerciseName: action.exerciseName,
          };
        }
      }
      return action;
    });
    confirmMutation.mutate(finalActions);
  };

  const handleDismiss = () => {
    setParsResult(null);
    setExtraChoices({});
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(`Did ${suggestion}`);
    parseMutation.mutate(`Did ${suggestion}`);
  };

  const handleDismissSummary = () => {
    setShowSummary(false);
    setSummaryResult(null);
  };

  const hasExtras = parseResult?.actions.some(a => a.type === 'add_extra') ?? false;
  const pendingExercises = parseResult?.todayExercises.filter(e => !e.completed) ?? [];

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'complete':
      case 'complete_with_details':
        return <Check className="w-3.5 h-3.5 text-emerald-400" />;
      case 'batch_complete':
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'replace':
        return <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />;
      case 'add_extra':
        return <Plus className="w-3.5 h-3.5 text-violet-400" />;
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
      case 'add_extra': {
        const details = [
          action.actualSets && `${action.actualSets} sets`,
          action.actualReps && `${action.actualReps} reps`,
          action.actualWeight && `@ ${action.actualWeight}`,
        ].filter(Boolean).join(', ');
        return details ? `${action.exerciseName} (${details})` : (action.exerciseName || 'Exercise');
      }
      default:
        return 'Exercise';
    }
  };

  const getActionTypeBadge = (type: string, actionIndex?: number) => {
    if (type === 'add_extra' && actionIndex !== undefined) {
      const choice = extraChoices[actionIndex];
      if (choice?.choice === 'replace') return 'Swap';
    }
    switch (type) {
      case 'complete': return 'Done';
      case 'complete_with_details': return 'Log';
      case 'batch_complete': return 'All';
      case 'replace': return 'Swap';
      case 'add_extra': return 'Extra';
      default: return '';
    }
  };

  const getActionTypeColor = (type: string, actionIndex?: number) => {
    if (type === 'add_extra' && actionIndex !== undefined) {
      const choice = extraChoices[actionIndex];
      if (choice?.choice === 'replace') return 'bg-sky-500/15 text-sky-400 border-sky-500/20';
    }
    switch (type) {
      case 'complete':
      case 'complete_with_details':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
      case 'batch_complete':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
      case 'replace':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/20';
      case 'add_extra':
        return 'bg-violet-500/15 text-violet-400 border-violet-500/20';
      default:
        return 'bg-muted/50 text-muted-foreground';
    }
  };

  const isParsing = parseMutation.isPending;
  const isConfirming = confirmMutation.isPending;

  return (
    <div className="space-y-2.5" data-testid="quick-log-bar">
      {/* Main Input Bar */}
      <Card className={`card-ambient overflow-hidden transition-all duration-300 ${isFocused ? 'shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30' : 'shadow-md shadow-primary/5'}`}>
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 via-indigo-600/5 to-violet-600/5" />
          <div className="relative flex items-center gap-2 px-3.5 py-2.5">
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md shadow-purple-500/25">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              {isParsing && (
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(); }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder='Try "did bench press 3x12" or "finished all"'
                className="border-0 bg-transparent h-auto px-0 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                disabled={isParsing || isConfirming}
                data-testid="input-quick-log"
              />
              <p className="text-[10px] text-muted-foreground/40 mt-0.5 leading-tight">Quick log your workout with Dika AI</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {input.trim() && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setInput(""); setParsResult(null); setExtraChoices({}); }}
                  data-testid="button-clear-quick-log"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                size="icon"
                onClick={handleSubmit}
                disabled={!input.trim() || isParsing || isConfirming}
                className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/25"
                data-testid="button-send-quick-log"
              >
                {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Confirmation Preview */}
      {parseResult && parseResult.actions.length > 0 && !showSummary && (
        <Card className="card-ambient overflow-hidden border-purple-500/20 shadow-lg shadow-purple-500/10" data-testid="card-quick-log-preview">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-indigo-600/5" />
            <CardContent className="relative p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-snug">{parseResult.summary}</p>
                </div>
                <Button variant="ghost" size="icon" className="w-5 h-5" onClick={handleDismiss} data-testid="button-dismiss-preview">
                  <X className="w-3 h-3" />
                </Button>
              </div>
              
              <div className="space-y-1.5">
                {parseResult.actions.map((action, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2.5 text-xs py-1.5 px-2.5 rounded-lg bg-card/60 border border-border/50">
                      <div className="w-5 h-5 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                        {action.type === 'add_extra' && extraChoices[i]?.choice === 'replace'
                          ? <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                          : getActionIcon(action.type)}
                      </div>
                      <span className="flex-1 truncate font-medium text-foreground/90">
                        {extraChoices[i]?.choice === 'replace' && extraChoices[i]?.replaceId
                          ? `${pendingExercises.find(e => e.id === extraChoices[i]?.replaceId)?.name || 'Exercise'} → ${action.exerciseName}`
                          : getActionLabel(action, parseResult.todayExercises)
                        }
                      </span>
                      <Badge variant="outline" className={`text-[9px] py-0 px-1.5 font-semibold border ${getActionTypeColor(action.type, i)} no-default-hover-elevate no-default-active-elevate`}>
                        {getActionTypeBadge(action.type, i)}
                      </Badge>
                    </div>

                    {/* Clarifying question for extra exercises */}
                    {action.type === 'add_extra' && (
                      <div className="ml-8 mt-1.5 mb-1 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15" data-testid={`extra-choice-${i}`}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <HelpCircle className="w-3 h-3 text-amber-400" />
                          <span className="text-[11px] font-medium text-amber-300/90">
                            {pendingExercises.length > 0 ? 'Is this replacing a planned exercise?' : 'This will be added as an extra exercise'}
                          </span>
                        </div>
                        {pendingExercises.length > 0 ? (
                          <>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant={!extraChoices[i] || extraChoices[i]?.choice === 'extra' ? 'default' : 'outline'}
                                className={`flex-1 text-[10px] ${!extraChoices[i] || extraChoices[i]?.choice === 'extra' ? 'bg-violet-500/15 border border-violet-500/30 text-violet-300' : ''}`}
                                onClick={() => setExtraChoices(prev => ({ ...prev, [i]: { choice: 'extra' } }))}
                                data-testid={`button-keep-extra-${i}`}
                              >
                                <Plus className="w-2.5 h-2.5 mr-1" />
                                Keep as extra
                              </Button>
                              <Button
                                size="sm"
                                variant={extraChoices[i]?.choice === 'replace' ? 'default' : 'outline'}
                                className={`flex-1 text-[10px] ${extraChoices[i]?.choice === 'replace' ? 'bg-sky-500/15 border border-sky-500/30 text-sky-300' : ''}`}
                                onClick={() => setExtraChoices(prev => ({ ...prev, [i]: { choice: 'replace', replaceId: undefined } }))}
                                data-testid={`button-replace-${i}`}
                              >
                                <ArrowRightLeft className="w-2.5 h-2.5 mr-1" />
                                Replace
                              </Button>
                            </div>
                            {extraChoices[i]?.choice === 'replace' && (
                              <div className="mt-2">
                                <Select
                                  value={extraChoices[i]?.replaceId?.toString() || ""}
                                  onValueChange={(val) => setExtraChoices(prev => ({
                                    ...prev,
                                    [i]: { choice: 'replace', replaceId: parseInt(val) }
                                  }))}
                                >
                                  <SelectTrigger className="h-7 text-[10px] bg-card/60 border-border/50" data-testid={`select-replace-target-${i}`}>
                                    <SelectValue placeholder="Which exercise to replace?" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {pendingExercises.map(ex => (
                                      <SelectItem key={ex.id} value={ex.id.toString()} className="text-xs">
                                        {ex.name} ({ex.sets}x{ex.reps})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/60">All planned exercises are already done. This will be logged as an extra.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-0.5">
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 border-0 text-white shadow-md shadow-emerald-500/25"
                  onClick={handleConfirm}
                  disabled={isConfirming || hasIncompleteReplace}
                  data-testid="button-confirm-quick-log"
                >
                  {isConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border/50"
                  onClick={handleDismiss}
                  data-testid="button-cancel-quick-log"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {/* Post-Confirm Summary */}
      {showSummary && summaryResult && (
        <Card className="card-ambient overflow-hidden border-emerald-500/20 shadow-lg shadow-emerald-500/10" data-testid="card-quick-log-summary">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-green-600/5" />
            <CardContent className="relative p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md shadow-emerald-500/25">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Logged!</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      {summaryResult.completed > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                          {summaryResult.completed} done
                        </span>
                      )}
                      {summaryResult.added > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Plus className="w-2.5 h-2.5 text-violet-400" />
                          {summaryResult.added} added
                        </span>
                      )}
                      {summaryResult.replaced > 0 && (
                        <span className="flex items-center gap-0.5">
                          <ArrowRightLeft className="w-2.5 h-2.5 text-sky-400" />
                          {summaryResult.replaced} swapped
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="w-5 h-5" onClick={handleDismissSummary} data-testid="button-dismiss-summary">
                  <X className="w-3 h-3" />
                </Button>
              </div>

              {summaryResult.updatedProgress && (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Workout Progress</span>
                    <span className={`font-bold ${summaryResult.updatedProgress.allDone ? 'text-emerald-400' : 'text-foreground'}`}>
                      {summaryResult.updatedProgress.completed}/{summaryResult.updatedProgress.total}
                      {summaryResult.updatedProgress.allDone && (
                        <span className="ml-1.5 inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" style={{ animation: 'flameFlicker 1.2s ease-in-out infinite' }} />
                          Complete!
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ease-out ${
                        summaryResult.updatedProgress.allDone 
                          ? 'bg-gradient-to-r from-emerald-500 to-green-400' 
                          : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                      }`}
                      style={{ 
                        width: `${summaryResult.updatedProgress.total > 0 ? (summaryResult.updatedProgress.completed / summaryResult.updatedProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      )}

      {/* Smart Suggestions */}
      {parseResult && parseResult.suggestions && parseResult.suggestions.length > 0 && !showSummary && (
        <div className="flex items-center gap-1.5 flex-wrap px-1" data-testid="quick-log-suggestions">
          <span className="text-[10px] text-muted-foreground/60 font-medium">Next up:</span>
          {parseResult.suggestions.map((suggestion, i) => (
            <Badge
              key={i}
              variant="outline"
              className="text-[10px] py-0.5 px-2.5 cursor-pointer bg-purple-500/10 text-purple-400 border-purple-500/20"
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
