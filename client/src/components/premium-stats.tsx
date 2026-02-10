import { memo, useMemo, useState, useEffect, useRef } from "react";
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
    ringColor: "#f97316",
    ringBgColor: "rgba(249, 115, 22, 0.12)",
    glow: "shadow-orange-500/10",
  },
  blue: {
    iconBg: "bg-gradient-to-br from-sky-400 to-blue-500",
    ringColor: "#3b82f6",
    ringBgColor: "rgba(59, 130, 246, 0.12)",
    glow: "shadow-blue-500/10",
  },
  green: {
    iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
    ringColor: "#10b981",
    ringBgColor: "rgba(16, 185, 129, 0.12)",
    glow: "shadow-emerald-500/10",
  },
  purple: {
    iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
    ringColor: "#8b5cf6",
    ringBgColor: "rgba(139, 92, 246, 0.12)",
    glow: "shadow-purple-500/10",
  },
};

function useAnimatedCounter(target: number, delay: number = 0, duration: number = 600): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    
    if (target === 0) { setValue(0); return; }
    
    const timeout = setTimeout(() => {
      const start = performance.now();
      
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      
      rafRef.current = requestAnimationFrame(animate);
    }, delay);
    
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, delay, duration]);
  
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
  const displayValue = useAnimatedCounter(value, delay);
  const Icon = iconMap[icon];
  const colors = colorConfig[color];

  const size = 72;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const maxValue = icon === "flame" ? Math.max(value, 30) : Math.max(value, 7);
  const percentage = Math.min((value / maxValue) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Card
      className={cn(
        "cursor-pointer bg-card/70 backdrop-blur-sm transition-all duration-300 ease-out",
        "hover:scale-[1.02] active:scale-[0.98]",
        colors.glow
      )}
      onClick={onClick}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <CardContent className="flex flex-col items-center justify-center h-[130px] py-0">
        <div className="relative mb-2">
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colors.ringBgColor}
              strokeWidth={strokeWidth}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={colors.ringColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
              style={{ filter: `drop-shadow(0 0 4px ${colors.ringColor}40)` }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn("p-2.5 rounded-xl text-white shadow-sm", colors.iconBg)}>
              <Icon className={cn("w-4 h-4", icon === "flame" && value > 0 && "streak-flame")} />
            </div>
          </div>
        </div>
        <p className="text-2xl font-bold tabular-nums leading-none">{displayValue}</p>
        <p className="text-[10px] text-muted-foreground mt-1 font-semibold uppercase tracking-wider">{label}</p>
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
  const displayValue = useAnimatedCounter(current, delay);
  const effectiveTarget = target > 0 ? target : 2000;
  const caloriePercentage = Math.min((current / effectiveTarget) * 100, 100);
  const isCaloriesOver = current > effectiveTarget;
  
  const effectiveProteinTarget = targetProtein > 0 ? targetProtein : (currentProtein > 0 ? 100 : 0);
  const showProteinRing = effectiveProteinTarget > 0 || currentProtein > 0;
  const proteinPercentage = effectiveProteinTarget > 0 ? Math.min((currentProtein / effectiveProteinTarget) * 100, 100) : 0;
  const isProteinOver = effectiveProteinTarget > 0 && currentProtein > effectiveProteinTarget;
  
  const size = 72;
  const outerStrokeWidth = 4;
  const innerStrokeWidth = 3;
  const gap = 3;
  const outerRadius = (size - outerStrokeWidth) / 2;
  const innerRadius = outerRadius - outerStrokeWidth / 2 - gap - innerStrokeWidth / 2;
  
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  
  const outerStrokeDashoffset = outerCircumference - (caloriePercentage / 100) * outerCircumference;
  const innerStrokeDashoffset = innerCircumference - (proteinPercentage / 100) * innerCircumference;

  const calorieColor = isCaloriesOver ? "#ef4444" : "#10b981";
  const proteinColor = isProteinOver ? "#ef4444" : "#3b82f6";

  return (
    <Card
      className={cn(
        "cursor-pointer bg-card/70 backdrop-blur-sm transition-all duration-300 ease-out",
        "hover:scale-[1.02] active:scale-[0.98]",
        "shadow-emerald-500/10"
      )}
      data-testid="stat-card-calories"
    >
      <CardContent className="flex flex-col items-center justify-center h-[130px] py-0">
        <div className="relative mb-2">
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={outerRadius}
              fill="none"
              stroke="currentColor"
              className="text-muted/20"
              strokeWidth={outerStrokeWidth}
            />
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
              className="transition-all duration-1000 ease-out"
              style={{ filter: `drop-shadow(0 0 4px ${calorieColor}40)` }}
            />
            
            {showProteinRing && (
              <>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={innerRadius}
                  fill="none"
                  stroke="currentColor"
                  className="text-muted/20"
                  strokeWidth={innerStrokeWidth}
                />
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
                  className="transition-all duration-1000 ease-out"
                  style={{ filter: `drop-shadow(0 0 3px ${proteinColor}30)` }}
                />
              </>
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(
              "text-sm font-bold tabular-nums leading-none",
              isCaloriesOver && "text-red-500"
            )}>
              {displayValue}
            </span>
            <span className="text-[8px] text-muted-foreground mt-0.5 font-medium">kcal</span>
          </div>
        </div>
        
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Today's Calories</p>
        
        {showProteinRing && (
          <p className={cn(
            "text-[10px] tabular-nums mt-0.5 font-medium",
            isProteinOver ? "text-red-500" : "text-blue-500"
          )}>
            {currentProtein}g / {effectiveProteinTarget}g protein
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
  const rawPercentage = total > 0 ? (completed / total) * 100 : 0;
  const percentage = Math.min(Math.max(rawPercentage, 0), 100);
  const isComplete = completed === total && total > 0;

  const size = 52;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const strokeColor = isComplete ? "#10b981" : "hsl(var(--primary))";

  return (
    <div className={cn("flex items-center gap-3", className)} data-testid="workout-progress-ring">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: isComplete ? `drop-shadow(0 0 4px #10b98140)` : undefined }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {isComplete ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <span className="text-[11px] font-bold tabular-nums" data-testid="text-workout-progress-percent">{Math.round(percentage)}%</span>
          )}
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Progress</span>
        <span className={cn("text-sm font-bold tabular-nums", isComplete ? "text-green-500" : "text-foreground")}>
          {completed}/{total}
        </span>
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
    <Card className={cn("bg-card/70 backdrop-blur-sm", className)} data-testid="card-weekly-progress">
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold">This Week</span>
          <span className="text-[10px] text-muted-foreground font-semibold tabular-nums uppercase tracking-wider">{completedCount}/{passedDaysCount} days</span>
        </div>
        <div className="flex items-center justify-between gap-1.5">
          {weekDates.map((dateStr, index) => {
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const isCompleted = completedDatesSet.has(dateStr);

            return (
              <div key={dateStr} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={cn(
                    "w-full aspect-square rounded-xl flex items-center justify-center text-xs font-semibold transition-all duration-300",
                    isCompleted && !isFuture
                      ? "bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-sm shadow-green-500/25"
                      : isToday
                      ? "bg-primary/15 text-primary ring-2 ring-primary/40"
                      : isPast
                      ? "bg-muted/50 text-muted-foreground/50"
                      : "bg-muted/25 text-muted-foreground/30"
                  )}
                >
                  {isCompleted && !isFuture ? <Check className="w-3.5 h-3.5" /> : null}
                </div>
                <span className={cn("text-[10px] font-semibold", isToday ? "text-primary" : "text-muted-foreground/60")}>
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
  const displayStreak = useAnimatedCounter(streak, 200);
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
