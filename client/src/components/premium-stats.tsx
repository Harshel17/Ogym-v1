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
    iconBg: "bg-orange-500",
    hoverBg: "hover:bg-orange-50 dark:hover:bg-orange-950/20",
    activeBg: "active:bg-orange-100 dark:active:bg-orange-950/30",
  },
  blue: {
    iconBg: "bg-blue-500",
    hoverBg: "hover:bg-blue-50 dark:hover:bg-blue-950/20",
    activeBg: "active:bg-blue-100 dark:active:bg-blue-950/30",
  },
  green: {
    iconBg: "bg-green-500",
    hoverBg: "hover:bg-green-50 dark:hover:bg-green-950/20",
    activeBg: "active:bg-green-100 dark:active:bg-green-950/30",
  },
  purple: {
    iconBg: "bg-purple-500",
    hoverBg: "hover:bg-purple-50 dark:hover:bg-purple-950/20",
    activeBg: "active:bg-purple-100 dark:active:bg-purple-950/30",
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
      <CardContent className="flex flex-col items-center justify-center py-5">
        <div className={cn("p-2.5 rounded-xl text-white mb-2", colors.iconBg)}>
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
  delay?: number;
}

export const CalorieProgressCard = memo(function CalorieProgressCard({
  current,
  target,
  delay = 0,
}: CalorieProgressCardProps) {
  const displayValue = useSimpleCounter(current, delay);
  const effectiveTarget = target > 0 ? target : 2000;
  const percentage = Math.min((current / effectiveTarget) * 100, 100);
  const isOver = current > effectiveTarget;
  
  // SVG circle calculations
  const size = 80;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Card
      className={cn(
        "cursor-pointer border transition-transform duration-150 ease-out",
        "hover:scale-[1.02] active:scale-[0.98]",
        "hover:bg-green-50 dark:hover:bg-green-950/20",
        "active:bg-green-100 dark:active:bg-green-950/30"
      )}
      data-testid="stat-card-calories"
    >
      <CardContent className="flex flex-col items-center justify-center py-3">
        {/* Circular Progress Ring with glow */}
        <div className="relative mb-1">
          {/* Glow effect */}
          <div 
            className={cn(
              "absolute inset-0 rounded-full blur-md opacity-40 transition-opacity duration-500",
              isOver ? "bg-orange-400" : "bg-emerald-400"
            )}
            style={{ transform: 'scale(0.85)' }}
          />
          <svg
            width={size}
            height={size}
            className="transform -rotate-90 relative z-10"
          >
            {/* Background circle with subtle pattern */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={strokeWidth}
              opacity={0.5}
            />
            {/* Secondary track for depth */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius - 1}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth={1}
              opacity={0.3}
            />
            {/* Progress circle with gradient */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={isOver ? "url(#calorieOverGradient)" : "url(#calorieProgressGradient)"}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
              style={{
                filter: isOver 
                  ? 'drop-shadow(0 0 4px rgba(249, 115, 22, 0.6))' 
                  : 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.5))'
              }}
            />
            {/* Gradient definitions */}
            <defs>
              <linearGradient id="calorieProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
              <linearGradient id="calorieOverGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center content with subtle background */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <div className={cn(
              "flex flex-col items-center justify-center rounded-full",
              "w-14 h-14 bg-background/80 backdrop-blur-sm"
            )}>
              <span className={cn(
                "text-xl font-bold tabular-nums leading-none tracking-tight",
                isOver ? "text-orange-500" : "text-foreground"
              )}>
                {displayValue}
              </span>
              <span className="text-[8px] text-muted-foreground mt-0.5 uppercase tracking-wider">kcal</span>
            </div>
          </div>
        </div>
        <p className="text-xs font-medium text-muted-foreground mt-1">Today's Calories</p>
        <p className={cn(
          "text-[10px] tabular-nums",
          isOver ? "text-orange-500/80" : "text-muted-foreground/60"
        )}>
          {isOver ? `+${current - effectiveTarget} over` : `${effectiveTarget - current} left`}
        </p>
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
