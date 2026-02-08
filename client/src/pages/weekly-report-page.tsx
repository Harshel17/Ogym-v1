import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Loader2, Dumbbell, Flame, Droplets, TrendingUp, Footprints, Moon, FileText, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ReportSection {
  title: string;
  icon: string;
  content: string;
  grade?: string;
}

interface ReportData {
  greeting: string;
  overallGrade: string;
  overallSummary: string;
  sections: ReportSection[];
  motivation: string;
  weeklyData: {
    workoutDays: number;
    avgDailyCalories: number;
    avgDailyProtein: number;
    attendanceDays: number;
    waterAvgOz: number;
    calorieGoal: number | null;
    proteinGoal: number | null;
    daysLogged: number;
    stepsAvg: number | null;
    sleepAvgMinutes: number | null;
    bodyWeight: { current: number | null; previous: number | null };
    bodyFat: { current: number | null; previous: number | null };
  };
}

interface ReportResponse {
  report: ReportData;
  rangeStart: string;
  rangeEnd: string;
  userName: string;
  gymName: string | null;
  createdAt: string;
}

const SECTION_ICONS: Record<string, typeof Dumbbell> = {
  dumbbell: Dumbbell,
  apple: Flame,
  trending: TrendingUp,
  droplets: Droplets,
  footprints: Footprints,
  sleep: Moon,
};

function GradeCircle({ grade }: { grade: string }) {
  const g = grade.charAt(0);
  const bg = (() => {
    if (g === 'A') return 'from-emerald-500 to-teal-600';
    if (g === 'B') return 'from-blue-500 to-indigo-600';
    if (g === 'C') return 'from-amber-500 to-orange-600';
    return 'from-red-500 to-rose-600';
  })();

  return (
    <div className={cn("w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center shadow-lg", bg)}>
      <span className="text-4xl font-bold text-white">{grade}</span>
    </div>
  );
}

function SectionGradeBadge({ grade }: { grade: string }) {
  const g = grade.charAt(0);
  const cls = (() => {
    if (g === 'A') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (g === 'B') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (g === 'C') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  })();
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", cls)}>{grade}</span>
  );
}

export default function WeeklyReportPage() {
  const [, params] = useRoute("/report/:token");
  const token = params?.token;
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<ReportResponse>({
    queryKey: ['/api/reports', token],
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your report...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="text-center max-w-sm px-4">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Report Not Found</h2>
          <p className="text-sm text-muted-foreground">This report link may have expired or doesn't exist.</p>
        </div>
      </div>
    );
  }

  const { report, rangeStart, rangeEnd, userName, gymName } = data;
  const wd = report.weeklyData;

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900" data-testid="page-weekly-report">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={handleBack} data-testid="button-back" className="text-slate-600 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </div>
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-medium mb-4">
            <FileText className="w-3 h-3" />
            Weekly Fitness Report
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
            {userName}'s Week in Review
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(rangeStart)} - {formatDate(rangeEnd)}
          </p>
          {gymName && (
            <p className="text-xs text-muted-foreground mt-1">{gymName}</p>
          )}
        </div>

        <div className="flex flex-col items-center mb-6">
          <GradeCircle grade={report.overallGrade} />
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 text-center max-w-xs">
            {report.overallSummary}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard icon={<Dumbbell className="w-4 h-4 text-indigo-500" />} label="Workout Days" value={`${wd.workoutDays}/7`} />
          <StatCard icon={<Flame className="w-4 h-4 text-orange-500" />} label="Avg Calories" value={wd.avgDailyCalories > 0 ? `${wd.avgDailyCalories}` : "N/A"} sub={wd.calorieGoal ? `Goal: ${wd.calorieGoal}` : undefined} />
          <StatCard icon={<TrendingUp className="w-4 h-4 text-red-500" />} label="Avg Protein" value={wd.avgDailyProtein > 0 ? `${wd.avgDailyProtein}g` : "N/A"} sub={wd.proteinGoal ? `Goal: ${wd.proteinGoal}g` : undefined} />
          <StatCard icon={<Droplets className="w-4 h-4 text-blue-500" />} label="Avg Water" value={wd.waterAvgOz > 0 ? `${wd.waterAvgOz}oz` : "N/A"} />
          {wd.stepsAvg !== null && wd.stepsAvg > 0 && (
            <StatCard icon={<Footprints className="w-4 h-4 text-green-500" />} label="Avg Steps" value={wd.stepsAvg.toLocaleString()} />
          )}
          {wd.sleepAvgMinutes !== null && wd.sleepAvgMinutes > 0 && (
            <StatCard icon={<Moon className="w-4 h-4 text-purple-500" />} label="Avg Sleep" value={`${Math.floor(wd.sleepAvgMinutes / 60)}h ${wd.sleepAvgMinutes % 60}m`} />
          )}
        </div>

        {wd.bodyWeight.current && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Body Progress</h3>
            <div className="flex gap-6">
              <div>
                <span className="text-xs text-muted-foreground">Weight</span>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{wd.bodyWeight.current}kg</p>
                {wd.bodyWeight.previous && (
                  <span className={cn("text-xs", wd.bodyWeight.current! < wd.bodyWeight.previous ? "text-green-500" : "text-red-500")}>
                    {wd.bodyWeight.current! < wd.bodyWeight.previous ? "-" : "+"}{Math.abs(wd.bodyWeight.current! - wd.bodyWeight.previous).toFixed(1)}kg
                  </span>
                )}
              </div>
              {wd.bodyFat.current && (
                <div>
                  <span className="text-xs text-muted-foreground">Body Fat</span>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{wd.bodyFat.current}%</p>
                  {wd.bodyFat.previous && (
                    <span className={cn("text-xs", wd.bodyFat.current! < wd.bodyFat.previous ? "text-green-500" : "text-red-500")}>
                      {wd.bodyFat.current! < wd.bodyFat.previous ? "-" : "+"}{Math.abs(wd.bodyFat.current! - wd.bodyFat.previous).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {report.sections.length > 0 && (
          <div className="space-y-3 mb-6">
            {report.sections.map((section, i) => {
              const IconComponent = SECTION_ICONS[section.icon] || FileText;
              return (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20">
                        <IconComponent className="w-4 h-4 text-indigo-500" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{section.title}</h3>
                    </div>
                    {section.grade && <SectionGradeBadge grade={section.grade} />}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{section.content}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4 text-center text-white mb-6">
          <p className="text-sm font-medium italic">"{report.motivation}"</p>
        </div>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Powered by OGym - Your Fitness Companion
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
