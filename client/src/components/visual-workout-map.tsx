import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BodyMap, muscleToRegions, regionToMuscle } from "@/components/body-map";
import { Dumbbell, Heart, Target, Calendar, Zap, Flame } from "lucide-react";

interface WorkoutItem {
  id: number;
  exerciseName: string;
  muscleType: string;
  bodyPart: string;
  dayIndex: number;
  sets: number;
  reps: number;
  weight?: string;
  exerciseType?: string;
  durationMinutes?: number;
  distanceKm?: string;
}

interface VisualWorkoutMapProps {
  workoutItems: WorkoutItem[];
  cycleLength: number;
  dayLabels?: Record<number, string>;
}

interface MuscleExerciseData {
  region: string;
  muscleName: string;
  exercises: {
    name: string;
    dayIndex: number;
    sets: number;
    reps: number;
    weight?: string;
    exerciseType?: string;
    durationMinutes?: number;
    distanceKm?: string;
  }[];
}

export function VisualWorkoutMap({ workoutItems, cycleLength, dayLabels }: VisualWorkoutMapProps) {
  const [selectedDay, setSelectedDay] = useState<number | "all">("all");
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    if (selectedDay === "all") return workoutItems;
    return workoutItems.filter(item => item.dayIndex === selectedDay);
  }, [workoutItems, selectedDay]);

  const highlightedRegions = useMemo(() => {
    const regions = new Set<string>();
    filteredItems.forEach(item => {
      const muscleRegions = muscleToRegions[item.muscleType] || [];
      muscleRegions.forEach(region => regions.add(region));
    });
    return Array.from(regions);
  }, [filteredItems]);

  const muscleExerciseData = useMemo((): MuscleExerciseData | null => {
    if (!selectedMuscle) return null;
    
    const muscleName = regionToMuscle[selectedMuscle] || selectedMuscle;
    const relevantItems = filteredItems.filter(item => {
      const regions = muscleToRegions[item.muscleType] || [];
      return regions.includes(selectedMuscle);
    });

    return {
      region: selectedMuscle,
      muscleName,
      exercises: relevantItems.map(item => ({
        name: item.exerciseName,
        dayIndex: item.dayIndex,
        sets: item.sets,
        reps: item.reps,
        weight: item.weight,
        exerciseType: item.exerciseType,
        durationMinutes: item.durationMinutes,
        distanceKm: item.distanceKm
      }))
    };
  }, [selectedMuscle, filteredItems]);

  const handleMuscleClick = (region: string) => {
    if (selectedMuscle === region) {
      setSelectedMuscle(null);
    } else {
      setSelectedMuscle(region);
    }
  };

  const getDayLabel = (dayIndex: number) => {
    if (dayLabels && dayLabels[dayIndex]) {
      return dayLabels[dayIndex];
    }
    return `Day ${dayIndex + 1}`;
  };

  const getExerciseIcon = (exerciseType?: string, muscleType?: string) => {
    if (exerciseType === 'cardio') {
      return <Heart className="w-4 h-4 text-rose-500" />;
    }
    if (muscleType === 'Core' || muscleType === 'Abs') {
      return <Target className="w-4 h-4 text-amber-500" />;
    }
    return <Dumbbell className="w-4 h-4 text-blue-500" />;
  };

  const totalExercises = filteredItems.length;
  const uniqueMuscles = highlightedRegions.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          size="sm"
          variant={selectedDay === "all" ? "default" : "outline"}
          onClick={() => { setSelectedDay("all"); setSelectedMuscle(null); }}
          data-testid="button-day-all"
          className="min-w-[70px]"
        >
          All Days
        </Button>
        {Array.from({ length: cycleLength }, (_, i) => (
          <Button
            key={i}
            size="sm"
            variant={selectedDay === i ? "default" : "outline"}
            onClick={() => { setSelectedDay(i); setSelectedMuscle(null); }}
            data-testid={`button-day-${i + 1}`}
            className="min-w-[60px]"
          >
            Day {i + 1}
          </Button>
        ))}
      </div>

      <div className="relative rounded-xl bg-gradient-to-b from-muted/30 to-muted/10 p-4 border border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.05),transparent_70%)] rounded-xl pointer-events-none" />
        
        <BodyMap
          highlightedMuscles={highlightedRegions}
          onMuscleClick={handleMuscleClick}
          selectedMuscle={selectedMuscle}
        />
        
        {highlightedRegions.length === 0 && (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
              <Zap className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">
              {selectedDay === "all" 
                ? "No exercises in this cycle" 
                : "Rest day - no exercises scheduled"}
            </p>
          </div>
        )}

        {highlightedRegions.length > 0 && (
          <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-border/30">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-lg font-semibold text-foreground">
                <Flame className="w-4 h-4 text-primary" />
                {totalExercises}
              </div>
              <p className="text-xs text-muted-foreground">Exercises</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-lg font-semibold text-foreground">
                <Target className="w-4 h-4 text-primary" />
                {uniqueMuscles}
              </div>
              <p className="text-xs text-muted-foreground">Muscles</p>
            </div>
          </div>
        )}
      </div>

      {highlightedRegions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center">
          {highlightedRegions.map(region => (
            <Badge
              key={region}
              variant={selectedMuscle === region ? "default" : "secondary"}
              className="cursor-pointer text-xs px-3 py-1"
              onClick={() => handleMuscleClick(region)}
              data-testid={`badge-muscle-${region}`}
            >
              {regionToMuscle[region] || region}
            </Badge>
          ))}
        </div>
      )}

      {selectedMuscle && muscleExerciseData && (
        <Card className="border-primary/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <span>{muscleExerciseData.muscleName} Exercises</span>
              <Badge variant="secondary" className="ml-auto">
                {muscleExerciseData.exercises.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {muscleExerciseData.exercises.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No exercises target this muscle {selectedDay !== "all" ? "on this day" : "in this cycle"}
              </p>
            ) : (
              <div className="space-y-2">
                {muscleExerciseData.exercises.map((ex, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 transition-colors"
                    data-testid={`exercise-detail-${idx}`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-background flex items-center justify-center shrink-0 shadow-sm">
                      {getExerciseIcon(ex.exerciseType, muscleExerciseData.muscleName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ex.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs font-normal">
                          <Calendar className="w-3 h-3 mr-1" />
                          {getDayLabel(ex.dayIndex)}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">
                          {ex.exerciseType === 'cardio' ? (
                            <>
                              {ex.durationMinutes ? `${ex.durationMinutes} min` : ''}
                              {ex.distanceKm ? ` · ${ex.distanceKm}` : ''}
                            </>
                          ) : (
                            <>
                              {ex.sets}x{ex.reps}
                              {ex.weight && ` @ ${ex.weight}`}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedMuscle && highlightedRegions.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Tap a muscle group to see exercises
        </p>
      )}
    </div>
  );
}
