type Equipment = "dumbbells" | "barbell" | "machines" | "cables" | "cardio" | "no_equipment";
type Goal = "strength" | "muscle" | "fat_loss" | "general";
type Experience = "beginner" | "intermediate" | "advanced";

interface ExerciseTemplate {
  exerciseName: string;
  muscleType: string;
  bodyPart: string;
  sets: number;
  reps: number;
  equipment: Equipment[];
}

interface DayTemplate {
  dayIndex: number;
  label: string;
  items: {
    exerciseName: string;
    muscleType: string;
    bodyPart: string;
    sets: number;
    reps: number;
  }[];
}

interface CycleTemplate {
  name: string;
  description: string;
  cycleLength: number;
  days: DayTemplate[];
}

const exercisesByMuscle: Record<string, ExerciseTemplate[]> = {
  chest: [
    { exerciseName: "Barbell Bench Press", muscleType: "Chest", bodyPart: "Upper Body", sets: 4, reps: 8, equipment: ["barbell"] },
    { exerciseName: "Dumbbell Bench Press", muscleType: "Chest", bodyPart: "Upper Body", sets: 4, reps: 10, equipment: ["dumbbells"] },
    { exerciseName: "Incline Dumbbell Press", muscleType: "Chest", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["dumbbells"] },
    { exerciseName: "Cable Flyes", muscleType: "Chest", bodyPart: "Upper Body", sets: 3, reps: 12, equipment: ["cables"] },
    { exerciseName: "Machine Chest Press", muscleType: "Chest", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["machines"] },
    { exerciseName: "Push-Ups", muscleType: "Chest", bodyPart: "Upper Body", sets: 3, reps: 15, equipment: ["no_equipment"] },
    { exerciseName: "Diamond Push-Ups", muscleType: "Chest", bodyPart: "Upper Body", sets: 3, reps: 12, equipment: ["no_equipment"] },
  ],
  back: [
    { exerciseName: "Barbell Deadlift", muscleType: "Back", bodyPart: "Upper Body", sets: 4, reps: 6, equipment: ["barbell"] },
    { exerciseName: "Barbell Rows", muscleType: "Back", bodyPart: "Upper Body", sets: 4, reps: 8, equipment: ["barbell"] },
    { exerciseName: "Dumbbell Rows", muscleType: "Back", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["dumbbells"] },
    { exerciseName: "Lat Pulldown", muscleType: "Back", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["machines", "cables"] },
    { exerciseName: "Seated Cable Row", muscleType: "Back", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["cables"] },
    { exerciseName: "Pull-Ups", muscleType: "Back", bodyPart: "Upper Body", sets: 3, reps: 8, equipment: ["no_equipment"] },
    { exerciseName: "Inverted Rows", muscleType: "Back", bodyPart: "Upper Body", sets: 3, reps: 12, equipment: ["no_equipment"] },
  ],
  shoulders: [
    { exerciseName: "Overhead Press", muscleType: "Shoulders", bodyPart: "Upper Body", sets: 4, reps: 8, equipment: ["barbell"] },
    { exerciseName: "Dumbbell Shoulder Press", muscleType: "Shoulders", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["dumbbells"] },
    { exerciseName: "Lateral Raises", muscleType: "Shoulders", bodyPart: "Upper Body", sets: 3, reps: 12, equipment: ["dumbbells", "cables"] },
    { exerciseName: "Face Pulls", muscleType: "Shoulders", bodyPart: "Upper Body", sets: 3, reps: 15, equipment: ["cables"] },
    { exerciseName: "Machine Shoulder Press", muscleType: "Shoulders", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["machines"] },
    { exerciseName: "Pike Push-Ups", muscleType: "Shoulders", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["no_equipment"] },
  ],
  legs: [
    { exerciseName: "Barbell Squat", muscleType: "Legs", bodyPart: "Lower Body", sets: 4, reps: 8, equipment: ["barbell"] },
    { exerciseName: "Goblet Squat", muscleType: "Legs", bodyPart: "Lower Body", sets: 3, reps: 12, equipment: ["dumbbells"] },
    { exerciseName: "Romanian Deadlift", muscleType: "Hamstrings", bodyPart: "Lower Body", sets: 3, reps: 10, equipment: ["barbell", "dumbbells"] },
    { exerciseName: "Leg Press", muscleType: "Legs", bodyPart: "Lower Body", sets: 4, reps: 10, equipment: ["machines"] },
    { exerciseName: "Leg Curl", muscleType: "Hamstrings", bodyPart: "Lower Body", sets: 3, reps: 12, equipment: ["machines"] },
    { exerciseName: "Leg Extension", muscleType: "Quadriceps", bodyPart: "Lower Body", sets: 3, reps: 12, equipment: ["machines"] },
    { exerciseName: "Lunges", muscleType: "Legs", bodyPart: "Lower Body", sets: 3, reps: 10, equipment: ["dumbbells", "no_equipment"] },
    { exerciseName: "Bulgarian Split Squat", muscleType: "Legs", bodyPart: "Lower Body", sets: 3, reps: 10, equipment: ["dumbbells", "no_equipment"] },
    { exerciseName: "Bodyweight Squats", muscleType: "Legs", bodyPart: "Lower Body", sets: 3, reps: 20, equipment: ["no_equipment"] },
    { exerciseName: "Calf Raises", muscleType: "Calves", bodyPart: "Lower Body", sets: 3, reps: 15, equipment: ["machines", "dumbbells", "no_equipment"] },
  ],
  arms: [
    { exerciseName: "Barbell Curl", muscleType: "Biceps", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["barbell"] },
    { exerciseName: "Dumbbell Curl", muscleType: "Biceps", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["dumbbells"] },
    { exerciseName: "Hammer Curl", muscleType: "Biceps", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["dumbbells"] },
    { exerciseName: "Cable Curl", muscleType: "Biceps", bodyPart: "Upper Body", sets: 3, reps: 12, equipment: ["cables"] },
    { exerciseName: "Tricep Dips", muscleType: "Triceps", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["no_equipment"] },
    { exerciseName: "Skull Crushers", muscleType: "Triceps", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["barbell", "dumbbells"] },
    { exerciseName: "Tricep Pushdown", muscleType: "Triceps", bodyPart: "Upper Body", sets: 3, reps: 12, equipment: ["cables"] },
    { exerciseName: "Overhead Tricep Extension", muscleType: "Triceps", bodyPart: "Upper Body", sets: 3, reps: 10, equipment: ["dumbbells", "cables"] },
  ],
  core: [
    { exerciseName: "Plank", muscleType: "Core", bodyPart: "Full Body", sets: 3, reps: 60, equipment: ["no_equipment"] },
    { exerciseName: "Crunches", muscleType: "Abs", bodyPart: "Full Body", sets: 3, reps: 20, equipment: ["no_equipment"] },
    { exerciseName: "Leg Raises", muscleType: "Abs", bodyPart: "Full Body", sets: 3, reps: 15, equipment: ["no_equipment"] },
    { exerciseName: "Russian Twists", muscleType: "Core", bodyPart: "Full Body", sets: 3, reps: 20, equipment: ["no_equipment", "dumbbells"] },
    { exerciseName: "Cable Woodchops", muscleType: "Core", bodyPart: "Full Body", sets: 3, reps: 12, equipment: ["cables"] },
    { exerciseName: "Ab Wheel Rollout", muscleType: "Abs", bodyPart: "Full Body", sets: 3, reps: 10, equipment: ["no_equipment"] },
  ],
  cardio: [
    { exerciseName: "Treadmill Run", muscleType: "Cardio", bodyPart: "Full Body", sets: 1, reps: 20, equipment: ["cardio"] },
    { exerciseName: "Cycling", muscleType: "Cardio", bodyPart: "Lower Body", sets: 1, reps: 20, equipment: ["cardio"] },
    { exerciseName: "Rowing Machine", muscleType: "Cardio", bodyPart: "Full Body", sets: 1, reps: 15, equipment: ["cardio"] },
    { exerciseName: "Jumping Jacks", muscleType: "Cardio", bodyPart: "Full Body", sets: 3, reps: 30, equipment: ["no_equipment"] },
    { exerciseName: "Burpees", muscleType: "Cardio", bodyPart: "Full Body", sets: 3, reps: 10, equipment: ["no_equipment"] },
    { exerciseName: "Mountain Climbers", muscleType: "Cardio", bodyPart: "Full Body", sets: 3, reps: 20, equipment: ["no_equipment"] },
  ],
};

function getExercise(muscle: string, available: Equipment[], fallback = true): ExerciseTemplate | null {
  const exercises = exercisesByMuscle[muscle] || [];
  let match = exercises.find(e => e.equipment.some(eq => available.includes(eq)));
  if (!match && fallback) {
    match = exercises.find(e => e.equipment.includes("no_equipment"));
  }
  return match || null;
}

function pickExercises(muscle: string, count: number, available: Equipment[]): ExerciseTemplate[] {
  const exercises = exercisesByMuscle[muscle] || [];
  const matching = exercises.filter(e => e.equipment.some(eq => available.includes(eq)));
  const fallbacks = exercises.filter(e => e.equipment.includes("no_equipment"));
  const pool = matching.length >= count ? matching : [...matching, ...fallbacks];
  return pool.slice(0, count);
}

function buildFullBodyDay(label: string, dayIndex: number, equipment: Equipment[], experience: Experience): DayTemplate {
  const exerciseCount = experience === "beginner" ? 5 : experience === "intermediate" ? 6 : 7;
  const items: DayTemplate["items"] = [];
  
  const muscles = ["legs", "chest", "back", "shoulders", "core"];
  for (const muscle of muscles) {
    const ex = getExercise(muscle, equipment);
    if (ex && items.length < exerciseCount) {
      items.push({
        exerciseName: ex.exerciseName,
        muscleType: ex.muscleType,
        bodyPart: ex.bodyPart,
        sets: ex.sets,
        reps: ex.reps,
      });
    }
  }
  
  return { dayIndex, label, items };
}

function buildUpperDay(label: string, dayIndex: number, equipment: Equipment[], experience: Experience, variant: "A" | "B"): DayTemplate {
  const items: DayTemplate["items"] = [];
  const muscles = variant === "A" 
    ? ["chest", "back", "shoulders", "arms"] 
    : ["back", "chest", "shoulders", "arms"];
  
  for (const muscle of muscles) {
    const exercises = pickExercises(muscle, muscle === "arms" ? 2 : 1, equipment);
    for (const ex of exercises) {
      items.push({
        exerciseName: ex.exerciseName,
        muscleType: ex.muscleType,
        bodyPart: ex.bodyPart,
        sets: ex.sets,
        reps: ex.reps,
      });
    }
  }
  
  return { dayIndex, label, items };
}

function buildLowerDay(label: string, dayIndex: number, equipment: Equipment[], experience: Experience): DayTemplate {
  const items: DayTemplate["items"] = [];
  const exercises = pickExercises("legs", 5, equipment);
  for (const ex of exercises) {
    items.push({
      exerciseName: ex.exerciseName,
      muscleType: ex.muscleType,
      bodyPart: ex.bodyPart,
      sets: ex.sets,
      reps: ex.reps,
    });
  }
  const coreEx = getExercise("core", equipment);
  if (coreEx) {
    items.push({
      exerciseName: coreEx.exerciseName,
      muscleType: coreEx.muscleType,
      bodyPart: coreEx.bodyPart,
      sets: coreEx.sets,
      reps: coreEx.reps,
    });
  }
  return { dayIndex, label, items };
}

function buildPushDay(label: string, dayIndex: number, equipment: Equipment[], experience: Experience): DayTemplate {
  const items: DayTemplate["items"] = [];
  const chestExercises = pickExercises("chest", 2, equipment);
  const shoulderExercises = pickExercises("shoulders", 2, equipment);
  const tricepEx = getExercise("arms", equipment);
  
  for (const ex of [...chestExercises, ...shoulderExercises]) {
    items.push({
      exerciseName: ex.exerciseName,
      muscleType: ex.muscleType,
      bodyPart: ex.bodyPart,
      sets: ex.sets,
      reps: ex.reps,
    });
  }
  if (tricepEx) {
    items.push({
      exerciseName: tricepEx.exerciseName,
      muscleType: "Triceps",
      bodyPart: tricepEx.bodyPart,
      sets: tricepEx.sets,
      reps: tricepEx.reps,
    });
  }
  return { dayIndex, label, items };
}

function buildPullDay(label: string, dayIndex: number, equipment: Equipment[], experience: Experience): DayTemplate {
  const items: DayTemplate["items"] = [];
  const backExercises = pickExercises("back", 3, equipment);
  const bicepExercises = exercisesByMuscle["arms"]?.filter(e => 
    e.muscleType === "Biceps" && e.equipment.some(eq => equipment.includes(eq))
  ).slice(0, 2) || [];
  
  for (const ex of backExercises) {
    items.push({
      exerciseName: ex.exerciseName,
      muscleType: ex.muscleType,
      bodyPart: ex.bodyPart,
      sets: ex.sets,
      reps: ex.reps,
    });
  }
  for (const ex of bicepExercises) {
    items.push({
      exerciseName: ex.exerciseName,
      muscleType: ex.muscleType,
      bodyPart: ex.bodyPart,
      sets: ex.sets,
      reps: ex.reps,
    });
  }
  const shoulderEx = getExercise("shoulders", equipment);
  if (shoulderEx) {
    items.push({
      exerciseName: shoulderEx.exerciseName,
      muscleType: shoulderEx.muscleType,
      bodyPart: shoulderEx.bodyPart,
      sets: shoulderEx.sets,
      reps: shoulderEx.reps,
    });
  }
  return { dayIndex, label, items };
}

function buildLegsDay(label: string, dayIndex: number, equipment: Equipment[], experience: Experience): DayTemplate {
  return buildLowerDay(label, dayIndex, equipment, experience);
}

export function generateCycleTemplates(params: {
  goal: Goal;
  daysPerWeek: number;
  experience: Experience;
  equipment: Equipment[];
  timePerWorkout: string;
  splitPreference: string;
}, restDaysPerWeek: number = 1): CycleTemplate[] {
  const { goal, daysPerWeek, experience, equipment, splitPreference } = params;
  const templates: CycleTemplate[] = [];
  
  const availableEquipment = equipment.length > 0 ? equipment : ["no_equipment" as Equipment];
  
  // Total cycle length includes training days + rest days
  const totalCycleLength = daysPerWeek + restDaysPerWeek;
  
  // Helper function to add rest days to a template
  function addRestDays(trainingDays: DayTemplate[], restCount: number): DayTemplate[] {
    if (restCount <= 0) {
      // Just update day indices
      return trainingDays.map((day, idx) => ({ ...day, dayIndex: idx }));
    }
    
    const trainingCount = trainingDays.length;
    const total = trainingCount + restCount;
    
    // Calculate which positions should be rest days using even distribution
    // This uses a simple algorithm: place rest days at evenly spaced positions
    const restPositions = new Set<number>();
    
    // Distribute rest days evenly throughout the cycle
    // For example: 4 training + 2 rest = positions at roughly 2 and 5 (0-indexed)
    // Formula: position = Math.round((i + 1) * total / (restCount + 1)) for each rest day i
    for (let i = 0; i < restCount; i++) {
      // Space rest days evenly - place after every N training days
      const pos = Math.round(((i + 1) * total) / (restCount + 1));
      restPositions.add(Math.min(pos, total - 1)); // Clamp to valid range
    }
    
    // Build the final schedule
    const allDays: DayTemplate[] = [];
    let trainingIdx = 0;
    
    for (let dayIdx = 0; dayIdx < total; dayIdx++) {
      if (restPositions.has(dayIdx)) {
        allDays.push({
          dayIndex: dayIdx,
          label: "Rest Day",
          items: []
        });
      } else if (trainingIdx < trainingCount) {
        allDays.push({
          ...trainingDays[trainingIdx],
          dayIndex: dayIdx
        });
        trainingIdx++;
      }
    }
    
    // Handle edge case: more rest than training - add remaining rest days at end
    while (allDays.length < total) {
      allDays.push({
        dayIndex: allDays.length,
        label: "Rest Day",
        items: []
      });
    }
    
    return allDays;
  }
  
  // Always generate Full Body option (adapts to any number of days)
  {
    const trainingDays: DayTemplate[] = [];
    for (let i = 0; i < daysPerWeek; i++) {
      const labels = ["Full Body A", "Full Body B", "Full Body C", "Full Body D", "Full Body E", "Full Body F"];
      trainingDays.push(buildFullBodyDay(labels[i % 6], i, availableEquipment, experience));
    }
    const days = addRestDays(trainingDays, restDaysPerWeek);
    templates.push({
      name: `Full Body ${daysPerWeek}x`,
      description: `${daysPerWeek} training days + ${restDaysPerWeek} rest day${restDaysPerWeek !== 1 ? 's' : ''} per cycle.`,
      cycleLength: totalCycleLength,
      days,
    });
  }
  
  // Always generate Upper/Lower option (adapts to any number of days)
  {
    const trainingDays: DayTemplate[] = [];
    const pattern = ["Upper A", "Lower A", "Upper B", "Lower B", "Upper C", "Lower C"];
    for (let i = 0; i < daysPerWeek; i++) {
      const label = pattern[i % 6];
      if (label.includes("Upper")) {
        trainingDays.push(buildUpperDay(label, i, availableEquipment, experience, label.includes("A") ? "A" : "B"));
      } else {
        trainingDays.push(buildLowerDay(label, i, availableEquipment, experience));
      }
    }
    const days = addRestDays(trainingDays, restDaysPerWeek);
    templates.push({
      name: `Upper/Lower ${daysPerWeek}x`,
      description: `${daysPerWeek} training days + ${restDaysPerWeek} rest day${restDaysPerWeek !== 1 ? 's' : ''} per cycle.`,
      cycleLength: totalCycleLength,
      days,
    });
  }
  
  // Always generate PPL option (adapts to any number of days)
  {
    const trainingDays: DayTemplate[] = [];
    const pplCycle = [
      { label: "Push", build: buildPushDay },
      { label: "Pull", build: buildPullDay },
      { label: "Legs", build: buildLegsDay },
    ];
    for (let i = 0; i < daysPerWeek; i++) {
      const template = pplCycle[i % 3];
      const suffix = Math.floor(i / 3) > 0 ? ` ${Math.floor(i / 3) + 1}` : "";
      trainingDays.push(template.build(`${template.label}${suffix}`, i, availableEquipment, experience));
    }
    const days = addRestDays(trainingDays, restDaysPerWeek);
    templates.push({
      name: `PPL ${daysPerWeek}x`,
      description: `${daysPerWeek} training days + ${restDaysPerWeek} rest day${restDaysPerWeek !== 1 ? 's' : ''} per cycle.`,
      cycleLength: totalCycleLength,
      days,
    });
  }
  
  // Sort by preference if specified
  if (splitPreference !== "no_pref") {
    const preferenceOrder: Record<string, number> = {
      "full_body": 0,
      "upper_lower": 1,
      "ppl": 2,
    };
    const idx = preferenceOrder[splitPreference];
    if (idx !== undefined && idx > 0) {
      const preferred = templates.splice(idx, 1)[0];
      templates.unshift(preferred);
    }
  }
  
  return templates.slice(0, 3);
}
