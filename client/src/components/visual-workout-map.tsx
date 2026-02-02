import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BodyMap, muscleToRegions, regionToMuscle } from "@/components/body-map";
import { Dumbbell, Heart, Target, Calendar } from "lucide-react";

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
      return <Heart className="w-3 h-3 text-rose-500" />;
    }
    if (muscleType === 'Core' || muscleType === 'Abs') {
      return <Target className="w-3 h-3 text-amber-500" />;
    }
    return <Dumbbell className="w-3 h-3 text-blue-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          size="sm"
          variant={selectedDay === "all" ? "default" : "outline"}
          onClick={() => { setSelectedDay("all"); setSelectedMuscle(null); }}
          data-testid="button-day-all"
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
          >
            Day {i + 1}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <BodyMap
            highlightedMuscles={highlightedRegions}
            onMuscleClick={handleMuscleClick}
            selectedMuscle={selectedMuscle}
          />
          
          {highlightedRegions.length === 0 && (
            <p className="text-center text-muted-foreground text-sm mt-4">
              {selectedDay === "all" 
                ? "No exercises in this cycle" 
                : "Rest day - no exercises scheduled"}
            </p>
          )}
        </CardContent>
      </Card>

      {selectedMuscle && muscleExerciseData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              {muscleExerciseData.muscleName} Exercises
            </CardTitle>
          </CardHeader>
          <CardContent>
            {muscleExerciseData.exercises.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No exercises target this muscle {selectedDay !== "all" ? "on this day" : "in this cycle"}
              </p>
            ) : (
              <div className="space-y-2">
                {muscleExerciseData.exercises.map((ex, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-start gap-2 p-2 rounded-md bg-muted/30"
                    data-testid={`exercise-detail-${idx}`}
                  >
                    {getExerciseIcon(ex.exerciseType, muscleExerciseData.muscleName)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{ex.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="w-3 h-3 mr-1" />
                          {getDayLabel(ex.dayIndex)}
                        </Badge>
                        {ex.exerciseType === 'cardio' ? (
                          <span>
                            {ex.durationMinutes ? `${ex.durationMinutes} min` : ''}
                            {ex.distanceKm ? ` · ${ex.distanceKm}` : ''}
                          </span>
                        ) : (
                          <span>
                            {ex.sets}x{ex.reps}
                            {ex.weight && ` @ ${ex.weight}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-1 justify-center">
        {highlightedRegions.map(region => (
          <Badge
            key={region}
            variant={selectedMuscle === region ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => handleMuscleClick(region)}
            data-testid={`badge-muscle-${region}`}
          >
            {regionToMuscle[region] || region}
          </Badge>
        ))}
      </div>
    </div>
  );
}
