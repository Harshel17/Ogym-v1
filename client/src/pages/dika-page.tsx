import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, Settings, Copy, Check, Trash2, Mic, MicOff, Save, CheckCircle, Cpu, Utensils, Flame, Beef, Wheat, Droplets, UserPlus, CreditCard, Users, Navigation, X, CheckCheck, AlertCircle, FileText, Mail, ExternalLink, Dumbbell, Apple, TrendingUp, LifeBuoy, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { RoboDIcon } from '@/components/dika/dika-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { useTrainingMode } from '@/hooks/use-gym';
import { useDikaPage } from '@/hooks/use-dika';
import type { ReactNode } from 'react';

interface GeneratedWorkoutPlan {
  name: string;
  cycleLength: number;
  days: Array<{
    dayIndex: number;
    dayLabel: string;
    exercises: Array<{
      exerciseName: string;
      muscleType: string;
      bodyPart: string;
      sets: number;
      reps: number;
    }>;
  }>;
  restDays: number[];
}

function extractWorkoutPlanFromContent(content: string): GeneratedWorkoutPlan | null {
  const patterns = [
    /<!-- WORKOUT_PLAN_DATA:([\s\S]+?) -->/,
    /&lt;!-- WORKOUT_PLAN_DATA:([\s\S]+?) --&gt;/,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch { continue; }
    }
  }
  return null;
}

const muscleColorMap: Record<string, string> = {
  'Legs': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Chest': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Back': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Shoulders': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Core': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'Arms': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Biceps': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Triceps': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'Glutes': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'Cardio': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function WorkoutPlanCard({ plan, onSave, isSaving, isSaved }: { plan: GeneratedWorkoutPlan; onSave?: () => void; isSaving?: boolean; isSaved?: boolean }) {
  return (
    <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-3 py-2 bg-gradient-to-r from-slate-700 to-slate-800 text-white">
        <h3 className="font-semibold text-sm">{plan.name}</h3>
        <p className="text-xs text-white/80">{plan.cycleLength} day cycle</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[250px] overflow-y-auto">
        {plan.days.map((day) => (
          <div key={day.dayIndex} className="px-3 py-2">
            <div className="font-medium text-xs text-gray-700 dark:text-gray-300 mb-1.5">{day.dayLabel}</div>
            <div className="space-y-1">
              {day.exercises.map((ex, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">{ex.exerciseName}</span>
                    <span className="text-gray-400 dark:text-gray-500">{ex.sets}x{ex.reps}</span>
                  </div>
                  <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", muscleColorMap[ex.muscleType] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400')}>{ex.muscleType}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {plan.restDays.length > 0 && (
          <div className="px-3 py-2">
            <div className="font-medium text-xs text-gray-500 dark:text-gray-400">Rest Days: Day {plan.restDays.map(d => d + 1).join(', Day ')}</div>
          </div>
        )}
      </div>
      {onSave && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <Button onClick={onSave} disabled={isSaving || isSaved} size="sm" className={cn("w-full", isSaved ? "bg-green-500 text-white" : "bg-gradient-to-br from-amber-500 to-orange-600")} data-testid="button-save-workout-card">
            {isSaved ? (<><CheckCircle className="w-4 h-4 mr-2" />Saved!</>) : isSaving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : (<><Save className="w-4 h-4 mr-2" />Save to My Workouts</>)}
          </Button>
        </div>
      )}
    </div>
  );
}

interface MealLogData {
  mealType: string;
  mealLabel: string;
  items: Array<{ foodName: string; calories: number; protein: number; carbs: number; fat: number; servingSize: string; servingQuantity: number }>;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  dailyTotals: { calories: number; protein: number; calorieGoal: number | null; proteinGoal: number | null };
}

function extractMealLogFromContent(content: string): MealLogData | null {
  const patterns = [/<!-- MEAL_LOG_DATA:([\s\S]+?) -->/, /&lt;!-- MEAL_LOG_DATA:([\s\S]+?) --&gt;/];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) { try { return JSON.parse(match[1].trim()); } catch { continue; } }
  }
  return null;
}

function stripMealLogTag(content: string): string {
  return content.replace(/\n?<!-- MEAL_LOG_DATA:[\s\S]+? -->/g, '').replace(/\n?&lt;!-- MEAL_LOG_DATA:[\s\S]+? --&gt;/g, '').trim();
}

function MealLoggedCard({ meal }: { meal: MealLogData }) {
  const progressPercent = meal.dailyTotals.calorieGoal ? Math.min(100, Math.round((meal.dailyTotals.calories / meal.dailyTotals.calorieGoal) * 100)) : null;
  return (
    <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800/40 overflow-hidden" data-testid="card-meal-logged">
      <div className="px-3 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
        <div className="flex items-center gap-2"><Utensils className="w-4 h-4" /><h3 className="font-semibold text-sm">{meal.mealLabel} Logged</h3></div>
      </div>
      <div className="px-3 py-2 space-y-2">
        {meal.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
            <span className="text-gray-700 dark:text-gray-300 font-medium">{item.servingQuantity > 1 ? `${item.servingQuantity}x ` : ''}{item.foodName}</span>
            <span className="text-gray-500 dark:text-gray-400 tabular-nums">{item.calories} cal</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700/50">
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><div className="flex items-center justify-center gap-1 mb-0.5"><Flame className="w-3 h-3 text-orange-500" /></div><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{meal.totalCalories}</span><span className="text-[10px] text-gray-400 block">cal</span></div>
          <div><div className="flex items-center justify-center gap-1 mb-0.5"><Beef className="w-3 h-3 text-red-500" /></div><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{meal.totalProtein}g</span><span className="text-[10px] text-gray-400 block">protein</span></div>
          <div><div className="flex items-center justify-center gap-1 mb-0.5"><Wheat className="w-3 h-3 text-amber-600" /></div><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{meal.totalCarbs}g</span><span className="text-[10px] text-gray-400 block">carbs</span></div>
          <div><div className="flex items-center justify-center gap-1 mb-0.5"><Droplets className="w-3 h-3 text-blue-500" /></div><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{meal.totalFat}g</span><span className="text-[10px] text-gray-400 block">fat</span></div>
        </div>
      </div>
      {progressPercent !== null && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">Daily progress</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{meal.dailyTotals.calories.toLocaleString()} / {meal.dailyTotals.calorieGoal!.toLocaleString()} cal</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div className={cn("h-1.5 rounded-full transition-all", progressPercent >= 100 ? "bg-red-500" : progressPercent >= 80 ? "bg-amber-500" : "bg-green-500")} style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

interface OwnerActionData {
  actionType: 'navigate' | 'add_member' | 'log_payment' | 'assign_trainer' | 'create_support_ticket';
  status: 'pending_confirmation' | 'needs_info' | 'ready';
  payload: Record<string, any>;
  preview: string;
  missingFields?: string[];
}

function extractActionFromContent(content: string): OwnerActionData | null {
  const patterns = [/<!-- DIKA_ACTION_DATA:([\s\S]+?) -->/, /&lt;!-- DIKA_ACTION_DATA:([\s\S]+?) --&gt;/];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) { try { return JSON.parse(match[1].trim()); } catch { continue; } }
  }
  return null;
}

function stripActionTag(content: string): string {
  return content.replace(/\n?<!-- DIKA_ACTION_DATA:[\s\S]+? -->/g, '').replace(/\n?&lt;!-- DIKA_ACTION_DATA:[\s\S]+? --&gt;/g, '').trim();
}

const ACTION_ICONS: Record<string, typeof UserPlus> = { add_member: UserPlus, log_payment: CreditCard, assign_trainer: Users, navigate: Navigation, create_support_ticket: LifeBuoy };
const ACTION_LABELS: Record<string, string> = { add_member: 'Add Member', log_payment: 'Log Payment', assign_trainer: 'Assign Trainer', navigate: 'Navigate', create_support_ticket: 'Support Ticket' };
const ACTION_GRADIENTS: Record<string, string> = { add_member: 'from-emerald-500 to-teal-600', log_payment: 'from-blue-500 to-indigo-600', assign_trainer: 'from-purple-500 to-violet-600', navigate: 'from-amber-500 to-orange-600', create_support_ticket: 'from-rose-500 to-pink-600' };

function ActionCard({ action, onConfirm, onCancel, isExecuting, executionResult }: { action: OwnerActionData; onConfirm: () => void; onCancel: () => void; isExecuting: boolean; executionResult: { success: boolean; message: string } | null }) {
  const Icon = ACTION_ICONS[action.actionType] || Cpu;
  const label = ACTION_LABELS[action.actionType] || 'Action';
  const gradient = ACTION_GRADIENTS[action.actionType] || 'from-gray-500 to-gray-600';

  if (executionResult) {
    return (
      <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-testid="card-action-result">
        <div className={cn("px-3 py-2.5 text-white bg-gradient-to-r", executionResult.success ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600')}>
          <div className="flex items-center gap-2">{executionResult.success ? <CheckCheck className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}<h3 className="font-semibold text-sm">{executionResult.success ? 'Done' : 'Failed'}</h3></div>
        </div>
        <div className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
          {executionResult.message.split('\n').map((line, i) => {
            const boldParsed = line.split(/\*\*(.+?)\*\*/).map((part, j) => j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part);
            return <span key={i} className="block">{boldParsed}</span>;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-testid="card-action-confirm">
      <div className={cn("px-3 py-2.5 text-white bg-gradient-to-r", gradient)}>
        <div className="flex items-center gap-2"><Icon className="w-4 h-4" /><h3 className="font-semibold text-sm">{label}</h3></div>
      </div>
      <div className="px-3 py-3 space-y-1.5">
        {Object.entries(action.payload).filter(([key]) => !key.endsWith('Id') && key !== 'path' && key !== 'issueType').map(([key, value]) => {
          if (value === null || value === undefined || value === '') return null;
          const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
          let displayValue = typeof value === 'number' ? value.toLocaleString() : String(value);
          if (key === 'paymentMode') displayValue = value === 'full' ? 'Full Payment' : 'Partial Payment';
          if (key === 'totalAmount' || key === 'amountPaid') displayValue = `$${Number(value).toLocaleString()}`;
          if (key === 'priority') displayValue = String(value).toUpperCase();
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">{displayKey}</span>
                <span className="font-medium text-right max-w-[60%] truncate text-gray-800 dark:text-gray-200">{displayValue}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 flex gap-2">
        <Button onClick={onCancel} variant="outline" size="sm" className="flex-1" disabled={isExecuting} data-testid="button-action-cancel"><X className="w-3.5 h-3.5 mr-1" />Cancel</Button>
        <Button onClick={onConfirm} size="sm" className={cn("flex-1 text-white bg-gradient-to-r", gradient)} disabled={isExecuting} data-testid="button-action-confirm">
          {isExecuting ? (<><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Executing...</>) : (<><CheckCheck className="w-3.5 h-3.5 mr-1" />Confirm</>)}
        </Button>
      </div>
    </div>
  );
}

interface WeeklyReportData { token: string; rangeStart: string; rangeEnd: string; overallGrade: string; workoutDays: number; avgDailyCalories: number; avgDailyProtein: number; attendanceDays: number }

function extractWeeklyReportFromContent(content: string): WeeklyReportData | null {
  const patterns = [/<!-- WEEKLY_REPORT_DATA:([\s\S]+?) -->/, /&lt;!-- WEEKLY_REPORT_DATA:([\s\S]+?) --&gt;/];
  for (const pattern of patterns) { const match = content.match(pattern); if (match) { try { return JSON.parse(match[1].trim()); } catch { continue; } } }
  return null;
}

function stripWeeklyReportTag(content: string): string {
  return content.replace(/\n?<!-- WEEKLY_REPORT_DATA:[\s\S]+? -->/g, '').replace(/\n?&lt;!-- WEEKLY_REPORT_DATA:[\s\S]+? --&gt;/g, '').trim();
}

function WeeklyReportCard({ report }: { report: WeeklyReportData }) {
  const [emailing, setEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const gradeColor = (() => { const g = report.overallGrade.charAt(0); if (g === 'A') return 'text-emerald-600 dark:text-emerald-400'; if (g === 'B') return 'text-blue-600 dark:text-blue-400'; if (g === 'C') return 'text-amber-600 dark:text-amber-400'; return 'text-red-600 dark:text-red-400'; })();
  const gradeBg = (() => { const g = report.overallGrade.charAt(0); if (g === 'A') return 'from-emerald-500 to-teal-600'; if (g === 'B') return 'from-blue-500 to-indigo-600'; if (g === 'C') return 'from-amber-500 to-orange-600'; return 'from-red-500 to-rose-600'; })();
  const handleEmail = async () => {
    setEmailing(true);
    try { const res = await apiRequest('POST', `/api/reports/${report.token}/email`); const data = await res.json(); if (data.success) { setEmailSent(true); toast({ title: "Report Sent!", description: data.message }); } else { toast({ title: "Failed to send", description: data.message, variant: "destructive" }); } } catch { toast({ title: "Error", description: "Could not send report email.", variant: "destructive" }); } finally { setEmailing(false); }
  };
  const formatDate = (d: string) => { const date = new Date(d + 'T00:00:00'); return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  return (
    <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg border border-indigo-200 dark:border-indigo-800/40 overflow-hidden" data-testid="card-weekly-report">
      <div className={cn("px-3 py-2.5 bg-gradient-to-r text-white", gradeBg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><FileText className="w-4 h-4" /><h3 className="font-semibold text-sm">Weekly Report</h3></div>
          <span className="text-xs opacity-90">{formatDate(report.rangeStart)} - {formatDate(report.rangeEnd)}</span>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between mb-2"><span className="text-xs text-gray-500 dark:text-gray-400">Overall Grade</span><span className={cn("text-xl font-bold", gradeColor)}>{report.overallGrade}</span></div>
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-md py-1.5 px-1"><div className="flex items-center justify-center mb-0.5"><Dumbbell className="w-3 h-3 text-indigo-500" /></div><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{report.workoutDays}</span><span className="text-[10px] text-gray-400 block">workouts</span></div>
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-md py-1.5 px-1"><div className="flex items-center justify-center mb-0.5"><Flame className="w-3 h-3 text-orange-500" /></div><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{report.avgDailyCalories}</span><span className="text-[10px] text-gray-400 block">avg cal/day</span></div>
          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-md py-1.5 px-1"><div className="flex items-center justify-center mb-0.5"><Beef className="w-3 h-3 text-red-500" /></div><span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{report.avgDailyProtein}g</span><span className="text-[10px] text-gray-400 block">avg protein</span></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation(`/report/${report.token}`)} className="flex-1 text-xs" data-testid="button-view-report"><ExternalLink className="w-3 h-3 mr-1" />View Report</Button>
          <Button variant="outline" size="sm" onClick={handleEmail} disabled={emailing || emailSent} className="flex-1 text-xs" data-testid="button-email-report">
            {emailSent ? (<><Check className="w-3 h-3 mr-1 text-green-500" />Sent!</>) : emailing ? (<><Loader2 className="w-3 h-3 mr-1 animate-spin" />Sending...</>) : (<><Mail className="w-3 h-3 mr-1" />Email Report</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function parseMarkdown(text: string): ReactNode[] {
  const lines = text.split('\n');
  const elements: ReactNode[] = [];
  let currentList: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let keyCounter = 0;
  const flushList = () => {
    if (currentList.length > 0 && listType) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(<ListTag key={`list-${keyCounter++}`} className={cn("my-1 ml-4", listType === 'ol' ? "list-decimal" : "list-disc")}>{currentList.map((item, i) => (<li key={i} className="ml-1">{parseInlineMarkdown(item)}</li>))}</ListTag>);
      currentList = [];
      listType = null;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^[\s]*[-*]/);
    if (bulletMatch) { if (listType !== 'ul') flushList(); listType = 'ul'; currentList.push(line.replace(/^[\s]*[-*]\s+/, '')); continue; }
    const numberedMatch = line.match(/^[\s]*(\d+)[.)]\s+(.+)$/);
    if (numberedMatch) { if (listType !== 'ol') flushList(); listType = 'ol'; currentList.push(numberedMatch[2]); continue; }
    flushList();
    if (line.trim() === '') { elements.push(<br key={`br-${keyCounter++}`} />); } else { elements.push(<span key={`line-${keyCounter++}`} className="block">{parseInlineMarkdown(line)}</span>); }
  }
  flushList();
  return elements;
}

function parseInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;
  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    let nextMatch: { type: 'bold' | 'link'; match: RegExpMatchArray } | null = null;
    if (boldMatch && boldMatch.index !== undefined) nextMatch = { type: 'bold', match: boldMatch };
    if (linkMatch && linkMatch.index !== undefined) { if (!nextMatch || linkMatch.index < (nextMatch.match.index ?? Infinity)) nextMatch = { type: 'link', match: linkMatch }; }
    if (nextMatch && nextMatch.match.index !== undefined) {
      if (nextMatch.match.index > 0) parts.push(remaining.slice(0, nextMatch.match.index));
      if (nextMatch.type === 'bold') parts.push(<strong key={`bold-${keyCounter++}`} className="font-semibold">{nextMatch.match[1]}</strong>);
      else if (nextMatch.type === 'link') parts.push(<a key={`link-${keyCounter++}`} href={nextMatch.match[2]} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 underline underline-offset-2">{nextMatch.match[1]}</a>);
      remaining = remaining.slice(nextMatch.match.index + nextMatch.match[0].length);
      continue;
    }
    parts.push(remaining);
    break;
  }
  return parts;
}

function MarkdownContent({ content }: { content: string }) {
  const parsed = useMemo(() => {
    let cleanContent = content
      .replace(/<!-- WORKOUT_PLAN_DATA:[\s\S]+? -->/g, '').replace(/&lt;!-- WORKOUT_PLAN_DATA:[\s\S]+? --&gt;/g, '')
      .replace(/<!-- MEAL_LOG_DATA:[\s\S]+? -->/g, '').replace(/&lt;!-- MEAL_LOG_DATA:[\s\S]+? --&gt;/g, '')
      .replace(/<!-- DIKA_ACTION_DATA:[\s\S]+? -->/g, '').replace(/&lt;!-- DIKA_ACTION_DATA:[\s\S]+? --&gt;/g, '')
      .replace(/<!-- WEEKLY_REPORT_DATA:[\s\S]+? -->/g, '').replace(/&lt;!-- WEEKLY_REPORT_DATA:[\s\S]+? --&gt;/g, '')
      .trim();
    return parseMarkdown(cleanContent);
  }, [content]);
  return <div className="leading-relaxed">{parsed}</div>;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 dika-typing-dot" style={{ animationDelay: '0ms' }} />
      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 dika-typing-dot" style={{ animationDelay: '200ms' }} />
      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 dika-typing-dot" style={{ animationDelay: '400ms' }} />
    </div>
  );
}

function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  useEffect(() => {
    try {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionClass) { setIsSupported(false); return; }
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
      recognition.onresult = (event: any) => { const transcript = event.results?.[0]?.[0]?.transcript; if (transcript) onTranscript(transcript); setIsListening(false); };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      setIsSupported(true);
    } catch { setIsSupported(false); }
    return () => { try { if (recognitionRef.current) recognitionRef.current.abort(); } catch {} };
  }, [onTranscript]);
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try { if (isListening) { recognitionRef.current.stop(); setIsListening(false); } else { recognitionRef.current.start(); setIsListening(true); } } catch { setIsListening(false); }
  }, [isListening]);
  return { isListening, isSupported, toggleListening };
}

interface DikaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  followUpChips?: string[];
}

export default function DikaPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <DikaPageInner userId={user.id} />;
}

function DikaPageInner({ userId }: { userId: number }) {
  const {
    messages,
    suggestions,
    isLoading,
    sendMessage,
    clearHistory,
  } = useDikaPage(userId);

  const { data: trainingModeData } = useTrainingMode();
  const { user } = useAuth();
  const isTrainerLed = user?.gymId && trainingModeData?.trainingMode === 'trainer_led';
  const canManageOwnWorkouts = !isTrainerLed;

  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedWorkoutIds, setSavedWorkoutIds] = useState<Set<string>>(new Set());
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [actionResults, setActionResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [cancelledActions, setCancelledActions] = useState<Set<string>>(new Set());

  const saveWorkoutMutation = useMutation({
    mutationFn: async ({ plan, messageId }: { plan: GeneratedWorkoutPlan; messageId: string }) => {
      const res = await apiRequest('POST', '/api/dika/save-workout', { plan });
      return { result: await res.json(), messageId };
    },
    onSuccess: ({ messageId }) => {
      setSavedWorkoutIds(prev => new Set(prev).add(messageId));
      setSavingMessageId(null);
      queryClient.invalidateQueries({ queryKey: ['/api/workout-cycles'] });
      toast({ title: "Workout Saved!", description: "Your personalized workout plan is now in My Workouts." });
    },
    onError: () => {
      setSavingMessageId(null);
      toast({ title: "Save Failed", description: "Could not save workout. Please try again.", variant: "destructive" });
    },
  });

  const handleSaveWorkout = (messageId: string, content: string) => {
    const plan = extractWorkoutPlanFromContent(content);
    if (plan && !saveWorkoutMutation.isPending) { setSavingMessageId(messageId); saveWorkoutMutation.mutate({ plan, messageId }); }
  };

  const executeActionMutation = useMutation({
    mutationFn: async ({ action, messageId }: { action: OwnerActionData; messageId: string }) => {
      const res = await apiRequest('POST', '/api/dika/execute', { actionType: action.actionType, payload: action.payload, preview: action.preview });
      return { result: await res.json(), messageId };
    },
    onSuccess: ({ result, messageId }) => {
      setActionResults(prev => ({ ...prev, [messageId]: result }));
      setExecutingActionId(null);
      if (result.success) {
        const actionType = extractActionFromContent(messages.find((m: DikaMessage) => m.id === messageId)?.content || '')?.actionType || '';
        if (['add_member', 'assign_trainer'].includes(actionType)) {
          queryClient.invalidateQueries({ queryKey: ['/api/owner/members'] });
          queryClient.invalidateQueries({ queryKey: ['/api/owner/trainers'] });
          queryClient.invalidateQueries({ queryKey: ['/api/owner/assignments'] });
          queryClient.invalidateQueries({ queryKey: ['/api/owner/dashboard-metrics'] });
        }
        if (actionType === 'log_payment') {
          queryClient.invalidateQueries({ queryKey: ['/api/owner/transactions'] });
          queryClient.invalidateQueries({ queryKey: ['/api/owner/subscriptions'] });
          queryClient.invalidateQueries({ queryKey: ['/api/owner/revenue'] });
          queryClient.invalidateQueries({ queryKey: ['/api/owner/dashboard-metrics'] });
        }
        if (actionType === 'create_support_ticket') {
          queryClient.invalidateQueries({ queryKey: ['/api/support/my-tickets'] });
        }
      }
    },
    onError: (_, { messageId }) => {
      setActionResults(prev => ({ ...prev, [messageId]: { success: false, message: 'Something went wrong. Please try again.' } }));
      setExecutingActionId(null);
    },
  });

  const handleActionConfirm = useCallback((messageId: string, action: OwnerActionData) => {
    if (action.actionType === 'navigate') { setLocation(action.payload.path); return; }
    setExecutingActionId(messageId);
    executeActionMutation.mutate({ action, messageId });
  }, [executeActionMutation, setLocation]);

  const handleActionCancel = useCallback((messageId: string) => {
    setCancelledActions(prev => new Set(prev).add(messageId));
  }, []);

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(prev => prev ? `${prev} ${text}` : text);
  }, []);

  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceInput(handleVoiceTranscript);

  const handleCopy = async (messageId: string, content: string) => {
    try { await navigator.clipboard.writeText(content); setCopiedId(messageId); setTimeout(() => setCopiedId(null), 2000); } catch {}
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let kbHeight = 0;
    let lastH = 0;

    const isNative = (() => {
      try {
        const w = window as any;
        return !!(w.Capacitor?.isNativePlatform?.());
      } catch { return false; }
    })();

    const applyHeight = () => {
      if (!containerRef.current) return;
      const screenH = window.innerHeight || document.documentElement.clientHeight;
      const h = kbHeight > 0 ? screenH - kbHeight : screenH;
      if (h !== lastH && h > 0) {
        lastH = h;
        containerRef.current.style.height = `${h}px`;
      }
    };

    if (isNative) {
      let showHandle: any;
      let hideHandle: any;

      import('@capacitor/keyboard').then(({ Keyboard }) => {
        Keyboard.addListener('keyboardWillShow', (info) => {
          kbHeight = info.keyboardHeight;
          applyHeight();
        }).then(h => { showHandle = h; });

        Keyboard.addListener('keyboardWillHide', () => {
          kbHeight = 0;
          applyHeight();
        }).then(h => { hideHandle = h; });
      }).catch(() => {});

      applyHeight();
      const poll = setInterval(applyHeight, 150);

      return () => {
        clearInterval(poll);
        if (showHandle) showHandle.remove();
        if (hideHandle) hideHandle.remove();
      };
    }

    const viewport = window.visualViewport;

    const syncFromViewport = () => {
      if (!containerRef.current || !viewport) return;
      const h = viewport.height;
      if (h !== lastH && h > 0) {
        lastH = h;
        containerRef.current.style.height = `${h}px`;
      }
    };

    if (viewport) {
      syncFromViewport();
      viewport.addEventListener('resize', syncFromViewport);
      viewport.addEventListener('scroll', syncFromViewport);
      const poll = setInterval(syncFromViewport, 100);

      const handleFocus = () => {
        syncFromViewport();
        let frames = 0;
        const burst = () => {
          syncFromViewport();
          if (++frames < 60) requestAnimationFrame(burst);
        };
        requestAnimationFrame(burst);
      };

      document.addEventListener('focusin', handleFocus);
      document.addEventListener('focusout', handleFocus);

      return () => {
        clearInterval(poll);
        viewport.removeEventListener('resize', syncFromViewport);
        viewport.removeEventListener('scroll', syncFromViewport);
        document.removeEventListener('focusin', handleFocus);
        document.removeEventListener('focusout', handleFocus);
      };
    }

    applyHeight();
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'assistant') return;
    const actionData = extractActionFromContent(lastMsg.content);
    if (actionData && actionData.actionType === 'navigate' && actionData.status === 'ready') {
      setTimeout(() => setLocation(actionData.payload.path), 600);
    }
  }, [messages, setLocation]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) { sendMessage(input.trim()); setInput(''); }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col -m-4 md:-m-8 dika-full-height-kb"
      data-testid="page-dika"
    >
      <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 border-b border-white/[0.06] px-4 py-3 backdrop-blur-xl" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4px)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-300 rounded-xl -ml-1 md:hidden"
              onClick={() => {
                if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
                setTimeout(() => setLocation('/'), 50);
              }}
              data-testid="button-dika-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 blur-md opacity-40" style={{ animation: 'dikaGlow 3s ease-in-out infinite' }} />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <RoboDIcon className="w-6 h-6 text-white drop-shadow-sm" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 dark:border-slate-950">
                <div className="absolute inset-0 rounded-full bg-emerald-400" style={{ animation: 'dikaPulseRing 2s ease-out infinite' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-white tracking-tight">Dika AI</h2>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 font-medium tracking-wider uppercase border border-amber-400/20 backdrop-blur-sm">v2.0</span>
              </div>
              <p className="text-[11px] text-slate-400/80 font-medium">Your fitness intelligence assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-400/70 rounded-xl" data-testid="button-clear-history">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete chat history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your entire conversation with Dika. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearHistory} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50 via-slate-50 to-white dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-950 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gradient-to-br from-amber-500/[0.04] via-orange-500/[0.02] to-transparent dark:from-amber-500/[0.03] dark:via-orange-500/[0.01] blur-3xl" />
        </div>
        {messages.length === 0 && (
          <div className="text-center py-10 relative">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-[-8px] rounded-3xl bg-gradient-to-br from-amber-400/25 to-orange-500/15 blur-2xl" style={{ animation: 'dikaGlow 4s ease-in-out infinite' }} />
              <div className="absolute inset-[-4px] rounded-2xl bg-gradient-to-br from-amber-400/10 to-orange-500/10" style={{ animation: 'dikaPulseRing 3s ease-out infinite' }} />
              <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center shadow-xl shadow-amber-500/10">
                <RoboDIcon className="w-10 h-10 text-amber-500 dark:text-amber-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-1.5 text-slate-800 dark:text-slate-100 tracking-tight">How can I help you today?</h3>
            <p className="text-[13px] text-slate-400 dark:text-slate-500 mb-8 max-w-[260px] mx-auto leading-relaxed">Workouts, nutrition, attendance, payments and more</p>
            {suggestions.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] text-slate-400/70 dark:text-slate-500/70 uppercase tracking-[0.15em] font-medium">Try asking</p>
                <div className="flex flex-wrap gap-2 justify-center max-w-[320px] mx-auto">
                  {suggestions.map((suggestion: string, i: number) => (
                    <Badge key={i} variant="outline" className="dika-suggestion-enter cursor-pointer hover-elevate bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 text-xs backdrop-blur-sm shadow-sm" style={{ animationDelay: `${i * 80}ms`, opacity: 0 }} onClick={() => handleSuggestionClick(suggestion)} data-testid={`chip-suggestion-${i}`}>
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((message: DikaMessage, index: number) => (
          <div key={message.id} className={cn("space-y-2 dika-msg-enter", message.role === 'assistant' && "mb-5")}>
            <div className={cn("flex", message.role === 'user' ? 'justify-end' : 'justify-start')}>
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl mr-2 flex-shrink-0 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <RoboDIcon className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={cn(
                "max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm group relative transition-shadow duration-200",
                message.role === 'user'
                  ? 'bg-gradient-to-br from-slate-700 to-slate-800 dark:from-slate-600 dark:to-slate-700 text-white rounded-br-sm shadow-md shadow-slate-900/10'
                  : 'bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 rounded-bl-sm shadow-md shadow-slate-200/50 dark:shadow-slate-900/30 backdrop-blur-sm'
              )} data-testid={`message-${message.role}`}>
                {message.role === 'assistant' ? (
                  <>
                    {(() => {
                      const mealLog = extractMealLogFromContent(message.content);
                      const actionData = extractActionFromContent(message.content);
                      const weeklyReport = extractWeeklyReportFromContent(message.content);
                      let displayContent = message.content;
                      if (mealLog) displayContent = stripMealLogTag(displayContent);
                      if (actionData) displayContent = stripActionTag(displayContent);
                      if (weeklyReport) displayContent = stripWeeklyReportTag(displayContent);
                      return (
                        <>
                          <MarkdownContent content={displayContent} />
                          {mealLog && <MealLoggedCard meal={mealLog} />}
                          {weeklyReport && <WeeklyReportCard report={weeklyReport} />}
                          {actionData && actionData.status === 'pending_confirmation' && !cancelledActions.has(message.id) && (
                            <ActionCard action={actionData} onConfirm={() => handleActionConfirm(message.id, actionData)} onCancel={() => handleActionCancel(message.id)} isExecuting={executingActionId === message.id} executionResult={actionResults[message.id] || null} />
                          )}
                        </>
                      );
                    })()}
                    {canManageOwnWorkouts && extractWorkoutPlanFromContent(message.content) && (
                      <WorkoutPlanCard plan={extractWorkoutPlanFromContent(message.content)!} onSave={() => handleSaveWorkout(message.id, message.content)} isSaving={savingMessageId === message.id} isSaved={savedWorkoutIds.has(message.id)} />
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
                {message.role === 'assistant' && (
                  <div className="absolute -bottom-6 left-0 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleCopy(message.id, message.content)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1" data-testid={`button-copy-${message.id}`}>
                      {copiedId === message.id ? (<><Check className="w-3 h-3 text-green-500" /><span className="text-green-500">Copied!</span></>) : (<><Copy className="w-3 h-3" /><span>Copy</span></>)}
                    </button>
                  </div>
                )}
              </div>
            </div>
            {message.role === 'assistant' && message.followUpChips && message.followUpChips.length > 0 && !messages.slice(index + 1).some((m: DikaMessage) => m.role === 'assistant') && (
              <div className="flex flex-wrap gap-1.5 pl-9">
                {message.followUpChips.map((chip: string, i: number) => (
                  <Badge key={i} variant="outline" className="dika-suggestion-enter cursor-pointer hover-elevate text-xs bg-white/80 dark:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 backdrop-blur-sm shadow-sm" style={{ animationDelay: `${i * 60}ms`, opacity: 0 }} onClick={() => handleSuggestionClick(chip)} data-testid={`chip-followup-${i}`}>
                    {chip}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start dika-msg-enter">
            <div className="w-7 h-7 rounded-xl mr-2 flex-shrink-0 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-md shadow-amber-500/20">
              <RoboDIcon className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl rounded-bl-sm shadow-md shadow-slate-200/50 dark:shadow-slate-900/30 backdrop-blur-sm">
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-2 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2 flex-shrink-0 bg-gradient-to-t from-white via-white to-slate-50/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/80 backdrop-blur-xl">
        <div className="flex-1 relative">
          <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={isListening ? "Listening..." : "Ask Dika anything..."} disabled={isLoading} className={cn("pr-4 rounded-full bg-slate-100/80 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/40 focus:border-amber-400/60 focus:ring-amber-400/15 placeholder:text-slate-400/60 shadow-inner shadow-slate-200/30 dark:shadow-slate-900/20 transition-all duration-200", isListening && "border-red-400/60 animate-pulse")} inputMode="text" autoComplete="off" enterKeyHint="send" data-testid="input-dika-message" />
        </div>
        {voiceSupported && (
          <Button type="button" size="icon" variant={isListening ? "destructive" : "ghost"} onClick={toggleListening} disabled={isLoading} className={cn("rounded-full text-slate-400", isListening && "animate-pulse")} data-testid="button-dika-voice">
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </Button>
        )}
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 shadow-lg shadow-amber-500/30 transition-all duration-200 disabled:shadow-none disabled:opacity-40" data-testid="button-dika-send">
          <Send className="w-4 h-4 text-white" />
        </Button>
      </form>
    </div>
  );
}
