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
}): CycleTemplate[] {
  const { goal, daysPerWeek, experience, equipment, splitPreference } = params;
  const templates: CycleTemplate[] = [];
  
  const availableEquipment = equipment.length > 0 ? equipment : ["no_equipment" as Equipment];
  
  if (daysPerWeek <= 3 || splitPreference === "full_body") {
    const days: DayTemplate[] = [];
    for (let i = 0; i < daysPerWeek; i++) {
      const labels = ["Full Body A", "Full Body B", "Full Body C"];
      days.push(buildFullBodyDay(labels[i % 3], i, availableEquipment, experience));
    }
    templates.push({
      name: `Full Body ${daysPerWeek}x`,
      description: `${daysPerWeek} full body workouts per week. Great for ${experience} lifters.`,
      cycleLength: daysPerWeek,
      days,
    });
  }
  
  if (daysPerWeek >= 4 || splitPreference === "upper_lower") {
    const days: DayTemplate[] = [];
    const pattern = daysPerWeek === 4 
      ? ["Upper A", "Lower A", "Upper B", "Lower B"]
      : ["Upper A", "Lower A", "Upper B", "Lower B", "Upper C"];
    for (let i = 0; i < Math.min(daysPerWeek, pattern.length); i++) {
      const label = pattern[i];
      if (label.includes("Upper")) {
        days.push(buildUpperDay(label, i, availableEquipment, experience, label.includes("A") ? "A" : "B"));
      } else {
        days.push(buildLowerDay(label, i, availableEquipment, experience));
      }
    }
    templates.push({
      name: `Upper/Lower ${Math.min(daysPerWeek, 5)}x`,
      description: `Alternating upper and lower body workouts. Balanced muscle development.`,
      cycleLength: days.length,
      days,
    });
  }
  
  if (daysPerWeek >= 5 || splitPreference === "ppl") {
    const cycleLen = daysPerWeek >= 6 ? 6 : 5;
    const days: DayTemplate[] = [
      buildPushDay("Push", 0, availableEquipment, experience),
      buildPullDay("Pull", 1, availableEquipment, experience),
      buildLegsDay("Legs", 2, availableEquipment, experience),
    ];
    if (cycleLen >= 4) {
      days.push(buildPushDay("Push 2", 3, availableEquipment, experience));
    }
    if (cycleLen >= 5) {
      days.push(buildPullDay("Pull 2", 4, availableEquipment, experience));
    }
    if (cycleLen >= 6) {
      days.push(buildLegsDay("Legs 2", 5, availableEquipment, experience));
    }
    templates.push({
      name: `PPL ${cycleLen}x`,
      description: `Push/Pull/Legs split. Popular for ${goal === "muscle" ? "muscle building" : "strength training"}.`,
      cycleLength: cycleLen,
      days,
    });
  }
  
  if (templates.length === 0) {
    const days: DayTemplate[] = [];
    for (let i = 0; i < Math.min(daysPerWeek, 3); i++) {
      days.push(buildFullBodyDay(`Day ${i + 1}`, i, availableEquipment, experience));
    }
    templates.push({
      name: `Basic ${daysPerWeek}-Day`,
      description: `Simple workout routine to get started.`,
      cycleLength: daysPerWeek,
      days,
    });
  }
  
  return templates.slice(0, 3);
}
