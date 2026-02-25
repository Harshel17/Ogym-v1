import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, TrendingUp, TrendingDown, Minus, ArrowLeft, Clock, Dumbbell, BarChart3, Wrench, Settings2, AlertTriangle, Lightbulb, ShoppingCart, Eye, RefreshCcw, CheckCircle2, Target } from "lucide-react";
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

type EquipmentStressData = {
  equipment: {
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
  }[];
  insights: EquipmentInsight[];
  predictions: EquipmentPrediction[];
  hasSetup: boolean;
};

const levelColors = {
  peak: '#ef4444',
  moderate: '#f59e0b',
  low: '#22c55e',
};

const levelGradients = {
  peak: ['#ef4444', '#dc2626'],
  moderate: ['#f59e0b', '#d97706'],
  low: ['#22c55e', '#16a34a'],
};

export default function OwnerGymIntelligencePage() {
  const [, navigate] = useLocation();

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
              <div className="space-y-5">
                {(() => {
                  const all = equipmentStress.equipment;
                  const active = all.filter(e => e.totalUsage > 0);
                  const unused = all.filter(e => e.totalUsage === 0);
                  const totalUsage = all.reduce((s, e) => s + e.totalUsage, 0);
                  const predictions = equipmentStress.predictions || [];

                  const chartData = all
                    .filter(e => e.totalUsage > 0 || e.prevUsage > 0)
                    .sort((a, b) => b.totalUsage - a.totalUsage)
                    .slice(0, 8)
                    .map(e => {
                      const pred = predictions.find(p => p.id === e.id);
                      return {
                        name: e.name.length > 12 ? e.name.substring(0, 12) + '…' : e.name,
                        fullName: e.name,
                        'Last Month': e.prevUsage,
                        'This Month': e.totalUsage,
                        'Predicted': pred?.predictedNext || 0,
                      };
                    });

                  const actionIcons = {
                    buy_more: <ShoppingCart className="w-4 h-4" />,
                    monitor: <Eye className="w-4 h-4" />,
                    consider_replacing: <RefreshCcw className="w-4 h-4" />,
                    maintain: <CheckCircle2 className="w-4 h-4" />,
                  };
                  const actionColors = {
                    buy_more: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-600 dark:text-red-400', icon: 'text-red-500', label: 'Buy More', labelBg: 'bg-red-500' },
                    monitor: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600 dark:text-blue-400', icon: 'text-blue-500', label: 'Monitor', labelBg: 'bg-blue-500' },
                    consider_replacing: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-500', label: 'Review', labelBg: 'bg-amber-500' },
                    maintain: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', icon: 'text-emerald-500', label: 'OK', labelBg: 'bg-emerald-500' },
                  };

                  return (
                    <>
                      <div className="grid grid-cols-4 gap-2" data-testid="equipment-summary">
                        <div className="rounded-lg bg-muted/30 p-2 text-center">
                          <div className="text-base font-bold tabular-nums">{all.length}</div>
                          <div className="text-[9px] text-muted-foreground">Total</div>
                        </div>
                        <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                          <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{active.length}</div>
                          <div className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70">In Use</div>
                        </div>
                        <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                          <div className="text-base font-bold tabular-nums text-amber-600 dark:text-amber-400">{unused.length}</div>
                          <div className="text-[9px] text-amber-600/70 dark:text-amber-400/70">Not Tracked</div>
                        </div>
                        <div className="rounded-lg bg-blue-500/10 p-2 text-center">
                          <div className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">{totalUsage}</div>
                          <div className="text-[9px] text-blue-600/70 dark:text-blue-400/70">Total Uses</div>
                        </div>
                      </div>

                      {chartData.length > 0 && (
                        <div data-testid="equipment-usage-chart">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 rounded-full bg-blue-500" />
                            <span className="text-xs font-semibold">Usage Comparison</span>
                            <span className="text-[10px] text-muted-foreground">Last Month vs This Month vs Predicted Next</span>
                          </div>
                          <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                            <ResponsiveContainer width="100%" height={200}>
                              <BarChart data={chartData} barGap={2} barCategoryGap="20%">
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                                />
                                <Bar dataKey="Last Month" fill="#64748b" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="This Month" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                <Bar dataKey="Predicted" fill="#8b5cf6" radius={[2, 2, 0, 0]} opacity={0.6} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {equipmentStress.insights && equipmentStress.insights.length > 0 && (
                        <div data-testid="equipment-insights-section">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 rounded-full bg-amber-500" />
                            <span className="text-xs font-semibold">Key Insights</span>
                          </div>
                          <div className="space-y-1.5">
                            {equipmentStress.insights.map((insight, idx) => {
                              const bgMap = {
                                action: 'bg-red-500/10 border-red-500/20',
                                warning: 'bg-amber-500/10 border-amber-500/20',
                                success: 'bg-emerald-500/10 border-emerald-500/20',
                                info: 'bg-blue-500/10 border-blue-500/20',
                              };
                              const iconMap = {
                                action: <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
                                warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
                                success: <Lightbulb className="w-3.5 h-3.5 text-emerald-500 shrink-0" />,
                                info: <Lightbulb className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
                              };
                              const textColorMap = {
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
                        </div>
                      )}

                      {predictions.length > 0 && (
                        <div data-testid="equipment-predictions-section">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 rounded-full bg-violet-500" />
                            <span className="text-xs font-semibold">Investment Predictions</span>
                            <Badge variant="secondary" className="text-[10px]">Next 30 days</Badge>
                          </div>
                          <div className="space-y-2">
                            {predictions.sort((a, b) => {
                              const order = { high: 0, medium: 1, low: 2 };
                              return order[a.urgency] - order[b.urgency];
                            }).map(pred => {
                              const colors = actionColors[pred.action];
                              return (
                                <div key={pred.id} className={`rounded-xl border ${colors.border} overflow-hidden`} data-testid={`prediction-${pred.id}`}>
                                  <div className="p-3">
                                    <div className="flex items-start gap-3">
                                      <div className={`p-2 rounded-lg ${colors.bg} ${colors.icon} shrink-0 mt-0.5`}>
                                        {actionIcons[pred.action]}
                                      </div>
                                      <div className="flex-1 min-w-0 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="text-[13px] font-semibold truncate">{pred.name}</span>
                                          <Badge className={`text-[9px] text-white shrink-0 ${colors.labelBg}`}>{colors.label}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                          <span>Last: <span className="font-bold text-foreground">{pred.prevUsage}</span></span>
                                          <span>Now: <span className="font-bold text-foreground">{pred.currentUsage}</span></span>
                                          <span>Next: <span className="font-bold text-violet-600 dark:text-violet-400">{pred.predictedNext}</span></span>
                                          {pred.trend !== 0 && (
                                            <span className={`flex items-center gap-0.5 font-bold ml-auto ${pred.trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                              {pred.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                              {pred.trend > 0 ? '+' : ''}{pred.trend}%
                                            </span>
                                          )}
                                        </div>
                                        <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden flex gap-[1px]">
                                          <div className="h-full rounded-l-full bg-slate-400" style={{ width: `${pred.prevUsage ? Math.max((pred.prevUsage / Math.max(pred.prevUsage, pred.currentUsage, pred.predictedNext, 1)) * 100, 3) : 0}%` }} title="Last month" />
                                          <div className="h-full bg-blue-500" style={{ width: `${pred.currentUsage ? Math.max((pred.currentUsage / Math.max(pred.prevUsage, pred.currentUsage, pred.predictedNext, 1)) * 100, 3) : 0}%` }} title="This month" />
                                          <div className="h-full rounded-r-full bg-violet-500/60" style={{ width: `${pred.predictedNext ? Math.max((pred.predictedNext / Math.max(pred.prevUsage, pred.currentUsage, pred.predictedNext, 1)) * 100, 3) : 0}%` }} title="Predicted" />
                                        </div>
                                        <p className={`text-[11px] leading-relaxed ${colors.text}`}>
                                          {pred.reason}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {unused.length > 0 && (
                        <div data-testid="equipment-unused-section">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 rounded-full bg-slate-400" />
                            <span className="text-xs font-semibold">Untracked Equipment</span>
                            <span className="text-[10px] text-muted-foreground">— no usage data in 60 days</span>
                          </div>
                          <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {unused.map(equip => (
                                <div key={equip.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border/30" data-testid={`equipment-unused-${equip.id}`}>
                                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-xs font-medium truncate block">{equip.name}</span>
                                    <span className="text-[10px] text-muted-foreground/60">{equip.category}{equip.quantity > 1 ? ` · ${equip.quantity}x` : ''}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 mt-2.5 flex items-start gap-1.5">
                              <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                              Map exercises to these items in Equipment Setup for automatic tracking, or check if they need promotion to members.
                            </p>
                          </div>
                        </div>
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
    </div>
  );
}