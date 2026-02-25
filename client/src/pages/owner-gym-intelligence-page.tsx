import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Flame, TrendingUp, TrendingDown, Minus, ArrowLeft, Clock, Dumbbell, BarChart3,
  Wrench, Settings2, AlertTriangle, Lightbulb, ShoppingCart, Eye, RefreshCcw,
  CheckCircle2, Target, Filter, X, ChevronRight, Activity, Zap, Package,
  Timer, ArrowUpRight, ArrowDownRight, Bookmark, Calendar
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend } from "recharts";
import { useLocation } from "wouter";

type PeakHourData = {
  hourData: { hour: number; count: number; label: string; level: 'peak' | 'moderate' | 'low' }[];
  peakSummary: string | null;
  lowSummary: string | null;
  totalCheckIns: number;
  daysAnalyzed: number;
};

type MuscleTrendData = {
  trends: { muscle: string; thisMonth: number; lastMonth: number; change: number; direction: 'up' | 'down' | 'stable' }[];
  totalThisMonth: number;
  totalLastMonth: number;
  overallChange: number;
};

type EquipmentInsight = {
  type: 'warning' | 'success' | 'info' | 'action';
  icon: string;
  text: string;
};

type EquipmentPrediction = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  currentUsage: number;
  prevUsage: number;
  predictedNext: number;
  predictedPerUnit: number;
  trend: number;
  action: 'buy_more' | 'monitor' | 'consider_replacing' | 'maintain';
  urgency: 'high' | 'medium' | 'low';
  reason: string;
};

type EquipmentItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  totalUsage: number;
  prevUsage: number;
  changePercent: number;
  usagePerUnit: number;
  hasCustomMapping: boolean;
  mappedExercises: number;
  stressLevel: 'high' | 'medium' | 'low';
  topExercise: string | null;
  muscles: { name: string; count: number }[];
  exerciseBreakdown: { exercise: string; count: number; muscle: string | null }[];
};

type EquipmentStressData = {
  equipment: EquipmentItem[];
  insights: EquipmentInsight[];
  predictions: EquipmentPrediction[];
  hasSetup: boolean;
};

const MUSCLE_FILTERS = ['All', 'Chest', 'Back', 'Quadriceps', 'Shoulders', 'Biceps', 'Triceps', 'Cardio', 'Core'];

const categoryIcons: Record<string, string> = {
  'Racks': '🏋️',
  'Benches': '🛋️',
  'Cardio': '🏃',
  'Cable': '🔗',
  'Free Weights': '💪',
  'Machines': '⚙️',
};

const stressColors = {
  high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  low: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
};

const actionConfig = {
  buy_more: { icon: <ShoppingCart className="w-3.5 h-3.5" />, label: 'Plan Purchase', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', signal: 'Priority', signalBg: 'bg-red-500' },
  monitor: { icon: <Eye className="w-3.5 h-3.5" />, label: 'Watch', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', signal: 'Watch', signalBg: 'bg-blue-500' },
  consider_replacing: { icon: <RefreshCcw className="w-3.5 h-3.5" />, label: 'Review', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', signal: 'Review', signalBg: 'bg-amber-500' },
  maintain: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Stable', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', signal: 'Stable', signalBg: 'bg-emerald-500' },
};

function EquipmentDetailPanel({ equip, prediction, onClose }: {
  equip: EquipmentItem;
  prediction: EquipmentPrediction | undefined;
  onClose: () => void;
}) {
  const config = prediction ? actionConfig[prediction.action] : null;
  const exerciseBreakdown = equip.exerciseBreakdown || [];
  const muscles = equip.muscles || [];
  const maxBreakdown = Math.max(...exerciseBreakdown.map(b => b.count), 1);

  const comparisonData = [
    { name: 'Last Month', value: equip.prevUsage, fill: '#64748b' },
    { name: 'This Month', value: equip.totalUsage, fill: '#3b82f6' },
    ...(prediction ? [{ name: 'Predicted', value: prediction.predictedNext, fill: '#8b5cf6' }] : []),
  ];

  const confidenceScore = prediction ? Math.min(95, Math.max(40,
    50 + (equip.prevUsage > 0 ? 20 : 0) + (equip.totalUsage > 10 ? 15 : equip.totalUsage > 5 ? 10 : 0) + (equip.hasCustomMapping ? 10 : 0)
  )) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-background z-10 px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{categoryIcons[equip.category] || '🔧'}</span>
              <div>
                <h3 className="font-bold text-base" data-testid="detail-equipment-name">{equip.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px]">{equip.category}</Badge>
                  {equip.quantity > 1 && <span className="text-[10px] text-muted-foreground">{equip.quantity} units</span>}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose} data-testid="button-close-detail">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-muted/30 p-3 text-center">
              <div className="text-lg font-bold tabular-nums">{equip.totalUsage}</div>
              <div className="text-[10px] text-muted-foreground">This Month</div>
            </div>
            <div className="rounded-xl bg-muted/30 p-3 text-center">
              <div className="text-lg font-bold tabular-nums">{equip.usagePerUnit}</div>
              <div className="text-[10px] text-muted-foreground">Per Unit</div>
            </div>
            <div className={`rounded-xl p-3 text-center ${stressColors[equip.stressLevel].bg}`}>
              <div className={`text-lg font-bold tabular-nums ${stressColors[equip.stressLevel].text}`}>
                {equip.changePercent > 0 ? '+' : ''}{equip.changePercent}%
              </div>
              <div className="text-[10px] text-muted-foreground">vs Last Month</div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-semibold">Usage Comparison</span>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/50 p-3">
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={comparisonData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '11px' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {comparisonData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} opacity={entry.name === 'Predicted' ? 0.6 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {exerciseBreakdown.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-xs font-semibold">Exercise Breakdown</span>
              </div>
              <div className="space-y-1.5">
                {exerciseBreakdown.map((ex, idx) => (
                  <div key={idx} className="flex items-center gap-2" data-testid={`exercise-breakdown-${idx}`}>
                    <span className="text-xs w-[120px] truncate capitalize">{ex.exercise}</span>
                    <div className="flex-1 h-4 rounded-full bg-muted/30 overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500/60 to-purple-500 transition-all duration-500"
                        style={{ width: `${(ex.count / maxBreakdown) * 100}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold tabular-nums">
                        {ex.count}
                      </span>
                    </div>
                    {ex.muscle && <Badge variant="outline" className="text-[8px] shrink-0">{ex.muscle}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {muscles.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs font-semibold">Muscle Groups Served</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {muscles.map(m => (
                  <div key={m.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/30">
                    <span className="text-xs font-medium">{m.name}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {prediction && config && (
            <div className={`rounded-xl border ${config.border} ${config.bg} p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Next Month Forecast</span>
                <Badge className={`text-[9px] text-white ml-auto ${config.signalBg}`}>{config.signal}</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-violet-500" />
                    <span className="text-muted-foreground text-xs">Predicted:</span>
                    <span className="font-bold">{prediction.predictedNext} uses</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">Per unit:</span>
                    <span className="font-bold">{prediction.predictedPerUnit}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Confidence:</span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${confidenceScore >= 70 ? 'bg-emerald-500' : confidenceScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${confidenceScore}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold tabular-nums">{confidenceScore}%</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{prediction.reason}</p>
                {prediction.action === 'buy_more' && (
                  <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-background/60 border border-border/30">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-muted-foreground">
                      Based on growth trend, you may need additional units within 2-3 months. Save this to your planning list and revisit next month.
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EquipmentCard({ equip, prediction, onClick }: {
  equip: EquipmentItem;
  prediction: EquipmentPrediction | undefined;
  onClick: () => void;
}) {
  const stress = stressColors[equip.stressLevel];
  const maxUsage = Math.max(equip.totalUsage, equip.prevUsage, 1);
  const config = prediction ? actionConfig[prediction.action] : null;

  return (
    <button
      type="button"
      className={`rounded-xl border ${stress.border} bg-card cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 group text-left w-full`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      data-testid={`equipment-card-${equip.id}`}
    >
      <div className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">{categoryIcons[equip.category] || '🔧'}</span>
            <div className="min-w-0">
              <span className="text-xs font-semibold truncate block">{equip.name}</span>
              <span className="text-[10px] text-muted-foreground">{equip.category}{equip.quantity > 1 ? ` · ${equip.quantity}x` : ''}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${stress.dot}`} />
            <ChevronRight className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
          </div>
        </div>

        <div className="flex items-end gap-1">
          <div className="flex-1 flex items-end gap-[3px]">
            <div className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-t bg-slate-400/60 transition-all" style={{ height: `${Math.max((equip.prevUsage / maxUsage) * 32, 2)}px` }} />
              <span className="text-[8px] text-muted-foreground/60">Prev</span>
            </div>
            <div className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-t bg-blue-500 transition-all" style={{ height: `${Math.max((equip.totalUsage / maxUsage) * 32, 2)}px` }} />
              <span className="text-[8px] text-muted-foreground/60">Now</span>
            </div>
          </div>
          <div className="text-right ml-2">
            <div className="text-base font-bold tabular-nums leading-none">{equip.totalUsage}</div>
            <div className="text-[9px] text-muted-foreground">uses</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {equip.changePercent !== 0 ? (
            <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${equip.changePercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {equip.changePercent > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {equip.changePercent > 0 ? '+' : ''}{equip.changePercent}%
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Minus className="w-3 h-3" /> Stable
            </span>
          )}
          {equip.topExercise && (
            <span className="text-[9px] text-muted-foreground truncate max-w-[80px] capitalize">{equip.topExercise}</span>
          )}
        </div>

        {(equip.muscles || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(equip.muscles || []).slice(0, 2).map(m => (
              <span key={m.name} className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">{m.name}</span>
            ))}
            {(equip.muscles || []).length > 2 && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground">+{equip.muscles.length - 2}</span>
            )}
          </div>
        )}

        {config && (
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg} ${config.border} border`}>
            <span className={config.color}>{config.icon}</span>
            <span className={`text-[9px] font-medium ${config.color}`}>{config.label}</span>
          </div>
        )}
      </div>
    </button>
  );
}

export default function OwnerGymIntelligencePage() {
  const [, navigate] = useLocation();
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [selectedEquipId, setSelectedEquipId] = useState<number | null>(null);

  const { data: peakHours, isLoading: peakLoading } = useQuery<PeakHourData>({
    queryKey: ["/api/owner/gym-intelligence/peak-hours"],
    staleTime: 1000 * 60 * 10,
  });

  const { data: muscleTrends, isLoading: muscleLoading } = useQuery<MuscleTrendData>({
    queryKey: ["/api/owner/gym-intelligence/muscle-trends"],
    staleTime: 1000 * 60 * 10,
  });

  const { data: equipmentStress, isLoading: equipmentLoading } = useQuery<EquipmentStressData>({
    queryKey: ["/api/owner/gym-intelligence/equipment-stress"],
    staleTime: 1000 * 60 * 10,
  });

  const filteredEquipment = useMemo(() => {
    if (!equipmentStress) return [];
    const all = equipmentStress.equipment;
    if (muscleFilter === 'All') return all;
    return all.filter(e =>
      (e.muscles || []).some(m => m.name.toLowerCase() === muscleFilter.toLowerCase()) ||
      (muscleFilter === 'Cardio' && e.category === 'Cardio')
    );
  }, [equipmentStress, muscleFilter]);

  const availableMuscles = useMemo(() => {
    if (!equipmentStress) return new Set<string>();
    const muscles = new Set<string>();
    for (const e of equipmentStress.equipment) {
      for (const m of (e.muscles || [])) muscles.add(m.name);
      if (e.category === 'Cardio') muscles.add('Cardio');
    }
    return muscles;
  }, [equipmentStress]);

  const selectedEquip = equipmentStress?.equipment.find(e => e.id === selectedEquipId);
  const selectedPrediction = equipmentStress?.predictions?.find(p => p.id === selectedEquipId);

  return (
    <div className="space-y-5 lg:max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/dashboard")} data-testid="button-back-dashboard">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="heading-gym-intelligence">Gym Intelligence</h1>
          <p className="text-xs text-muted-foreground">Data-driven insights from your gym's activity</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="card-elevated md:col-span-2" data-testid="card-peak-hours">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-red-500/10">
                <Flame className="w-4 h-4 text-red-500" />
              </div>
              Peak Hour Pressure
              <Badge variant="secondary" className="text-[10px] ml-auto">Last 30 days</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {peakLoading ? (
              <div className="h-[220px] flex items-center justify-center">
                <div className="animate-pulse text-xs text-muted-foreground">Analyzing check-in patterns...</div>
              </div>
            ) : peakHours && peakHours.totalCheckIns > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  {peakHours.peakSummary && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Flame className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">Peak: {peakHours.peakSummary}</span>
                    </div>
                  )}
                  {peakHours.lowSummary && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Quiet: {peakHours.lowSummary}</span>
                    </div>
                  )}
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakHours.hourData} barCategoryGap="15%">
                      <defs>
                        <linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="modGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="lowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} interval={1} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={30} />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        formatter={(value: number) => [`${value} check-ins`, 'Count']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {peakHours.hourData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.level === 'peak' ? 'url(#peakGrad)' : entry.level === 'moderate' ? 'url(#modGrad)' : 'url(#lowGrad)'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-[10px] text-muted-foreground">Peak</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-[10px] text-muted-foreground">Moderate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-muted-foreground">Quiet</span>
                  </div>
                </div>
                <p className="text-[10px] text-center text-muted-foreground/60">Based on {peakHours.totalCheckIns} check-ins over {peakHours.daysAnalyzed} days</p>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Flame className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Not enough check-in data yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Peak hour analysis will appear once members start checking in</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated md:col-span-2" data-testid="card-muscle-trends">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Dumbbell className="w-4 h-4 text-purple-500" />
              </div>
              Muscle Trend Intelligence
              <Badge variant="secondary" className="text-[10px] ml-auto">This month vs last</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {muscleLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-xs text-muted-foreground">Analyzing workout patterns...</div>
              </div>
            ) : muscleTrends && muscleTrends.trends.length > 0 ? (
              <div className="space-y-3">
                {muscleTrends.overallChange !== 0 && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${muscleTrends.overallChange > 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                    <BarChart3 className={`w-3.5 h-3.5 ${muscleTrends.overallChange > 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                    <span className="text-xs font-medium">
                      Overall workout volume {muscleTrends.overallChange > 0 ? 'up' : 'down'}{' '}
                      <span className="font-bold">{Math.abs(muscleTrends.overallChange)}%</span> this month
                      <span className="text-muted-foreground ml-1">({muscleTrends.totalThisMonth} vs {muscleTrends.totalLastMonth} exercises)</span>
                    </span>
                  </div>
                )}
                <div className="space-y-1.5">
                  {muscleTrends.trends.map((trend) => {
                    const maxCount = Math.max(...muscleTrends.trends.map(t => t.thisMonth), 1);
                    const barWidth = (trend.thisMonth / maxCount) * 100;
                    return (
                      <div key={trend.muscle} className="group" data-testid={`muscle-trend-${trend.muscle}`}>
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                          <div className="w-[100px] sm:w-[120px] shrink-0">
                            <span className="text-xs font-medium truncate block">{trend.muscle}</span>
                          </div>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-5 rounded-full bg-muted/30 overflow-hidden relative">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  trend.direction === 'up' ? 'bg-gradient-to-r from-emerald-500/70 to-emerald-500' :
                                  trend.direction === 'down' ? 'bg-gradient-to-r from-red-400/70 to-red-500' :
                                  'bg-gradient-to-r from-slate-400/70 to-slate-500'
                                }`}
                                style={{ width: `${barWidth}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">
                                {trend.thisMonth}
                              </span>
                            </div>
                          </div>
                          <div className={`flex items-center gap-0.5 shrink-0 min-w-[60px] justify-end ${
                            trend.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
                            trend.direction === 'down' ? 'text-red-600 dark:text-red-400' :
                            'text-muted-foreground'
                          }`}>
                            {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                            {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                            {trend.direction === 'stable' && <Minus className="w-3 h-3" />}
                            <span className="text-xs font-bold tabular-nums">
                              {trend.change > 0 ? '+' : ''}{trend.change}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] text-muted-foreground/60">Muscle group</span>
                  <span className="text-[10px] text-muted-foreground/60">vs last month</span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Dumbbell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No workout data yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Muscle trends will appear once members log workouts</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-elevated md:col-span-2" data-testid="card-equipment-stress">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <div className="p-1.5 rounded-lg bg-orange-500/10">
                <Wrench className="w-4 h-4 text-orange-500" />
              </div>
              Equipment Intelligence
              <Badge variant="secondary" className="text-[10px] ml-auto">Last 30 days</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {equipmentLoading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="animate-pulse text-xs text-muted-foreground">Analyzing equipment usage...</div>
              </div>
            ) : equipmentStress && equipmentStress.hasSetup && equipmentStress.equipment.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  const all = equipmentStress.equipment;
                  const active = all.filter(e => e.totalUsage > 0);
                  const totalUsage = all.reduce((s, e) => s + e.totalUsage, 0);
                  const highStress = all.filter(e => e.stressLevel === 'high');
                  const predictions = equipmentStress.predictions || [];

                  return (
                    <>
                      <div className="grid grid-cols-4 gap-2" data-testid="equipment-summary">
                        <div className="rounded-xl bg-muted/30 p-2.5 text-center">
                          <div className="text-base font-bold tabular-nums">{all.length}</div>
                          <div className="text-[9px] text-muted-foreground">Equipment</div>
                        </div>
                        <div className="rounded-xl bg-blue-500/10 p-2.5 text-center">
                          <div className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">{totalUsage}</div>
                          <div className="text-[9px] text-blue-600/70 dark:text-blue-400/70">Total Uses</div>
                        </div>
                        <div className="rounded-xl bg-emerald-500/10 p-2.5 text-center">
                          <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{active.length}</div>
                          <div className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70">Active</div>
                        </div>
                        <div className="rounded-xl bg-red-500/10 p-2.5 text-center">
                          <div className="text-base font-bold tabular-nums text-red-600 dark:text-red-400">{highStress.length}</div>
                          <div className="text-[9px] text-red-600/70 dark:text-red-400/70">High Load</div>
                        </div>
                      </div>

                      <div data-testid="muscle-filter-bar">
                        <div className="flex items-center gap-2 mb-2">
                          <Filter className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[10px] font-medium text-muted-foreground">Filter by muscle</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {MUSCLE_FILTERS.filter(f => f === 'All' || availableMuscles.has(f)).map(filter => (
                            <button
                              key={filter}
                              onClick={() => setMuscleFilter(filter)}
                              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border ${
                                muscleFilter === filter
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/60'
                              }`}
                              data-testid={`filter-muscle-${filter.toLowerCase()}`}
                            >
                              {filter}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold">
                              {muscleFilter === 'All' ? 'All Equipment' : `${muscleFilter} Equipment`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">({filteredEquipment.length})</span>
                          </div>
                          <div className="flex items-center gap-3 text-[9px] text-muted-foreground/60">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> High</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Medium</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Low</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="equipment-cards-grid">
                          {filteredEquipment.map(equip => (
                            <EquipmentCard
                              key={equip.id}
                              equip={equip}
                              prediction={predictions.find(p => p.id === equip.id)}
                              onClick={() => setSelectedEquipId(equip.id)}
                            />
                          ))}
                        </div>
                        {filteredEquipment.length === 0 && (
                          <div className="py-6 text-center">
                            <Dumbbell className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                            <p className="text-xs text-muted-foreground">No equipment matches "{muscleFilter}" muscle group</p>
                            <button onClick={() => setMuscleFilter('All')} className="text-xs text-primary mt-1" data-testid="button-clear-filter">
                              Clear filter
                            </button>
                          </div>
                        )}
                      </div>

                      {predictions.length > 0 && (
                        <div data-testid="equipment-planning-section">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="w-3.5 h-3.5 text-violet-500" />
                            <span className="text-xs font-semibold">Planning Overview</span>
                            <Badge variant="secondary" className="text-[10px]">Next 30 days</Badge>
                          </div>
                          <div className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2">
                            <div className="grid grid-cols-4 gap-2 text-center">
                              {(['Priority', 'Watch', 'Review', 'Stable'] as const).map(signal => {
                                const signalKey = signal === 'Priority' ? 'buy_more' : signal === 'Watch' ? 'monitor' : signal === 'Review' ? 'consider_replacing' : 'maintain';
                                const count = predictions.filter(p => p.action === signalKey).length;
                                const cfg = actionConfig[signalKey];
                                return (
                                  <div key={signal} className={`rounded-lg p-2 ${cfg.bg} border ${cfg.border}`}>
                                    <div className={`text-sm font-bold ${cfg.color}`}>{count}</div>
                                    <div className="text-[9px] text-muted-foreground">{signal}</div>
                                  </div>
                                );
                              })}
                            </div>
                            {predictions.filter(p => p.action === 'buy_more').length > 0 && (
                              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-background/60 border border-border/30">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <span className="text-[11px] text-muted-foreground leading-relaxed">
                                  {predictions.filter(p => p.action === 'buy_more').length} item{predictions.filter(p => p.action === 'buy_more').length > 1 ? 's' : ''} flagged for planning.
                                  These are based on {predictions.some(p => p.prevUsage > 0) ? '2+ months of usage trends' : 'recent usage patterns'}.
                                  Tap any equipment card above for detailed analysis and timeline.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {equipmentStress.insights && equipmentStress.insights.length > 0 && (
                        <details className="group" data-testid="equipment-insights-section">
                          <summary className="flex items-center gap-2 cursor-pointer list-none mb-2">
                            <div className="w-1 h-4 rounded-full bg-amber-500" />
                            <span className="text-xs font-semibold">Key Insights</span>
                            <span className="text-[10px] text-muted-foreground">({equipmentStress.insights.length})</span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto transition-transform group-open:rotate-90" />
                          </summary>
                          <div className="space-y-1.5">
                            {equipmentStress.insights.map((insight, idx) => {
                              const bgMap: Record<string, string> = {
                                action: 'bg-red-500/10 border-red-500/20',
                                warning: 'bg-amber-500/10 border-amber-500/20',
                                success: 'bg-emerald-500/10 border-emerald-500/20',
                                info: 'bg-blue-500/10 border-blue-500/20',
                              };
                              const iconMap: Record<string, JSX.Element> = {
                                action: <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
                                warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
                                success: <Lightbulb className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
                                info: <Lightbulb className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
                              };
                              const textColorMap: Record<string, string> = {
                                action: 'text-red-700 dark:text-red-300',
                                warning: 'text-amber-700 dark:text-amber-300',
                                success: 'text-emerald-700 dark:text-emerald-300',
                                info: 'text-blue-700 dark:text-blue-300',
                              };
                              return (
                                <div key={idx} className={`flex items-start gap-2 px-3 py-2 rounded-lg border ${bgMap[insight.type]}`} data-testid={`insight-${idx}`}>
                                  {iconMap[insight.type]}
                                  <span className={`text-xs font-medium leading-snug ${textColorMap[insight.type]}`}>
                                    {insight.icon} {insight.text}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}

                      <div className="flex items-center justify-end px-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[10px] text-muted-foreground"
                          onClick={() => navigate("/owner/equipment-setup")}
                          data-testid="button-manage-equipment"
                        >
                          <Settings2 className="w-3 h-3 mr-1" />
                          Manage Equipment
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Wrench className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No equipment registered yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Register your gym's equipment to see usage stress analysis</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => navigate("/owner/equipment-setup")}
                  data-testid="button-setup-equipment"
                >
                  <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                  Set Up Equipment
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedEquip && createPortal(
        <EquipmentDetailPanel
          equip={selectedEquip}
          prediction={selectedPrediction}
          onClose={() => setSelectedEquipId(null)}
        />,
        document.body
      )}
    </div>
  );
}
