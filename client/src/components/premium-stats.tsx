import { memo, useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Flame, Target, Calendar, TrendingUp, Check, Apple } from "lucide-react";

interface AnimatedStatCardProps {
  value: number;
  label: string;
  icon: "flame" | "target" | "calendar" | "trending" | "apple";
  color: "orange" | "blue" | "green" | "purple";
  delay?: number;
  onClick?: () => void;
}

const iconMap = {
  flame: Flame,
  target: Target,
  calendar: Calendar,
  trending: TrendingUp,
  apple: Apple,
};

const colorConfig = {
  orange: {
    iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
    hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-950/20",
    activeBg: "active:bg-amber-100 dark:active:bg-amber-950/30",
  },
  blue: {
    iconBg: "bg-gradient-to-br from-sky-400 to-blue-500",
    hoverBg: "hover:bg-sky-50 dark:hover:bg-sky-950/20",
    activeBg: "active:bg-sky-100 dark:active:bg-sky-950/30",
  },
  green: {
    iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
    hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
    activeBg: "active:bg-emerald-100 dark:active:bg-emerald-950/30",
  },
  purple: {
    iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
    hoverBg: "hover:bg-violet-50 dark:hover:bg-violet-950/20",
    activeBg: "active:bg-violet-100 dark:active:bg-violet-950/30",
  },
};

function useSimpleCounter(target: number, delay: number = 0): number {
  const [value, setValue] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setValue(target);
    }, delay + 50);
    return () => clearTimeout(timer);
  }, [target, delay]);
  
  return value;
}

export const AnimatedStatCard = memo(function AnimatedStatCard({
  value,
  label,
  icon,
  color,
  delay = 0,
  onClick,
}: AnimatedStatCardProps) {
  const displayValue = useSimpleCounter(value, delay);
  const Icon = iconMap[icon];
  const colors = colorConfig[color];

  return (
    <Card
      className={cn(
        "cursor-pointer border transition-transform duration-150 ease-out",
        "hover:scale-[1.02] active:scale-[0.98]",
        colors.hoverBg,
        colors.activeBg
      )}
      onClick={onClick}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <CardContent className="flex flex-col items-center justify-center h-[120px] py-0">
        <div className={cn("p-2.5 rounded-full text-white mb-2 shadow-sm", colors.iconBg)}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-2xl font-bold tabular-nums">{displayValue}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
});

interface CalorieProgressCardProps {
  current: number;
  target: number;
  currentProtein?: number;
  targetProtein?: number;
  delay?: number;
}

export const CalorieProgressCard = memo(function CalorieProgressCard({
  current,
  target,
  currentProtein = 0,
  targetProtein = 0,
  delay = 0,
}: CalorieProgressCardProps) {
  const displayValue = useSimpleCounter(current, delay);
  const effectiveTarget = target > 0 ? target : 2000;
  const caloriePercentage = Math.min((current / effectiveTarget) * 100, 100);
  const isCaloriesOver = current > effectiveTarget;
  
  // Protein calculations - show ring if there's any protein data or a target set
  const effectiveProteinTarget = targetProtein > 0 ? targetProtein : (currentProtein > 0 ? 100 : 0);
  const showProteinRing = effectiveProteinTarget > 0 || currentProtein > 0;
  const proteinPercentage = effectiveProteinTarget > 0 ? Math.min((currentProtein / effectiveProteinTarget) * 100, 100) : 0;
  const isProteinOver = effectiveProteinTarget > 0 && currentProtein > effectiveProteinTarget;
  
  // SVG circle calculations - dual ring layout (sized to match streak icon)
  const size = 56;
  const outerStrokeWidth = 5;
  const innerStrokeWidth = 3;
  const gap = 2;
  const outerRadius = (size - outerStrokeWidth) / 2;
  const innerRadius = outerRadius - outerStrokeWidth / 2 - gap - innerStrokeWidth / 2;
  
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  
  const outerStrokeDashoffset = outerCircumference - (caloriePercentage / 100) * outerCircumference;
  const innerStrokeDashoffset = innerCircumference - (proteinPercentage / 100) * innerCircumference;

  // Color scheme: Emerald for calories, Blue for protein
  const calorieColor = isCaloriesOver ? "#ef4444" : "#10b981";
  const proteinColor = isProteinOver ? "#ef4444" : "#3b82f6";

  return (
    <Card
      className={cn(
        "cursor-pointer border transition-transform duration-150 ease-out",
        "hover:scale-[1.02] active:scale-[0.98]",
        "hover:bg-emerald-50 dark:hover:bg-emerald-950/20",
        "active:bg-emerald-100 dark:active:bg-emerald-950/30"
      )}
      data-testid="stat-card-calories"
    >
      <CardContent className="flex flex-col items-center justify-center h-[120px] py-0">
        {/* Dual Ring Progress */}
        <div className="relative">
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            {/* Outer ring background (calories) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={outerRadius}
              fill="none"
              stroke="currentColor"
              className="text-muted/30"
              strokeWidth={outerStrokeWidth}
            />
            {/* Outer ring progress (calories) */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={outerRadius}
              fill="none"
              stroke={calorieColor}
              strokeWidth={outerStrokeWidth}
              strokeLinecap="round"
              strokeDasharray={outerCircumference}
              strokeDashoffset={outerStrokeDashoffset}
              className="transition-all duration-700 ease-out"
            />
            
            {/* Inner ring background (protein) */}
            {showProteinRing && (
              <>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={innerRadius}
                  fill="none"
                  stroke="currentColor"
                  className="text-muted/30"
                  strokeWidth={innerStrokeWidth}
                />
                {/* Inner ring progress (protein) */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={innerRadius}
                  fill="none"
                  stroke={proteinColor}
                  strokeWidth={innerStrokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={innerCircumference}
                  strokeDashoffset={innerStrokeDashoffset}
                  className="transition-all duration-700 ease-out"
                />
              </>
            )}
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(
              "text-base font-bold tabular-nums leading-none",
              isCaloriesOver && "text-red-500"
            )}>
              {displayValue}
            </span>
            <span className="text-[8px] text-muted-foreground mt-0.5">kcal</span>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-1">Today's Calories</p>
        
        {/* Protein info */}
        {showProteinRing && (
          <p className={cn(
            "text-[10px] tabular-nums",
            isProteinOver ? "text-red-500" : "text-blue-500"
          )}>
            Protein: {currentProtein}g / {effectiveProteinTarget}g
          </p>
        )}
      </CardContent>
    </Card>
  );
});

interface CalorieProgressStripProps {
  current: number;
  target: number;
  className?: string;
}

export const CalorieProgressStrip = memo(function CalorieProgressStrip({
  current,
  target,
  className,
}: CalorieProgressStripProps) {
  const effectiveTarget = target > 0 ? target : 2000;
  const percentage = Math.min((current / effectiveTarget) * 100, 100);
  const isOver = current > effectiveTarget;

  return (
    <Card className={cn("", className)} data-testid="calorie-progress-strip">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Calories</span>
          <span className={cn("text-sm font-semibold tabular-nums", isOver ? "text-orange-500" : "")}>
            {current}/{effectiveTarget}
          </span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              isOver 
                ? "bg-gradient-to-r from-orange-400 to-red-500" 
                : "bg-gradient-to-r from-green-400 to-emerald-500"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
});

interface WorkoutProgressBarProps {
  completed: number;
  total: number;
  className?: string;
}

export const WorkoutProgressBar = memo(function WorkoutProgressBar({
  completed,
  total,
  className,
}: WorkoutProgressBarProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const isComplete = completed === total && total > 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Progress</span>
        <span className={cn("text-xs font-medium", isComplete ? "text-green-600" : "")}>
          {completed}/{total}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", isComplete ? "bg-green-500" : "bg-primary")}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});

interface WeeklyProgressProps {
  calendarDays?: { date: string; focusLabel: string }[];
  className?: string;
}

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const WeeklyProgress = memo(function WeeklyProgress({ calendarDays = [], className }: WeeklyProgressProps) {
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  
  const { weekDates, todayStr, completedDatesSet, completedCount, passedDaysCount } = useMemo(() => {
    const today = new Date();
    const todayString = formatLocalDate(today);
    
    const getStartOfWeek = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    };
    
    const weekStart = getStartOfWeek(today);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(formatLocalDate(d));
    }
    
    const completedSet = new Set(calendarDays.map(d => d.date));
    const completed = dates.filter(d => completedSet.has(d) && d <= todayString).length;
    const passed = dates.filter(d => d <= todayString).length;
    
    return { weekDates: dates, todayStr: todayString, completedDatesSet: completedSet, completedCount: completed, passedDaysCount: passed };
  }, [calendarDays]);

  return (
    <Card className={cn("border", className)} data-testid="card-weekly-progress">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">This Week</span>
          <span className="text-xs text-muted-foreground">{completedCount}/{passedDaysCount} days</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {weekDates.map((dateStr, index) => {
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const isCompleted = completedDatesSet.has(dateStr);

            return (
              <div key={dateStr} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={cn(
                    "w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium",
                    isCompleted && !isFuture
                      ? "bg-green-500 text-white"
                      : isToday
                      ? "bg-primary/20 text-primary ring-2 ring-primary"
                      : isPast
                      ? "bg-red-100 dark:bg-red-900/30 text-red-500"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted && !isFuture && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={cn("text-[10px]", isToday ? "font-bold text-primary" : "text-muted-foreground")}>
                  {dayLabels[index]}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

interface StreakDisplayProps {
  streak: number;
  className?: string;
}

export const StreakDisplay = memo(function StreakDisplay({ streak, className }: StreakDisplayProps) {
  const displayStreak = useSimpleCounter(streak, 200);
  const hasStreak = streak > 0;

  return (
    <div className={cn("flex items-center gap-3 p-4 rounded-xl", hasStreak ? "bg-orange-50 dark:bg-orange-950/30" : "bg-muted/50", className)}>
      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", hasStreak ? "bg-orange-500" : "bg-muted")}>
        <Flame className={cn("w-6 h-6", hasStreak ? "text-white" : "text-muted-foreground")} />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums">{displayStreak}</p>
        <p className="text-sm text-muted-foreground">{hasStreak ? "Day Streak" : "Start your streak!"}</p>
      </div>
    </div>
  );
});
