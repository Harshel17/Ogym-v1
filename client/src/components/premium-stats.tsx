import { memo, useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Flame, Target, Calendar, TrendingUp, Check } from "lucide-react";

interface AnimatedStatCardProps {
  value: number;
  label: string;
  icon: "flame" | "target" | "calendar" | "trending";
  color: "orange" | "blue" | "green" | "purple";
  delay?: number;
  onClick?: () => void;
}

const iconMap = {
  flame: Flame,
  target: Target,
  calendar: Calendar,
  trending: TrendingUp,
};

const colorMap = {
  orange: "bg-orange-500 text-white",
  blue: "bg-blue-500 text-white",
  green: "bg-green-500 text-white",
  purple: "bg-purple-500 text-white",
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
  const iconBg = colorMap[color];

  return (
    <Card
      className="cursor-pointer border"
      onClick={onClick}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <CardContent className="flex flex-col items-center justify-center py-5">
        <div className={cn("p-2.5 rounded-lg mb-2", iconBg)}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-2xl font-bold tabular-nums">{displayValue}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
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
                    "w-full aspect-square rounded-md flex items-center justify-center text-xs font-medium",
                    isCompleted && !isFuture
                      ? "bg-green-500 text-white"
                      : isToday
                      ? "bg-primary/20 text-primary ring-1 ring-primary"
                      : isPast
                      ? "bg-red-100 dark:bg-red-900/30 text-red-500"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted && !isFuture && <Check className="w-3 h-3" />}
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
    <div className={cn("flex items-center gap-3 p-4 rounded-lg", hasStreak ? "bg-orange-50 dark:bg-orange-950/30" : "bg-muted/50", className)}>
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
