import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, TrendingUp, TrendingDown, Minus, ArrowLeft, Clock, Dumbbell, BarChart3, Wrench, Settings2, AlertTriangle, Lightbulb } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";
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
              <div className="space-y-4">
                {(() => {
                  const active = equipmentStress.equipment.filter(e => e.totalUsage > 0);
                  const unused = equipmentStress.equipment.filter(e => e.totalUsage === 0);
                  const highStress = active.filter(e => e.stressLevel === 'high');
                  const rising = active.filter(e => e.changePercent >= 20);
                  const dropping = equipmentStress.equipment.filter(e => e.changePercent <= -20 && e.prevUsage > 0);
                  const totalUsage = equipmentStress.equipment.reduce((s, e) => s + e.totalUsage, 0);

                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2" data-testid="equipment-summary">
                        <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                          <div className="text-lg font-bold tabular-nums" data-testid="text-total-equipment">{equipmentStress.equipment.length}</div>
                          <div className="text-[10px] text-muted-foreground">Equipment</div>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                          <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400" data-testid="text-active-count">{active.length}</div>
                          <div className="text-[10px] text-muted-foreground">Active</div>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                          <div className={`text-lg font-bold tabular-nums ${unused.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} data-testid="text-unused-count">{unused.length}</div>
                          <div className="text-[10px] text-muted-foreground">Unused</div>
                        </div>
                      </div>

                      {active.length > 0 && (
                        <div data-testid="equipment-active-section">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 rounded-full bg-emerald-500" />
                            <span className="text-xs font-semibold">Active Equipment</span>
                            <span className="text-[10px] text-muted-foreground">({totalUsage} total uses)</span>
                          </div>
                          <div className="space-y-1">
                            {active.sort((a, b) => b.usagePerUnit - a.usagePerUnit).map(equip => {
                              const maxUsage = Math.max(...active.map(e => e.usagePerUnit), 1);
                              const barWidth = Math.max((equip.usagePerUnit / maxUsage) * 100, 4);
                              const stressGradient = equip.stressLevel === 'high'
                                ? 'from-red-500 to-red-400' : equip.stressLevel === 'medium'
                                ? 'from-amber-500 to-amber-400' : 'from-emerald-500 to-emerald-400';
                              const stressLabel = equip.stressLevel === 'high'
                                ? 'Overloaded' : equip.stressLevel === 'medium'
                                ? 'Normal' : 'Light use';
                              const recommendation = equip.stressLevel === 'high' && equip.quantity <= 1
                                ? 'Consider adding more units'
                                : equip.stressLevel === 'high'
                                ? 'High demand — monitor wear'
                                : equip.changePercent >= 30
                                ? 'Demand rising — plan ahead'
                                : equip.changePercent <= -30
                                ? 'Declining use — investigate why'
                                : equip.stressLevel === 'medium'
                                ? 'Healthy usage level'
                                : 'Room for more utilization';

                              return (
                                <div key={equip.id} className="rounded-lg border border-border/50 p-3 space-y-2" data-testid={`equipment-stress-${equip.id}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                        equip.stressLevel === 'high' ? 'bg-red-500' : equip.stressLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                                      }`} />
                                      <span className="text-sm font-medium truncate">{equip.name}</span>
                                      {equip.quantity > 1 && <Badge variant="secondary" className="text-[10px] shrink-0">{equip.quantity} units</Badge>}
                                    </div>
                                    <Badge variant={equip.stressLevel === 'high' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                                      {stressLabel}
                                    </Badge>
                                  </div>
                                  <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
                                    <div className={`h-full rounded-full bg-gradient-to-r ${stressGradient} transition-all duration-700`} style={{ width: `${barWidth}%` }} />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="text-[11px] text-muted-foreground">
                                        <span className="font-semibold text-foreground">{equip.usagePerUnit}</span> uses/unit
                                      </span>
                                      <span className="text-[11px] text-muted-foreground">
                                        <span className="font-semibold text-foreground">{equip.totalUsage}</span> total
                                      </span>
                                    </div>
                                    {equip.changePercent !== 0 && (
                                      <span className={`flex items-center gap-0.5 text-[11px] font-bold ${
                                        equip.changePercent > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                                      }`}>
                                        {equip.changePercent > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {equip.changePercent > 0 ? '+' : ''}{equip.changePercent}% vs last month
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-[11px] px-2 py-1 rounded-md ${
                                    equip.stressLevel === 'high' ? 'bg-red-500/10 text-red-700 dark:text-red-300' :
                                    equip.changePercent >= 30 ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300' :
                                    equip.changePercent <= -30 ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' :
                                    'bg-muted/30 text-muted-foreground'
                                  }`}>
                                    <Lightbulb className="w-3 h-3 inline mr-1 -mt-0.5" />
                                    {recommendation}
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
                            <div className="w-1 h-4 rounded-full bg-amber-500" />
                            <span className="text-xs font-semibold">Unused Equipment</span>
                            <span className="text-[10px] text-muted-foreground">— no tracked usage in last 30 days</span>
                          </div>
                          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {unused.map(equip => (
                                <div key={equip.id} className="flex items-center gap-2 p-2 rounded-md bg-background/50" data-testid={`equipment-unused-${equip.id}`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-xs font-medium truncate block">{equip.name}</span>
                                    <span className="text-[10px] text-muted-foreground/60">{equip.category}{equip.quantity > 1 ? ` · ${equip.quantity}x` : ''}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-amber-700/70 dark:text-amber-300/70 mt-2">
                              These items have no workout data matched. Members may not be logging exercises for them, or exercise-to-equipment mappings need setup.
                            </p>
                          </div>
                        </div>
                      )}

                      {(highStress.length > 0 || rising.length > 0 || dropping.length > 0 || unused.length > active.length) && (
                        <div data-testid="equipment-recommendations">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 rounded-full bg-blue-500" />
                            <span className="text-xs font-semibold">Investment Recommendations</span>
                          </div>
                          <div className="space-y-1.5">
                            {highStress.map(e => (
                              <div key={`rec-high-${e.id}`} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                <span className="text-xs text-red-700 dark:text-red-300">
                                  <strong>Buy more {e.name}</strong> — {e.usagePerUnit} uses per unit is very high{e.quantity <= 1 ? '. You only have 1 unit' : ` across ${e.quantity} units`}. Adding units will reduce wait times and wear.
                                </span>
                              </div>
                            ))}
                            {rising.filter(e => e.stressLevel !== 'high').map(e => (
                              <div key={`rec-rise-${e.id}`} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <TrendingUp className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                <span className="text-xs text-blue-700 dark:text-blue-300">
                                  <strong>{e.name} demand growing</strong> — up {e.changePercent}% this month. If this trend continues, consider investing in additional units.
                                </span>
                              </div>
                            ))}
                            {dropping.map(e => (
                              <div key={`rec-drop-${e.id}`} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <TrendingDown className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <span className="text-xs text-amber-700 dark:text-amber-300">
                                  <strong>{e.name} declining</strong> — usage down {Math.abs(e.changePercent)}%. Consider if members prefer alternatives, or if equipment needs maintenance.
                                </span>
                              </div>
                            ))}
                            {unused.length > active.length && (
                              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <span className="text-xs text-amber-700 dark:text-amber-300">
                                  <strong>{unused.length} of {equipmentStress.equipment.length} equipment items are unused.</strong> Map exercises to them in Equipment Setup for better tracking, or consider if they should be replaced with in-demand equipment.
                                </span>
                              </div>
                            )}
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