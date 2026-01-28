import { memo, useMemo } from "react";
import { useAnimatedCounter } from "@/hooks/use-animated-counter";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Flame, Target, Calendar, TrendingUp } from "lucide-react";

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
  orange: {
    gradient: "from-orange-500 to-red-500",
    shadow: "shadow-orange-500/25",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-600 dark:text-orange-400",
  },
  blue: {
    gradient: "from-blue-500 to-indigo-500",
    shadow: "shadow-blue-500/25",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-600 dark:text-blue-400",
  },
  green: {
    gradient: "from-green-500 to-emerald-500",
    shadow: "shadow-green-500/25",
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-600 dark:text-green-400",
  },
  purple: {
    gradient: "from-purple-500 to-pink-500",
    shadow: "shadow-purple-500/25",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-600 dark:text-purple-400",
  },
};

export const AnimatedStatCard = memo(function AnimatedStatCard({
  value,
  label,
  icon,
  color,
  delay = 0,
  onClick,
}: AnimatedStatCardProps) {
  const animatedValue = useAnimatedCounter(value, 800, delay);
  const Icon = iconMap[icon];
  const colors = colorMap[color];

  return (
    <Card
      className="stat-card cursor-pointer group overflow-hidden relative hover:shadow-lg"
      onClick={onClick}
      data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <CardContent className="flex flex-col items-center justify-center py-5 relative z-10">
        <div
          className={cn(
            "p-3 rounded-xl bg-gradient-to-br text-white mb-3 shadow-lg",
            colors.gradient,
            colors.shadow
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-3xl font-bold font-display tabular-nums">
          {animatedValue}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none",
          colors.bg
        )}
      />
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
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Progress
        </span>
        <span
          className={cn(
            "text-xs font-semibold",
            isComplete ? "text-green-600 dark:text-green-400" : "text-primary"
          )}
        >
          {completed}/{total}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            isComplete
              ? "bg-gradient-to-r from-green-500 to-emerald-400"
              : "bg-gradient-to-r from-primary to-indigo-400"
          )}
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
    <Card className={cn("overflow-hidden", className)} data-testid="card-weekly-progress">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">This Week</span>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{passedDaysCount} days
          </span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {weekDates.map((dateStr, index) => {
            const isPast = dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const isFuture = dateStr > todayStr;
            const isCompleted = completedDatesSet.has(dateStr);

            return (
              <div
                key={dateStr}
                className="flex flex-col items-center gap-1.5 flex-1"
              >
                <div
                  className={cn(
                    "w-full aspect-square rounded-lg flex items-center justify-center text-xs font-medium",
                    isCompleted && !isFuture
                      ? "bg-gradient-to-br from-green-500 to-emerald-400 text-white shadow-sm"
                      : isToday
                      ? "bg-primary/20 text-primary ring-2 ring-primary"
                      : isPast
                      ? "bg-red-100 dark:bg-red-900/30 text-red-500"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted && !isFuture && (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px]",
                    isToday ? "font-bold text-primary" : "text-muted-foreground"
                  )}
                >
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
  const animatedStreak = useAnimatedCounter(streak, 1000, 200);
  const hasStreak = streak > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl",
        hasStreak
          ? "bg-gradient-to-r from-orange-500/10 to-red-500/10"
          : "bg-muted/50",
        className
      )}
    >
      <div
        className={cn(
          "relative w-14 h-14 rounded-full flex items-center justify-center",
          hasStreak ? "bg-gradient-to-br from-orange-500 to-red-500" : "bg-muted"
        )}
      >
        <Flame
          className={cn(
            "w-7 h-7",
            hasStreak ? "text-white" : "text-muted-foreground"
          )}
        />
        {hasStreak && (
          <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-orange-500 to-red-500 opacity-30 blur-md -z-10" />
        )}
      </div>
      <div>
        <p className="text-3xl font-bold font-display tabular-nums">
          {animatedStreak}
        </p>
        <p className="text-sm text-muted-foreground">
          {hasStreak ? "Day Streak" : "Start your streak!"}
        </p>
      </div>
    </div>
  );
});
