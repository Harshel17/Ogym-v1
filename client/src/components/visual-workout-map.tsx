import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BodyMap, muscleToRegions, regionToMuscle } from "@/components/body-map";
import { Dumbbell, Heart, Target, Calendar, Zap, Flame, ChevronRight } from "lucide-react";

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
      return <Heart className="w-4 h-4 text-rose-400" />;
    }
    if (muscleType === 'Core' || muscleType === 'Abs') {
      return <Target className="w-4 h-4 text-amber-400" />;
    }
    return <Dumbbell className="w-4 h-4 text-blue-400" />;
  };

  const totalExercises = filteredItems.length;
  const uniqueMuscles = highlightedRegions.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 justify-center px-2">
        <Button
          size="sm"
          variant={selectedDay === "all" ? "default" : "outline"}
          onClick={() => { setSelectedDay("all"); setSelectedMuscle(null); }}
          data-testid="button-day-all"
          className="min-w-[72px] rounded-full"
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
            className="min-w-[56px] rounded-full"
          >
            Day {i + 1}
          </Button>
        ))}
      </div>

      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.08),transparent_60%)]" />
        
        <div className="relative px-4 py-6">
          <BodyMap
            highlightedMuscles={highlightedRegions}
            onMuscleClick={handleMuscleClick}
            selectedMuscle={selectedMuscle}
          />
          
          {highlightedRegions.length === 0 && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/40 mb-4">
                <Zap className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">
                {selectedDay === "all" 
                  ? "No exercises in this cycle" 
                  : "Rest day - no exercises scheduled"}
              </p>
              <p className="text-muted-foreground/60 text-xs mt-1">
                Select a different day to view workouts
              </p>
            </div>
          )}

          {highlightedRegions.length > 0 && (
            <div className="flex justify-center gap-8 mt-6 pt-6 border-t border-border/20">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
                  <Flame className="w-5 h-5 text-orange-400" />
                  <span>{totalExercises}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Exercises</p>
              </div>
              <div className="w-px bg-border/30" />
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
                  <Target className="w-5 h-5 text-primary" />
                  <span>{uniqueMuscles}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Muscles</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {highlightedRegions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center px-2">
          {highlightedRegions.map(region => (
            <Badge
              key={region}
              variant={selectedMuscle === region ? "default" : "secondary"}
              className={`cursor-pointer text-xs px-4 py-1.5 rounded-full transition-all duration-200 ${
                selectedMuscle === region ? 'shadow-md' : ''
              }`}
              onClick={() => handleMuscleClick(region)}
              data-testid={`badge-muscle-${region}`}
            >
              {regionToMuscle[region] || region}
            </Badge>
          ))}
        </div>
      )}

      {selectedMuscle && muscleExerciseData && (
        <Card className="border-primary/20 shadow-lg overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-3 relative">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">{muscleExerciseData.muscleName}</span>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                  {muscleExerciseData.exercises.length} exercise{muscleExerciseData.exercises.length !== 1 ? 's' : ''} targeting this area
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            {muscleExerciseData.exercises.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">
                  No exercises target this muscle {selectedDay !== "all" ? "on this day" : "in this cycle"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {muscleExerciseData.exercises.map((ex, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/30 transition-all duration-200"
                    data-testid={`exercise-detail-${idx}`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-background flex items-center justify-center shrink-0 shadow-sm border border-border/50">
                      {getExerciseIcon(ex.exerciseType, muscleExerciseData.muscleName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{ex.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-xs font-normal rounded-full px-2.5">
                          <Calendar className="w-3 h-3 mr-1.5 opacity-60" />
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
                              {ex.weight && <span className="text-foreground/80"> @ {ex.weight}</span>}
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedMuscle && highlightedRegions.length > 0 && (
        <p className="text-center text-xs text-muted-foreground/70 font-medium">
          Tap a highlighted muscle to see exercises
        </p>
      )}
    </div>
  );
}
