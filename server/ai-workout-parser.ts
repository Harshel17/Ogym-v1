interface ParsedExercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  muscleType: string;
  bodyPart: string;
}

interface ParsedDay {
  dayIndex: number;
  name: string;
  exercises: ParsedExercise[];
}

interface ParseResult {
  success: boolean;
  cycleName: string;
  days: ParsedDay[];
  warnings: string[];
}

const exerciseToMuscle: Record<string, { muscle: string; bodyPart: string }> = {
  "bench press": { muscle: "Chest", bodyPart: "Upper Body" },
  "incline bench press": { muscle: "Chest", bodyPart: "Upper Body" },
  "decline bench press": { muscle: "Chest", bodyPart: "Upper Body" },
  "incline dumbbell press": { muscle: "Chest", bodyPart: "Upper Body" },
  "dumbbell press": { muscle: "Chest", bodyPart: "Upper Body" },
  "chest fly": { muscle: "Chest", bodyPart: "Upper Body" },
  "dumbbell fly": { muscle: "Chest", bodyPart: "Upper Body" },
  "cable fly": { muscle: "Chest", bodyPart: "Upper Body" },
  "push-up": { muscle: "Chest", bodyPart: "Upper Body" },
  "pushup": { muscle: "Chest", bodyPart: "Upper Body" },
  "push up": { muscle: "Chest", bodyPart: "Upper Body" },
  "dips": { muscle: "Chest", bodyPart: "Upper Body" },
  "overhead press": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "shoulder press": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "military press": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "lateral raise": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "lateral raises": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "front raise": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "front raises": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "rear delt fly": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "face pull": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "face pulls": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "shrugs": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "upright row": { muscle: "Shoulders", bodyPart: "Upper Body" },
  "pull-up": { muscle: "Back", bodyPart: "Upper Body" },
  "pullup": { muscle: "Back", bodyPart: "Upper Body" },
  "pull up": { muscle: "Back", bodyPart: "Upper Body" },
  "chin-up": { muscle: "Back", bodyPart: "Upper Body" },
  "chinup": { muscle: "Back", bodyPart: "Upper Body" },
  "chin up": { muscle: "Back", bodyPart: "Upper Body" },
  "lat pulldown": { muscle: "Back", bodyPart: "Upper Body" },
  "lat pull down": { muscle: "Back", bodyPart: "Upper Body" },
  "barbell row": { muscle: "Back", bodyPart: "Upper Body" },
  "barbell rows": { muscle: "Back", bodyPart: "Upper Body" },
  "bent over row": { muscle: "Back", bodyPart: "Upper Body" },
  "dumbbell row": { muscle: "Back", bodyPart: "Upper Body" },
  "cable row": { muscle: "Back", bodyPart: "Upper Body" },
  "cable rows": { muscle: "Back", bodyPart: "Upper Body" },
  "seated row": { muscle: "Back", bodyPart: "Upper Body" },
  "t-bar row": { muscle: "Back", bodyPart: "Upper Body" },
  "deadlift": { muscle: "Back", bodyPart: "Full Body" },
  "romanian deadlift": { muscle: "Hamstrings", bodyPart: "Lower Body" },
  "rdl": { muscle: "Hamstrings", bodyPart: "Lower Body" },
  "bicep curl": { muscle: "Biceps", bodyPart: "Upper Body" },
  "bicep curls": { muscle: "Biceps", bodyPart: "Upper Body" },
  "biceps curl": { muscle: "Biceps", bodyPart: "Upper Body" },
  "dumbbell curl": { muscle: "Biceps", bodyPart: "Upper Body" },
  "dumbbell curls": { muscle: "Biceps", bodyPart: "Upper Body" },
  "barbell curl": { muscle: "Biceps", bodyPart: "Upper Body" },
  "hammer curl": { muscle: "Biceps", bodyPart: "Upper Body" },
  "hammer curls": { muscle: "Biceps", bodyPart: "Upper Body" },
  "preacher curl": { muscle: "Biceps", bodyPart: "Upper Body" },
  "concentration curl": { muscle: "Biceps", bodyPart: "Upper Body" },
  "tricep pushdown": { muscle: "Triceps", bodyPart: "Upper Body" },
  "tricep pushdowns": { muscle: "Triceps", bodyPart: "Upper Body" },
  "triceps pushdown": { muscle: "Triceps", bodyPart: "Upper Body" },
  "tricep extension": { muscle: "Triceps", bodyPart: "Upper Body" },
  "triceps extension": { muscle: "Triceps", bodyPart: "Upper Body" },
  "overhead tricep extension": { muscle: "Triceps", bodyPart: "Upper Body" },
  "skull crusher": { muscle: "Triceps", bodyPart: "Upper Body" },
  "skull crushers": { muscle: "Triceps", bodyPart: "Upper Body" },
  "close grip bench": { muscle: "Triceps", bodyPart: "Upper Body" },
  "close grip bench press": { muscle: "Triceps", bodyPart: "Upper Body" },
  "squat": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "squats": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "back squat": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "front squat": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "goblet squat": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "leg press": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "leg extension": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "leg extensions": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "lunges": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "lunge": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "walking lunge": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "walking lunges": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "bulgarian split squat": { muscle: "Quadriceps", bodyPart: "Lower Body" },
  "leg curl": { muscle: "Hamstrings", bodyPart: "Lower Body" },
  "leg curls": { muscle: "Hamstrings", bodyPart: "Lower Body" },
  "hamstring curl": { muscle: "Hamstrings", bodyPart: "Lower Body" },
  "good morning": { muscle: "Hamstrings", bodyPart: "Lower Body" },
  "good mornings": { muscle: "Hamstrings", bodyPart: "Lower Body" },
  "hip thrust": { muscle: "Glutes", bodyPart: "Lower Body" },
  "hip thrusts": { muscle: "Glutes", bodyPart: "Lower Body" },
  "glute bridge": { muscle: "Glutes", bodyPart: "Lower Body" },
  "calf raise": { muscle: "Calves", bodyPart: "Lower Body" },
  "calf raises": { muscle: "Calves", bodyPart: "Lower Body" },
  "standing calf raise": { muscle: "Calves", bodyPart: "Lower Body" },
  "seated calf raise": { muscle: "Calves", bodyPart: "Lower Body" },
  "plank": { muscle: "Core", bodyPart: "Core" },
  "crunch": { muscle: "Core", bodyPart: "Core" },
  "crunches": { muscle: "Core", bodyPart: "Core" },
  "sit-up": { muscle: "Core", bodyPart: "Core" },
  "sit up": { muscle: "Core", bodyPart: "Core" },
  "sit-ups": { muscle: "Core", bodyPart: "Core" },
  "leg raise": { muscle: "Core", bodyPart: "Core" },
  "leg raises": { muscle: "Core", bodyPart: "Core" },
  "hanging leg raise": { muscle: "Core", bodyPart: "Core" },
  "russian twist": { muscle: "Core", bodyPart: "Core" },
  "russian twists": { muscle: "Core", bodyPart: "Core" },
  "ab wheel": { muscle: "Core", bodyPart: "Core" },
  "cable crunch": { muscle: "Core", bodyPart: "Core" },
  "treadmill": { muscle: "Cardio", bodyPart: "Full Body" },
  "running": { muscle: "Cardio", bodyPart: "Full Body" },
  "cycling": { muscle: "Cardio", bodyPart: "Full Body" },
  "elliptical": { muscle: "Cardio", bodyPart: "Full Body" },
  "rowing": { muscle: "Cardio", bodyPart: "Full Body" },
  "jump rope": { muscle: "Cardio", bodyPart: "Full Body" },
};

function inferMuscleType(exerciseName: string): { muscle: string; bodyPart: string } {
  const normalizedName = exerciseName.toLowerCase().trim();
  
  if (exerciseToMuscle[normalizedName]) {
    return exerciseToMuscle[normalizedName];
  }
  
  for (const [key, value] of Object.entries(exerciseToMuscle)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return value;
    }
  }
  
  if (normalizedName.includes("press") && normalizedName.includes("shoulder")) {
    return { muscle: "Shoulders", bodyPart: "Upper Body" };
  }
  if (normalizedName.includes("press") && (normalizedName.includes("bench") || normalizedName.includes("chest"))) {
    return { muscle: "Chest", bodyPart: "Upper Body" };
  }
  if (normalizedName.includes("curl") && (normalizedName.includes("leg") || normalizedName.includes("ham"))) {
    return { muscle: "Hamstrings", bodyPart: "Lower Body" };
  }
  if (normalizedName.includes("curl")) {
    return { muscle: "Biceps", bodyPart: "Upper Body" };
  }
  if (normalizedName.includes("tricep") || normalizedName.includes("pushdown")) {
    return { muscle: "Triceps", bodyPart: "Upper Body" };
  }
  if (normalizedName.includes("row") || normalizedName.includes("pull")) {
    return { muscle: "Back", bodyPart: "Upper Body" };
  }
  if (normalizedName.includes("squat") || normalizedName.includes("leg press") || normalizedName.includes("lunge")) {
    return { muscle: "Quadriceps", bodyPart: "Lower Body" };
  }
  if (normalizedName.includes("calf") || normalizedName.includes("calve")) {
    return { muscle: "Calves", bodyPart: "Lower Body" };
  }
  if (normalizedName.includes("ab") || normalizedName.includes("core") || normalizedName.includes("plank")) {
    return { muscle: "Core", bodyPart: "Core" };
  }
  
  return { muscle: "Other", bodyPart: "Full Body" };
}

function parseSetsReps(text: string): { sets: number; reps: string } {
  const pipeFormat = text.match(/(\d+)\s*sets?\s*\|\s*(\d+[-–]?\d*)\s*reps?/i);
  if (pipeFormat) {
    return { sets: parseInt(pipeFormat[1]), reps: pipeFormat[2] };
  }
  
  const standardFormat = text.match(/(\d+)\s*(?:sets?|x)\s*[x×]?\s*(\d+[-–]?\d*)\s*(?:reps?)?/i);
  if (standardFormat) {
    return { sets: parseInt(standardFormat[1]), reps: standardFormat[2] };
  }
  
  const xFormat = text.match(/(\d+)\s*x\s*(\d+[-–]?\d*)/i);
  if (xFormat) {
    return { sets: parseInt(xFormat[1]), reps: xFormat[2] };
  }
  
  const numbersOnly = text.match(/(\d+)\s+(\d+[-–]?\d*)/);
  if (numbersOnly) {
    return { sets: parseInt(numbersOnly[1]), reps: numbersOnly[2] };
  }
  
  return { sets: 3, reps: "10" };
}

function parseRest(text: string): string {
  const restPattern = text.match(/(\d+)\s*(s|sec|seconds?|m|min|minutes?)\s*(?:rest)?/i);
  if (restPattern) {
    const value = parseInt(restPattern[1]);
    const unit = restPattern[2].toLowerCase();
    if (unit.startsWith('m')) {
      return `${value}min`;
    }
    return `${value}s`;
  }
  
  if (text.toLowerCase().includes("no rest") || text.toLowerCase().includes("minimal")) {
    return "No rest";
  }
  
  return "";
}

export function parseAIWorkoutText(rawText: string): ParseResult {
  const warnings: string[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let cycleName = "Imported Workout";
  const cycleMatch = rawText.match(/CYCLE:\s*(.+)/i);
  if (cycleMatch) {
    cycleName = cycleMatch[1].trim();
  } else {
    // Try to find workout plan name patterns like "4-Day Muscle Gain Workout Plan"
    const planNameMatch = rawText.match(/(\d+[-–]?Day\s+\w+(?:\s+\w+)*\s*(?:Plan|Workout|Split|Program))/i);
    if (planNameMatch) {
      cycleName = planNameMatch[1].trim();
    }
  }
  
  const days: ParsedDay[] = [];
  let currentDay: ParsedDay | null = null;
  
  const dayPatterns = [
    /^DAY\s*(\d+)\s*[:\-–—]?\s*(.*)$/i,
    /^Day\s+(\d+)\s*[:\-–—]?\s*(.*)$/i,
    /^\*?\*?DAY\s*(\d+)\*?\*?\s*[:\-–—]?\s*(.*)$/i,
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*[:\-–—]?\s*(.*)$/i,
    /^(Push|Pull|Legs?|Upper|Lower|Back|Chest|Arms?|Shoulders?|Core)\s*(Day)?\s*[:\-–—]?\s*(.*)$/i,
    /^Workout\s*(\d+)\s*[:\-–—]?\s*(.*)$/i,
    /^Session\s*(\d+)\s*[:\-–—]?\s*(.*)$/i,
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.toUpperCase().startsWith("CYCLE:")) {
      continue;
    }
    
    let dayMatch = null;
    let dayName = "";
    let dayNumber = days.length + 1;
    
    for (const pattern of dayPatterns) {
      const match = line.match(pattern);
      if (match) {
        if (pattern.source.includes("Monday|Tuesday")) {
          dayName = match[1] + (match[2] ? ` - ${match[2].trim()}` : "");
        } else if (pattern.source.includes("Push|Pull")) {
          dayName = match[1] + (match[2] || "") + (match[3] ? ` - ${match[3].trim()}` : "");
        } else {
          dayNumber = parseInt(match[1]) || days.length + 1;
          dayName = match[2]?.trim() || `Day ${dayNumber}`;
        }
        dayMatch = match;
        break;
      }
    }
    
    if (dayMatch) {
      if (currentDay) {
        days.push(currentDay);
      }
      currentDay = {
        dayIndex: days.length,
        name: dayName || `Day ${days.length + 1}`,
        exercises: []
      };
      continue;
    }
    
    if (currentDay) {
      const cleanLine = line.replace(/^[-•*\d.)\s]+/, '').trim();
      
      if (!cleanLine || cleanLine.length < 3) {
        continue;
      }
      
      if (cleanLine.toLowerCase().includes('rule') || 
          cleanLine.toLowerCase().includes('format') ||
          cleanLine.toLowerCase().includes('continue for')) {
        continue;
      }
      
      let exerciseName = cleanLine;
      let setsReps = { sets: 3, reps: "10" };
      let rest = "";
      
      if (cleanLine.includes('|')) {
        const parts = cleanLine.split('|').map(p => p.trim());
        exerciseName = parts[0];
        
        for (let j = 1; j < parts.length; j++) {
          const part = parts[j];
          const sr = parseSetsReps(part);
          if (sr.sets !== 3 || sr.reps !== "10") {
            setsReps = sr;
          }
          
          const r = parseRest(part);
          if (r) {
            rest = r;
          }
        }
      } else if (cleanLine.includes('—') || cleanLine.includes('–')) {
        // ChatGPT dash-separated format: "Bench Press — 4 sets x 8-10 reps — 90 sec rest"
        const parts = cleanLine.split(/[—–]/).map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length >= 1) {
          exerciseName = parts[0];
          
          for (let j = 1; j < parts.length; j++) {
            const part = parts[j];
            const sr = parseSetsReps(part);
            if (sr.sets !== 3 || sr.reps !== "10") {
              setsReps = sr;
            }
            
            const r = parseRest(part);
            if (r) {
              rest = r;
            }
          }
        }
      } else {
        const sr = parseSetsReps(cleanLine);
        setsReps = sr;
        rest = parseRest(cleanLine);
        
        exerciseName = cleanLine
          .replace(/(\d+)\s*(?:sets?|x)\s*[x×]?\s*(\d+[-–]?\d*)\s*(?:reps?)?/gi, '')
          .replace(/(\d+)\s*x\s*(\d+[-–]?\d*)/gi, '')
          .replace(/(\d+)\s*(s|sec|seconds?|m|min|minutes?)\s*(?:rest)?/gi, '')
          .replace(/[-–:]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      if (exerciseName.length < 2) {
        continue;
      }
      
      const muscleInfo = inferMuscleType(exerciseName);
      
      currentDay.exercises.push({
        name: exerciseName,
        sets: setsReps.sets,
        reps: setsReps.reps,
        rest: rest || "60s",
        muscleType: muscleInfo.muscle,
        bodyPart: muscleInfo.bodyPart
      });
    }
  }
  
  if (currentDay && currentDay.exercises.length > 0) {
    days.push(currentDay);
  }
  
  if (days.length === 0) {
    const allExercises: ParsedExercise[] = [];
    
    for (const line of lines) {
      const cleanLine = line.replace(/^[-•*\d.)\s]+/, '').trim();
      if (!cleanLine || cleanLine.length < 3) continue;
      if (cleanLine.toUpperCase().startsWith("CYCLE:")) continue;
      
      const sr = parseSetsReps(cleanLine);
      const rest = parseRest(cleanLine);
      
      let exerciseName = cleanLine;
      if (cleanLine.includes('|')) {
        exerciseName = cleanLine.split('|')[0].trim();
      } else {
        exerciseName = cleanLine
          .replace(/(\d+)\s*(?:sets?|x)\s*[x×]?\s*(\d+[-–]?\d*)\s*(?:reps?)?/gi, '')
          .replace(/(\d+)\s*x\s*(\d+[-–]?\d*)/gi, '')
          .replace(/(\d+)\s*(s|sec|seconds?|m|min|minutes?)\s*(?:rest)?/gi, '')
          .replace(/[-–:]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      if (exerciseName.length >= 2) {
        const muscleInfo = inferMuscleType(exerciseName);
        allExercises.push({
          name: exerciseName,
          sets: sr.sets,
          reps: sr.reps,
          rest: rest || "60s",
          muscleType: muscleInfo.muscle,
          bodyPart: muscleInfo.bodyPart
        });
      }
    }
    
    if (allExercises.length > 0) {
      days.push({
        dayIndex: 0,
        name: "Full Workout",
        exercises: allExercises
      });
      warnings.push("Could not detect day structure. All exercises added to a single day.");
    }
  }
  
  for (const day of days) {
    if (day.exercises.length === 0) {
      warnings.push(`Day "${day.name}" has no exercises detected.`);
    }
    for (const ex of day.exercises) {
      if (ex.muscleType === "Other") {
        warnings.push(`Could not identify muscle group for "${ex.name}".`);
      }
    }
  }
  
  const totalExercises = days.reduce((sum, d) => sum + d.exercises.length, 0);
  
  return {
    success: days.length > 0 && totalExercises > 0,
    cycleName,
    days,
    warnings
  };
}
