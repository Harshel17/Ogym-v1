import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Target, Calendar, Dumbbell, 
  Loader2, Shield, ChevronRight 
} from "lucide-react";
import { Link } from "wouter";
import { useBackNavigation } from "@/hooks/use-back-navigation";
import { format, parseISO, isWithinInterval, isPast, isFuture } from "date-fns";

type TrainingPhase = {
  id: number;
  name: string;
  goalType: string;
  startDate: string;
  endDate: string;
  cycleId: number;
  cycleName: string | null;
  notes: string | null;
};

const goalTypeLabels: Record<string, string> = {
  cut: "Cut",
  bulk: "Bulk",
  strength: "Strength",
  endurance: "Endurance",
  rehab: "Rehab",
  general: "General"
};

const goalTypeColors: Record<string, string> = {
  cut: "bg-red-500/10 text-red-700 dark:text-red-400",
  bulk: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  strength: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  endurance: "bg-green-500/10 text-green-700 dark:text-green-400",
  rehab: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  general: "bg-gray-500/10 text-gray-700 dark:text-gray-400"
};

function getPhaseStatus(startDate: string, endDate: string): { label: string; color: string } {
  const today = new Date();
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  
  if (isWithinInterval(today, { start, end })) {
    return { label: "Active", color: "bg-green-500/10 text-green-700 dark:text-green-400" };
  } else if (isPast(end)) {
    return { label: "Completed", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" };
  } else if (isFuture(start)) {
    return { label: "Upcoming", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" };
  }
  return { label: "Unknown", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400" };
}

export default function MemberPhasesPage() {
  const { user } = useAuth();
  const { goBack } = useBackNavigation();

  const { data: phases = [], isLoading } = useQuery<TrainingPhase[]>({
    queryKey: ["/api/training-phases/me"],
  });

  if (user?.role !== "member") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Members Only</h2>
        <p className="text-muted-foreground">This page is only for gym members.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activePhases = phases.filter(p => {
    const today = new Date();
    return isWithinInterval(today, { start: parseISO(p.startDate), end: parseISO(p.endDate) });
  });
  
  const pastPhases = phases.filter(p => isPast(parseISO(p.endDate)));
  const upcomingPhases = phases.filter(p => isFuture(parseISO(p.startDate)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" data-testid="button-back" onClick={goBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold font-display text-foreground">Training Phases</h2>
          <p className="text-muted-foreground">Your training phases set by your trainer</p>
        </div>
      </div>

      {phases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Training Phases Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Your trainer hasn't created any training phases for you yet. 
              Training phases help track your progress toward specific goals like cutting, bulking, or strength training.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activePhases.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Active Phases
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {activePhases.map(phase => {
                  const status = getPhaseStatus(phase.startDate, phase.endDate);
                  return (
                    <Link key={phase.id} href={`/progress/phases/${phase.id}`}>
                      <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 h-full" data-testid={`card-phase-${phase.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg">{phase.name}</CardTitle>
                            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={goalTypeColors[phase.goalType] || goalTypeColors.general} data-testid={`badge-goal-${phase.id}`}>
                              {goalTypeLabels[phase.goalType] || phase.goalType}
                            </Badge>
                            <Badge className={status.color} data-testid={`badge-status-${phase.id}`}>
                              {status.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(parseISO(phase.startDate), "MMM d")} - {format(parseISO(phase.endDate), "MMM d, yyyy")}
                            </span>
                          </div>
                          {phase.cycleName && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Dumbbell className="w-4 h-4" />
                              <span>{phase.cycleName}</span>
                            </div>
                          )}
                          {phase.notes && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{phase.notes}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {upcomingPhases.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Upcoming Phases
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingPhases.map(phase => {
                  const status = getPhaseStatus(phase.startDate, phase.endDate);
                  return (
                    <Link key={phase.id} href={`/progress/phases/${phase.id}`}>
                      <Card className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 h-full" data-testid={`card-phase-${phase.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg">{phase.name}</CardTitle>
                            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={goalTypeColors[phase.goalType] || goalTypeColors.general}>
                              {goalTypeLabels[phase.goalType] || phase.goalType}
                            </Badge>
                            <Badge className={status.color}>
                              {status.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(parseISO(phase.startDate), "MMM d")} - {format(parseISO(phase.endDate), "MMM d, yyyy")}
                            </span>
                          </div>
                          {phase.cycleName && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Dumbbell className="w-4 h-4" />
                              <span>{phase.cycleName}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {pastPhases.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-gray-400" />
                Past Phases
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {pastPhases.map(phase => {
                  const status = getPhaseStatus(phase.startDate, phase.endDate);
                  return (
                    <Link key={phase.id} href={`/progress/phases/${phase.id}`}>
                      <Card className="cursor-pointer transition-all hover:shadow-lg opacity-75 h-full" data-testid={`card-phase-${phase.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg">{phase.name}</CardTitle>
                            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={goalTypeColors[phase.goalType] || goalTypeColors.general}>
                              {goalTypeLabels[phase.goalType] || phase.goalType}
                            </Badge>
                            <Badge className={status.color}>
                              {status.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {format(parseISO(phase.startDate), "MMM d")} - {format(parseISO(phase.endDate), "MMM d, yyyy")}
                            </span>
                          </div>
                          {phase.cycleName && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Dumbbell className="w-4 h-4" />
                              <span>{phase.cycleName}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
