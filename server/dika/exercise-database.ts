export interface Exercise {
  name: string;
  aliases: string[];
  category: 'compound' | 'isolation' | 'cardio' | 'stretching';
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: string[];
  tips: string[];
  commonMistakes: string[];
  youtubeSearchQuery: string;
}

export const exerciseDatabase: Exercise[] = [
  // CHEST EXERCISES
  {
    name: "Barbell Bench Press",
    aliases: ["bench press", "flat bench", "chest press", "barbell press"],
    category: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps", "front deltoids"],
    equipment: ["barbell", "bench"],
    difficulty: "intermediate",
    steps: [
      "Lie flat on a bench with your feet firmly on the floor",
      "Grip the barbell slightly wider than shoulder-width apart",
      "Unrack the bar and hold it directly above your chest with arms extended",
      "Lower the bar slowly to your mid-chest, keeping elbows at 45-degree angle",
      "Pause briefly when the bar touches your chest",
      "Push the bar back up explosively to the starting position",
      "Keep your back slightly arched and shoulder blades pinched together throughout"
    ],
    tips: [
      "Keep your wrists straight, not bent backward",
      "Drive through your heels for stability",
      "Don't bounce the bar off your chest",
      "Always use a spotter for heavy lifts"
    ],
    commonMistakes: [
      "Flaring elbows too wide (increases shoulder injury risk)",
      "Lifting feet off the floor",
      "Not touching the chest fully",
      "Bouncing the bar off the chest"
    ],
    youtubeSearchQuery: "how to bench press proper form"
  },
  {
    name: "Dumbbell Bench Press",
    aliases: ["db bench press", "dumbbell press", "db press"],
    category: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps", "front deltoids"],
    equipment: ["dumbbells", "bench"],
    difficulty: "beginner",
    steps: [
      "Sit on the bench with dumbbells on your thighs",
      "Lie back and bring the dumbbells to chest level, palms facing forward",
      "Press the dumbbells up until your arms are extended",
      "Lower the dumbbells with control back to chest level",
      "Keep your feet flat on the floor throughout the movement"
    ],
    tips: [
      "Allows greater range of motion than barbell",
      "Focus on squeezing the chest at the top",
      "Control the weight on the way down"
    ],
    commonMistakes: [
      "Using momentum to lift the weights",
      "Not going through full range of motion",
      "Letting dumbbells drift too far apart at the bottom"
    ],
    youtubeSearchQuery: "dumbbell bench press form tutorial"
  },
  {
    name: "Push-Up",
    aliases: ["pushup", "push up", "press up"],
    category: "compound",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps", "front deltoids", "core"],
    equipment: ["bodyweight"],
    difficulty: "beginner",
    steps: [
      "Start in a plank position with hands slightly wider than shoulder-width",
      "Keep your body in a straight line from head to heels",
      "Lower your chest toward the floor by bending your elbows",
      "Go down until your chest nearly touches the ground",
      "Push back up to the starting position by extending your arms",
      "Keep your core tight throughout the movement"
    ],
    tips: [
      "Look slightly ahead, not straight down",
      "Keep elbows at 45-degree angle to your body",
      "Squeeze your glutes for stability"
    ],
    commonMistakes: [
      "Sagging hips (weak core engagement)",
      "Flaring elbows out to 90 degrees",
      "Not going through full range of motion",
      "Looking straight down"
    ],
    youtubeSearchQuery: "proper push up form tutorial"
  },
  {
    name: "Incline Bench Press",
    aliases: ["incline press", "incline barbell press", "upper chest press"],
    category: "compound",
    primaryMuscles: ["upper chest"],
    secondaryMuscles: ["triceps", "front deltoids"],
    equipment: ["barbell", "incline bench"],
    difficulty: "intermediate",
    steps: [
      "Set the bench to a 30-45 degree incline",
      "Lie back with feet flat on the floor",
      "Grip the bar slightly wider than shoulder-width",
      "Unrack and lower the bar to your upper chest",
      "Press the bar back up to starting position"
    ],
    tips: [
      "30-degree angle targets upper chest more",
      "45-degree shifts more work to shoulders",
      "Keep shoulder blades retracted"
    ],
    commonMistakes: [
      "Setting incline too high (becomes shoulder press)",
      "Bouncing bar off chest",
      "Arching back excessively"
    ],
    youtubeSearchQuery: "incline bench press proper form"
  },
  {
    name: "Cable Fly",
    aliases: ["cable crossover", "cable chest fly", "cable flys"],
    category: "isolation",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front deltoids"],
    equipment: ["cable machine"],
    difficulty: "beginner",
    steps: [
      "Set cables to appropriate height (high, mid, or low)",
      "Stand in the center with feet staggered for balance",
      "Grab handles and step forward slightly",
      "With a slight bend in your elbows, bring hands together in front of you",
      "Squeeze your chest at the peak contraction",
      "Slowly return to the starting position with control"
    ],
    tips: [
      "Keep the motion controlled, not jerky",
      "Focus on squeezing the chest muscles",
      "Maintain slight elbow bend throughout"
    ],
    commonMistakes: [
      "Using too much weight and bending arms excessively",
      "Not controlling the negative portion",
      "Leaning too far forward"
    ],
    youtubeSearchQuery: "cable fly chest exercise form"
  },
  {
    name: "Dumbbell Fly",
    aliases: ["db fly", "chest fly", "dumbbell flys", "pec fly"],
    category: "isolation",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front deltoids"],
    equipment: ["dumbbells", "bench"],
    difficulty: "beginner",
    steps: [
      "Lie on a flat bench holding dumbbells above your chest",
      "Keep a slight bend in your elbows throughout",
      "Lower the dumbbells out to your sides in an arc motion",
      "Go down until you feel a stretch in your chest",
      "Bring the dumbbells back up in the same arc motion",
      "Squeeze your chest at the top"
    ],
    tips: [
      "Imagine hugging a large tree",
      "Don't go too deep to avoid shoulder strain",
      "Use lighter weight than pressing movements"
    ],
    commonMistakes: [
      "Straightening arms completely (turns into press)",
      "Going too heavy and losing form",
      "Lowering too fast without control"
    ],
    youtubeSearchQuery: "dumbbell fly proper form"
  },

  // BACK EXERCISES
  {
    name: "Deadlift",
    aliases: ["conventional deadlift", "barbell deadlift", "dead lift"],
    category: "compound",
    primaryMuscles: ["lower back", "glutes", "hamstrings"],
    secondaryMuscles: ["traps", "forearms", "core", "quads"],
    equipment: ["barbell"],
    difficulty: "advanced",
    steps: [
      "Stand with feet hip-width apart, barbell over mid-foot",
      "Bend at hips and knees to grip the bar just outside your legs",
      "Keep your back flat and chest up, looking slightly ahead",
      "Take a deep breath and brace your core",
      "Drive through your heels, pushing the floor away",
      "Keep the bar close to your body as you stand up",
      "Extend your hips and knees simultaneously",
      "Stand tall at the top, squeezing glutes",
      "Lower the bar by hinging at hips first, then bending knees"
    ],
    tips: [
      "Keep the bar as close to your body as possible",
      "Think of pushing the floor away rather than pulling the bar",
      "Engage your lats by 'bending' the bar around your legs",
      "Wear flat shoes or go barefoot for better stability"
    ],
    commonMistakes: [
      "Rounding the lower back (risk of injury)",
      "Starting with hips too high or too low",
      "Jerking the weight off the floor",
      "Letting the bar drift away from the body",
      "Hyperextending at the top"
    ],
    youtubeSearchQuery: "deadlift proper form tutorial beginner"
  },
  {
    name: "Pull-Up",
    aliases: ["pullup", "pull up", "chin up overhand"],
    category: "compound",
    primaryMuscles: ["lats", "upper back"],
    secondaryMuscles: ["biceps", "forearms", "rear deltoids"],
    equipment: ["pull-up bar"],
    difficulty: "intermediate",
    steps: [
      "Hang from the bar with hands slightly wider than shoulder-width, palms facing away",
      "Engage your core and squeeze your shoulder blades together",
      "Pull yourself up by driving your elbows down toward your hips",
      "Continue until your chin is above the bar",
      "Lower yourself with control back to full arm extension",
      "Avoid swinging or using momentum"
    ],
    tips: [
      "Start with assisted variations if needed",
      "Focus on pulling with your back, not just arms",
      "Full range of motion is key"
    ],
    commonMistakes: [
      "Kipping or swinging for momentum",
      "Not going through full range of motion",
      "Shrugging shoulders up toward ears",
      "Using only biceps instead of engaging back"
    ],
    youtubeSearchQuery: "pull up proper form tutorial"
  },
  {
    name: "Bent Over Row",
    aliases: ["barbell row", "bent over barbell row", "pendlay row", "bb row"],
    category: "compound",
    primaryMuscles: ["lats", "middle back"],
    secondaryMuscles: ["biceps", "rear deltoids", "lower back"],
    equipment: ["barbell"],
    difficulty: "intermediate",
    steps: [
      "Stand with feet hip-width apart, holding a barbell",
      "Hinge at the hips until your torso is nearly parallel to the floor",
      "Let the bar hang at arm's length below your shoulders",
      "Pull the bar up to your lower chest/upper abs",
      "Squeeze your shoulder blades together at the top",
      "Lower the bar with control",
      "Keep your back flat throughout the movement"
    ],
    tips: [
      "Keep your core braced to protect your lower back",
      "Pull with your elbows, not your hands",
      "Don't use body momentum to lift the weight"
    ],
    commonMistakes: [
      "Standing too upright (not enough hip hinge)",
      "Rounding the lower back",
      "Using momentum/swinging",
      "Not pulling to the right position"
    ],
    youtubeSearchQuery: "barbell row proper form"
  },
  {
    name: "Lat Pulldown",
    aliases: ["lat pull down", "cable pulldown", "wide grip pulldown"],
    category: "compound",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "rear deltoids", "middle back"],
    equipment: ["cable machine", "lat pulldown machine"],
    difficulty: "beginner",
    steps: [
      "Sit at the lat pulldown machine and adjust the thigh pad",
      "Grab the bar with a wide overhand grip",
      "Lean back slightly and stick your chest out",
      "Pull the bar down to your upper chest",
      "Squeeze your shoulder blades together at the bottom",
      "Slowly return the bar to the starting position",
      "Keep arms slightly bent at the top"
    ],
    tips: [
      "Think about pulling your elbows into your back pockets",
      "Don't lean back excessively",
      "Control the weight on the way up"
    ],
    commonMistakes: [
      "Pulling behind the neck (shoulder injury risk)",
      "Using momentum/leaning back too far",
      "Not going through full range of motion",
      "Gripping too tight with hands"
    ],
    youtubeSearchQuery: "lat pulldown proper form"
  },
  {
    name: "Dumbbell Row",
    aliases: ["one arm row", "single arm row", "db row", "one arm dumbbell row"],
    category: "compound",
    primaryMuscles: ["lats", "middle back"],
    secondaryMuscles: ["biceps", "rear deltoids"],
    equipment: ["dumbbell", "bench"],
    difficulty: "beginner",
    steps: [
      "Place one knee and hand on a bench for support",
      "Hold a dumbbell in the opposite hand, arm extended",
      "Keep your back flat and parallel to the floor",
      "Pull the dumbbell up toward your hip",
      "Squeeze your back at the top of the movement",
      "Lower the dumbbell with control",
      "Complete all reps then switch sides"
    ],
    tips: [
      "Keep your core engaged for stability",
      "Don't rotate your torso as you row",
      "Think about driving your elbow to the ceiling"
    ],
    commonMistakes: [
      "Rotating the torso during the lift",
      "Not pulling high enough",
      "Rounding the back",
      "Using momentum"
    ],
    youtubeSearchQuery: "dumbbell row single arm form"
  },
  {
    name: "Seated Cable Row",
    aliases: ["cable row", "seated row", "low row"],
    category: "compound",
    primaryMuscles: ["middle back", "lats"],
    secondaryMuscles: ["biceps", "rear deltoids"],
    equipment: ["cable machine"],
    difficulty: "beginner",
    steps: [
      "Sit at the cable row machine with feet on the platform",
      "Grab the handle with arms extended, back straight",
      "Keep a slight bend in your knees",
      "Pull the handle toward your lower chest/upper abs",
      "Squeeze your shoulder blades together",
      "Slowly extend your arms back to the start",
      "Keep your torso stationary throughout"
    ],
    tips: [
      "Don't lean back excessively",
      "Focus on squeezing the back muscles",
      "Keep shoulders down, away from ears"
    ],
    commonMistakes: [
      "Using momentum by rocking back and forth",
      "Pulling with arms instead of back",
      "Shrugging shoulders up",
      "Rounding the lower back"
    ],
    youtubeSearchQuery: "seated cable row proper form"
  },

  // SHOULDER EXERCISES
  {
    name: "Overhead Press",
    aliases: ["shoulder press", "military press", "ohp", "barbell shoulder press"],
    category: "compound",
    primaryMuscles: ["front deltoids", "side deltoids"],
    secondaryMuscles: ["triceps", "upper chest", "traps"],
    equipment: ["barbell"],
    difficulty: "intermediate",
    steps: [
      "Stand with feet shoulder-width apart",
      "Hold the barbell at shoulder level, grip just outside shoulders",
      "Take a breath and brace your core",
      "Press the bar straight up overhead",
      "Move your head back slightly as the bar passes your face",
      "Lock out arms at the top with bar over mid-foot",
      "Lower the bar back to shoulder level with control"
    ],
    tips: [
      "Keep your core tight to protect your lower back",
      "Don't lean back excessively",
      "Full lockout at the top is important"
    ],
    commonMistakes: [
      "Excessive lower back arch",
      "Pressing the bar forward instead of straight up",
      "Not going through full range of motion",
      "Flaring elbows out too wide"
    ],
    youtubeSearchQuery: "overhead press proper form"
  },
  {
    name: "Lateral Raise",
    aliases: ["side raise", "side lateral raise", "dumbbell lateral raise"],
    category: "isolation",
    primaryMuscles: ["side deltoids"],
    secondaryMuscles: ["front deltoids", "traps"],
    equipment: ["dumbbells"],
    difficulty: "beginner",
    steps: [
      "Stand with dumbbells at your sides, palms facing in",
      "Keep a slight bend in your elbows",
      "Raise the dumbbells out to your sides",
      "Lift until arms are parallel to the floor",
      "Lead with your elbows, not your hands",
      "Lower slowly back to the starting position"
    ],
    tips: [
      "Use lighter weight for better control",
      "Think about pouring water from a pitcher at the top",
      "Control the negative portion"
    ],
    commonMistakes: [
      "Using momentum/swinging",
      "Raising dumbbells too high (above shoulders)",
      "Shrugging shoulders up",
      "Going too heavy and losing form"
    ],
    youtubeSearchQuery: "lateral raise proper form"
  },
  {
    name: "Front Raise",
    aliases: ["front dumbbell raise", "front shoulder raise"],
    category: "isolation",
    primaryMuscles: ["front deltoids"],
    secondaryMuscles: ["side deltoids"],
    equipment: ["dumbbells"],
    difficulty: "beginner",
    steps: [
      "Stand holding dumbbells in front of your thighs",
      "Palms can face down or toward each other",
      "Keeping arms straight (slight bend), raise one or both dumbbells",
      "Lift to shoulder height or slightly above",
      "Lower with control back to starting position",
      "Alternate arms or do both together"
    ],
    tips: [
      "Don't swing or use momentum",
      "Keep core engaged throughout",
      "Control the weight on the way down"
    ],
    commonMistakes: [
      "Using momentum to swing weights",
      "Leaning back",
      "Going too heavy",
      "Raising too high above shoulder level"
    ],
    youtubeSearchQuery: "front raise dumbbell form"
  },
  {
    name: "Face Pull",
    aliases: ["cable face pull", "rear delt pull"],
    category: "isolation",
    primaryMuscles: ["rear deltoids"],
    secondaryMuscles: ["traps", "rhomboids", "rotator cuff"],
    equipment: ["cable machine", "rope attachment"],
    difficulty: "beginner",
    steps: [
      "Set cable at upper chest to face height",
      "Attach a rope handle",
      "Grab the rope with thumbs pointing back",
      "Step back and hold with arms extended",
      "Pull the rope toward your face, separating the ends",
      "Squeeze shoulder blades together",
      "Your hands should end up beside your ears",
      "Return to start with control"
    ],
    tips: [
      "Focus on rear deltoids and upper back squeeze",
      "Keep elbows high throughout the movement",
      "Great exercise for shoulder health and posture"
    ],
    commonMistakes: [
      "Pulling too low (toward chest instead of face)",
      "Not separating the rope at the end",
      "Using too much weight",
      "Elbows dropping during the pull"
    ],
    youtubeSearchQuery: "face pull exercise form"
  },
  {
    name: "Arnold Press",
    aliases: ["arnold dumbbell press", "rotating shoulder press"],
    category: "compound",
    primaryMuscles: ["front deltoids", "side deltoids"],
    secondaryMuscles: ["triceps"],
    equipment: ["dumbbells"],
    difficulty: "intermediate",
    steps: [
      "Sit on a bench with back support",
      "Hold dumbbells at shoulder level, palms facing you",
      "As you press up, rotate your palms to face forward",
      "Continue pressing until arms are extended overhead",
      "Reverse the motion: lower while rotating palms back toward you",
      "End with palms facing you at shoulder level"
    ],
    tips: [
      "The rotation increases time under tension",
      "Great for overall shoulder development",
      "Use controlled, fluid motion"
    ],
    commonMistakes: [
      "Rushing the rotation",
      "Not going through full range of motion",
      "Using momentum"
    ],
    youtubeSearchQuery: "arnold press proper form"
  },

  // LEG EXERCISES
  {
    name: "Squat",
    aliases: ["barbell squat", "back squat", "bb squat"],
    category: "compound",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "lower back", "core"],
    equipment: ["barbell", "squat rack"],
    difficulty: "intermediate",
    steps: [
      "Position the bar on your upper back (high or low bar position)",
      "Stand with feet shoulder-width apart, toes slightly out",
      "Take a deep breath and brace your core",
      "Begin by pushing your hips back and bending your knees",
      "Keep your chest up and back straight as you descend",
      "Go down until thighs are at least parallel to the floor",
      "Drive through your feet to stand back up",
      "Squeeze glutes at the top"
    ],
    tips: [
      "Keep knees tracking over toes",
      "Don't let knees cave inward",
      "Maintain a neutral spine throughout",
      "Experiment with stance width to find what's comfortable"
    ],
    commonMistakes: [
      "Knees caving inward",
      "Rounding the lower back",
      "Not going deep enough",
      "Rising on toes",
      "Leaning too far forward"
    ],
    youtubeSearchQuery: "barbell squat proper form"
  },
  {
    name: "Leg Press",
    aliases: ["machine leg press", "45 degree leg press"],
    category: "compound",
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes", "hamstrings"],
    equipment: ["leg press machine"],
    difficulty: "beginner",
    steps: [
      "Sit in the leg press machine with back against the pad",
      "Place feet shoulder-width apart on the platform",
      "Release the safety handles",
      "Lower the weight by bending your knees toward your chest",
      "Go down until knees are at about 90 degrees",
      "Push through your heels to extend your legs",
      "Don't lock out your knees completely at the top"
    ],
    tips: [
      "Higher foot placement targets glutes/hamstrings more",
      "Lower foot placement targets quads more",
      "Keep your lower back pressed against the pad"
    ],
    commonMistakes: [
      "Letting lower back round off the pad",
      "Locking knees at the top",
      "Going too heavy with poor form",
      "Bouncing at the bottom"
    ],
    youtubeSearchQuery: "leg press proper form"
  },
  {
    name: "Romanian Deadlift",
    aliases: ["rdl", "stiff leg deadlift", "romanian dl"],
    category: "compound",
    primaryMuscles: ["hamstrings", "glutes"],
    secondaryMuscles: ["lower back"],
    equipment: ["barbell", "dumbbells"],
    difficulty: "intermediate",
    steps: [
      "Stand holding a barbell at hip level",
      "Keep a slight bend in your knees throughout",
      "Push your hips back while lowering the bar",
      "Keep the bar close to your legs as you descend",
      "Lower until you feel a stretch in your hamstrings",
      "Drive your hips forward to return to standing",
      "Squeeze your glutes at the top"
    ],
    tips: [
      "Focus on hip hinge, not knee bend",
      "Keep your back flat, not rounded",
      "Think about pushing your hips to the wall behind you"
    ],
    commonMistakes: [
      "Rounding the lower back",
      "Bending knees too much (becomes regular deadlift)",
      "Looking up (strains neck)",
      "Going too low beyond flexibility"
    ],
    youtubeSearchQuery: "romanian deadlift rdl form"
  },
  {
    name: "Lunge",
    aliases: ["walking lunge", "forward lunge", "dumbbell lunge"],
    category: "compound",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "core"],
    equipment: ["bodyweight", "dumbbells"],
    difficulty: "beginner",
    steps: [
      "Stand tall with feet hip-width apart",
      "Step forward with one leg",
      "Lower your body until both knees are at 90 degrees",
      "Front knee should be over ankle, not past toes",
      "Back knee should nearly touch the floor",
      "Push through the front heel to return to standing",
      "Repeat on the other leg"
    ],
    tips: [
      "Keep your torso upright throughout",
      "Take a big enough step forward",
      "Control your descent"
    ],
    commonMistakes: [
      "Front knee going past toes",
      "Leaning torso forward",
      "Taking too short of a step",
      "Letting back knee slam into the ground"
    ],
    youtubeSearchQuery: "lunge proper form tutorial"
  },
  {
    name: "Leg Extension",
    aliases: ["quad extension", "leg extension machine"],
    category: "isolation",
    primaryMuscles: ["quads"],
    secondaryMuscles: [],
    equipment: ["leg extension machine"],
    difficulty: "beginner",
    steps: [
      "Sit in the machine with back against the pad",
      "Position the ankle pad just above your feet",
      "Grip the handles on the sides",
      "Extend your legs until they're straight",
      "Squeeze your quads at the top",
      "Lower the weight with control",
      "Don't let the weight stack touch between reps"
    ],
    tips: [
      "Focus on the contraction at the top",
      "Control the negative portion",
      "Avoid jerky movements"
    ],
    commonMistakes: [
      "Using momentum to swing the weight",
      "Not going through full range of motion",
      "Letting weight drop quickly"
    ],
    youtubeSearchQuery: "leg extension machine form"
  },
  {
    name: "Leg Curl",
    aliases: ["hamstring curl", "lying leg curl", "seated leg curl"],
    category: "isolation",
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: [],
    equipment: ["leg curl machine"],
    difficulty: "beginner",
    steps: [
      "Position yourself in the leg curl machine",
      "Adjust the pad so it rests on your lower calves",
      "Grip the handles for stability",
      "Curl your legs by bending at the knees",
      "Bring your heels toward your glutes",
      "Squeeze your hamstrings at the peak",
      "Lower the weight slowly to starting position"
    ],
    tips: [
      "Keep your hips pressed down (lying version)",
      "Don't let momentum take over",
      "Full range of motion is key"
    ],
    commonMistakes: [
      "Lifting hips off the pad",
      "Using momentum",
      "Not controlling the negative"
    ],
    youtubeSearchQuery: "leg curl proper form"
  },
  {
    name: "Calf Raise",
    aliases: ["standing calf raise", "calf raises", "seated calf raise"],
    category: "isolation",
    primaryMuscles: ["calves"],
    secondaryMuscles: [],
    equipment: ["calf raise machine", "smith machine", "dumbbells"],
    difficulty: "beginner",
    steps: [
      "Stand on the edge of a platform with heels hanging off",
      "Hold weight or use a machine for resistance",
      "Lower your heels below the platform level for a stretch",
      "Push through the balls of your feet to raise up",
      "Go as high as possible onto your toes",
      "Pause and squeeze at the top",
      "Lower with control back to the stretched position"
    ],
    tips: [
      "Full range of motion is important for calves",
      "Pause at the top for better contraction",
      "Try different rep ranges (calves respond well to high reps)"
    ],
    commonMistakes: [
      "Bouncing at the bottom",
      "Not going through full range of motion",
      "Using momentum instead of controlled movement"
    ],
    youtubeSearchQuery: "calf raise proper form"
  },
  {
    name: "Hip Thrust",
    aliases: ["barbell hip thrust", "glute bridge", "weighted hip thrust"],
    category: "compound",
    primaryMuscles: ["glutes"],
    secondaryMuscles: ["hamstrings", "core"],
    equipment: ["barbell", "bench"],
    difficulty: "intermediate",
    steps: [
      "Sit with your upper back against a bench",
      "Roll a barbell over your hips (use a pad for comfort)",
      "Position feet flat on the floor, hip-width apart",
      "Drive through your heels and thrust hips upward",
      "Squeeze your glutes hard at the top",
      "Your body should form a straight line from shoulders to knees",
      "Lower your hips back down with control"
    ],
    tips: [
      "Keep chin tucked to avoid neck strain",
      "Focus on squeezing glutes, not arching back",
      "Feet position affects muscle activation"
    ],
    commonMistakes: [
      "Hyperextending the lower back at the top",
      "Not going through full range of motion",
      "Pushing through toes instead of heels",
      "Not pausing at the top"
    ],
    youtubeSearchQuery: "hip thrust barbell form"
  },

  // ARM EXERCISES
  {
    name: "Bicep Curl",
    aliases: ["barbell curl", "dumbbell curl", "biceps curl", "curls"],
    category: "isolation",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
    equipment: ["dumbbells", "barbell", "ez curl bar"],
    difficulty: "beginner",
    steps: [
      "Stand with feet shoulder-width apart",
      "Hold weights with arms fully extended, palms facing forward",
      "Keep your elbows close to your sides",
      "Curl the weight up by bending your elbows",
      "Squeeze your biceps at the top",
      "Lower the weight slowly to full extension",
      "Keep your upper arms stationary throughout"
    ],
    tips: [
      "Don't swing or use momentum",
      "Control the weight on the way down",
      "Keep wrists straight"
    ],
    commonMistakes: [
      "Swinging the body for momentum",
      "Elbows drifting forward",
      "Not going through full range of motion",
      "Going too heavy and losing form"
    ],
    youtubeSearchQuery: "bicep curl proper form"
  },
  {
    name: "Hammer Curl",
    aliases: ["dumbbell hammer curl", "neutral grip curl"],
    category: "isolation",
    primaryMuscles: ["biceps", "brachialis"],
    secondaryMuscles: ["forearms"],
    equipment: ["dumbbells"],
    difficulty: "beginner",
    steps: [
      "Stand holding dumbbells at your sides",
      "Keep palms facing each other (neutral grip)",
      "Curl the dumbbells up while maintaining neutral grip",
      "Keep elbows close to your body",
      "Squeeze at the top",
      "Lower with control",
      "Can be done alternating or together"
    ],
    tips: [
      "Great for overall arm thickness",
      "Hits the brachialis which pushes up the bicep",
      "Neutral grip is easier on the wrists"
    ],
    commonMistakes: [
      "Rotating wrists during the curl",
      "Swinging for momentum",
      "Letting elbows drift forward"
    ],
    youtubeSearchQuery: "hammer curl form"
  },
  {
    name: "Tricep Pushdown",
    aliases: ["cable pushdown", "tricep press down", "rope pushdown"],
    category: "isolation",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    equipment: ["cable machine"],
    difficulty: "beginner",
    steps: [
      "Stand facing a high pulley cable machine",
      "Grab the bar or rope attachment",
      "Keep elbows pinned to your sides",
      "Push the weight down by extending your arms",
      "Squeeze your triceps at the bottom",
      "Slowly return to starting position",
      "Don't let elbows drift forward"
    ],
    tips: [
      "Keep your torso upright, slight lean is okay",
      "Focus on the squeeze at full extension",
      "Rope attachment allows for split at the bottom"
    ],
    commonMistakes: [
      "Elbows flaring out or moving forward",
      "Using shoulders instead of triceps",
      "Not going through full range of motion",
      "Using momentum"
    ],
    youtubeSearchQuery: "tricep pushdown cable form"
  },
  {
    name: "Skull Crusher",
    aliases: ["lying tricep extension", "french press", "skull crushers"],
    category: "isolation",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
    equipment: ["ez curl bar", "dumbbells", "barbell"],
    difficulty: "intermediate",
    steps: [
      "Lie on a flat bench holding a weight above your chest",
      "Arms should be extended and perpendicular to the floor",
      "Keeping upper arms stationary, bend your elbows",
      "Lower the weight toward your forehead",
      "Stop just before the weight reaches your forehead",
      "Extend your arms back to the starting position",
      "Keep elbows pointed toward the ceiling"
    ],
    tips: [
      "Use a controlled motion throughout",
      "Don't actually crush your skull - stop short!",
      "EZ bar is often more comfortable on wrists"
    ],
    commonMistakes: [
      "Flaring elbows out",
      "Moving upper arms during the lift",
      "Going too heavy and losing form",
      "Lowering too fast"
    ],
    youtubeSearchQuery: "skull crusher tricep form"
  },
  {
    name: "Tricep Dip",
    aliases: ["dips", "parallel bar dip", "bench dip"],
    category: "compound",
    primaryMuscles: ["triceps"],
    secondaryMuscles: ["chest", "front deltoids"],
    equipment: ["dip bars", "bench"],
    difficulty: "intermediate",
    steps: [
      "Grip the parallel bars and lift yourself up",
      "Arms should be straight with body upright",
      "Keep legs straight or bent behind you",
      "Lower your body by bending your elbows",
      "Go down until upper arms are parallel to floor",
      "Push back up to the starting position",
      "Keep torso upright for tricep focus"
    ],
    tips: [
      "Upright torso = more triceps",
      "Leaning forward = more chest",
      "Start with assisted dips if needed"
    ],
    commonMistakes: [
      "Going too deep (shoulder strain)",
      "Not going deep enough",
      "Swinging or using momentum",
      "Shrugging shoulders"
    ],
    youtubeSearchQuery: "tricep dips proper form"
  },
  {
    name: "Preacher Curl",
    aliases: ["preacher bench curl", "ez bar preacher curl"],
    category: "isolation",
    primaryMuscles: ["biceps"],
    secondaryMuscles: [],
    equipment: ["preacher bench", "ez curl bar", "dumbbells"],
    difficulty: "beginner",
    steps: [
      "Sit at the preacher bench with armpits near the top of the pad",
      "Hold the bar or dumbbell with arms extended",
      "Curl the weight up toward your shoulders",
      "Squeeze at the top of the movement",
      "Lower the weight slowly with control",
      "Don't fully lock out at the bottom to maintain tension"
    ],
    tips: [
      "The pad prevents cheating with momentum",
      "Great for bicep isolation",
      "Focus on the squeeze at the top"
    ],
    commonMistakes: [
      "Lifting glutes off the seat",
      "Not going through full range of motion",
      "Using momentum on the way up"
    ],
    youtubeSearchQuery: "preacher curl form"
  },

  // CORE EXERCISES
  {
    name: "Plank",
    aliases: ["forearm plank", "front plank"],
    category: "isolation",
    primaryMuscles: ["core", "abs"],
    secondaryMuscles: ["shoulders", "glutes"],
    equipment: ["bodyweight"],
    difficulty: "beginner",
    steps: [
      "Start in a push-up position",
      "Lower down to your forearms",
      "Keep your body in a straight line from head to heels",
      "Engage your core by pulling belly button to spine",
      "Keep your hips level - don't sag or pike up",
      "Look at the floor to keep neck neutral",
      "Hold the position for time"
    ],
    tips: [
      "Squeeze your glutes for stability",
      "Don't hold your breath",
      "Quality over duration"
    ],
    commonMistakes: [
      "Hips sagging down",
      "Hips piking up too high",
      "Holding breath",
      "Looking up and straining neck"
    ],
    youtubeSearchQuery: "plank exercise proper form"
  },
  {
    name: "Crunch",
    aliases: ["ab crunch", "crunches", "abdominal crunch"],
    category: "isolation",
    primaryMuscles: ["abs"],
    secondaryMuscles: [],
    equipment: ["bodyweight"],
    difficulty: "beginner",
    steps: [
      "Lie on your back with knees bent, feet flat",
      "Place hands behind your head or across chest",
      "Engage your core and lift shoulder blades off floor",
      "Curl up toward your knees, exhaling as you rise",
      "Pause at the top and squeeze your abs",
      "Lower back down with control",
      "Keep lower back pressed into the floor"
    ],
    tips: [
      "Don't pull on your neck",
      "Focus on curling your ribs toward your hips",
      "Quality over quantity"
    ],
    commonMistakes: [
      "Pulling on the neck with hands",
      "Using momentum to sit all the way up",
      "Not engaging core properly",
      "Moving too fast"
    ],
    youtubeSearchQuery: "crunch ab exercise form"
  },
  {
    name: "Hanging Leg Raise",
    aliases: ["leg raise", "hanging knee raise", "captain's chair"],
    category: "isolation",
    primaryMuscles: ["lower abs"],
    secondaryMuscles: ["hip flexors"],
    equipment: ["pull-up bar", "captain's chair"],
    difficulty: "intermediate",
    steps: [
      "Hang from a pull-up bar with arms extended",
      "Keep your body straight, core engaged",
      "Raise your legs by flexing at the hips",
      "Bring legs up until parallel to floor (or higher)",
      "Lower legs with control",
      "Avoid swinging or using momentum",
      "Beginners can bend knees to make it easier"
    ],
    tips: [
      "Control the movement throughout",
      "Don't swing - start each rep from dead hang",
      "Bent knee version is easier to start"
    ],
    commonMistakes: [
      "Swinging for momentum",
      "Not raising legs high enough",
      "Dropping legs too fast"
    ],
    youtubeSearchQuery: "hanging leg raise form"
  },
  {
    name: "Russian Twist",
    aliases: ["seated twist", "medicine ball twist"],
    category: "isolation",
    primaryMuscles: ["obliques"],
    secondaryMuscles: ["abs"],
    equipment: ["bodyweight", "medicine ball", "dumbbell"],
    difficulty: "beginner",
    steps: [
      "Sit on the floor with knees bent",
      "Lean back slightly to engage core",
      "Lift feet off the floor (optional for more difficulty)",
      "Hold weight at chest or extend arms",
      "Rotate your torso to one side",
      "Touch weight to floor beside your hip",
      "Rotate to the other side",
      "Keep core engaged throughout"
    ],
    tips: [
      "Move your whole torso, not just your arms",
      "Keep chest up and back straight",
      "Control the rotation speed"
    ],
    commonMistakes: [
      "Only moving arms, not torso",
      "Rounding the back",
      "Moving too fast with no control"
    ],
    youtubeSearchQuery: "russian twist exercise form"
  },
  {
    name: "Dead Bug",
    aliases: ["dead bugs", "dying bug"],
    category: "isolation",
    primaryMuscles: ["core", "abs"],
    secondaryMuscles: ["hip flexors"],
    equipment: ["bodyweight"],
    difficulty: "beginner",
    steps: [
      "Lie on your back with arms extended toward ceiling",
      "Lift legs with knees bent at 90 degrees",
      "Press lower back firmly into the floor",
      "Slowly extend one arm back and opposite leg out",
      "Keep lower back pressed down throughout",
      "Return to starting position",
      "Repeat on opposite side"
    ],
    tips: [
      "The key is keeping lower back flat",
      "Move slowly and with control",
      "Breathe out as you extend"
    ],
    commonMistakes: [
      "Lower back arching off the floor",
      "Moving too quickly",
      "Not extending limbs fully"
    ],
    youtubeSearchQuery: "dead bug exercise form"
  },

  // CARDIO EXERCISES
  {
    name: "Burpee",
    aliases: ["burpees"],
    category: "cardio",
    primaryMuscles: ["full body"],
    secondaryMuscles: ["chest", "shoulders", "quads", "core"],
    equipment: ["bodyweight"],
    difficulty: "intermediate",
    steps: [
      "Start standing with feet shoulder-width apart",
      "Drop into a squat and place hands on floor",
      "Jump or step feet back into plank position",
      "Perform a push-up (optional)",
      "Jump or step feet back toward hands",
      "Explosively jump up with arms overhead",
      "Land softly and repeat"
    ],
    tips: [
      "Focus on form over speed initially",
      "Modify by stepping instead of jumping",
      "Keep core engaged throughout"
    ],
    commonMistakes: [
      "Sagging hips in plank position",
      "Not going through full range of motion",
      "Landing with locked knees"
    ],
    youtubeSearchQuery: "burpee exercise proper form"
  },
  {
    name: "Mountain Climber",
    aliases: ["mountain climbers", "running plank"],
    category: "cardio",
    primaryMuscles: ["core"],
    secondaryMuscles: ["shoulders", "hip flexors", "quads"],
    equipment: ["bodyweight"],
    difficulty: "beginner",
    steps: [
      "Start in a push-up position",
      "Keep your body in a straight line",
      "Drive one knee toward your chest",
      "Quickly switch legs, extending the first leg back",
      "Continue alternating legs in a running motion",
      "Keep hips low and core engaged",
      "Move as fast as possible while maintaining form"
    ],
    tips: [
      "Keep shoulders over wrists",
      "Don't let hips bounce up and down",
      "Breathe steadily"
    ],
    commonMistakes: [
      "Hips piking up too high",
      "Not bringing knees far enough forward",
      "Bouncing instead of smooth motion"
    ],
    youtubeSearchQuery: "mountain climber exercise form"
  },
  {
    name: "Jumping Jack",
    aliases: ["jumping jacks", "star jumps"],
    category: "cardio",
    primaryMuscles: ["full body"],
    secondaryMuscles: ["calves", "shoulders"],
    equipment: ["bodyweight"],
    difficulty: "beginner",
    steps: [
      "Stand with feet together, arms at sides",
      "Jump and spread feet wider than hip-width",
      "Simultaneously raise arms overhead",
      "Jump again to return to starting position",
      "Arms come back down to sides",
      "Repeat continuously"
    ],
    tips: [
      "Land softly on the balls of your feet",
      "Keep core engaged",
      "Maintain a steady rhythm"
    ],
    commonMistakes: [
      "Landing with locked knees",
      "Not going through full range of motion",
      "Arms not fully extending overhead"
    ],
    youtubeSearchQuery: "jumping jacks proper form"
  },
  {
    name: "Box Jump",
    aliases: ["box jumps", "plyo box jump"],
    category: "cardio",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["calves", "hamstrings", "core"],
    equipment: ["plyo box"],
    difficulty: "intermediate",
    steps: [
      "Stand facing a sturdy box",
      "Feet should be hip-width apart",
      "Swing arms back and hinge at hips",
      "Explosively jump up onto the box",
      "Land softly with both feet fully on the box",
      "Stand up straight at the top",
      "Step down (don't jump down to save joints)"
    ],
    tips: [
      "Start with a lower box and progress",
      "Focus on landing softly",
      "Step down to protect your joints"
    ],
    commonMistakes: [
      "Landing too close to the edge",
      "Not landing softly",
      "Jumping down instead of stepping"
    ],
    youtubeSearchQuery: "box jump exercise form"
  },
  {
    name: "Jump Rope",
    aliases: ["skipping rope", "rope skipping", "jump roping"],
    category: "cardio",
    primaryMuscles: ["calves"],
    secondaryMuscles: ["shoulders", "forearms", "core"],
    equipment: ["jump rope"],
    difficulty: "beginner",
    steps: [
      "Hold handles with rope behind you",
      "Swing rope overhead using wrists, not arms",
      "Jump just high enough to clear the rope",
      "Land on balls of feet with slight knee bend",
      "Keep elbows close to sides",
      "Maintain a steady, rhythmic pace"
    ],
    tips: [
      "Use your wrists to turn the rope, not shoulders",
      "Jump only 1-2 inches off the ground",
      "Keep core tight for stability"
    ],
    commonMistakes: [
      "Jumping too high",
      "Using arms instead of wrists",
      "Landing flat-footed"
    ],
    youtubeSearchQuery: "jump rope technique beginners"
  }
];

export function findExercise(query: string): Exercise | null {
  const lowerQuery = query.toLowerCase().trim();
  
  for (const exercise of exerciseDatabase) {
    if (exercise.name.toLowerCase() === lowerQuery) {
      return exercise;
    }
    
    for (const alias of exercise.aliases) {
      if (alias.toLowerCase() === lowerQuery) {
        return exercise;
      }
    }
  }
  
  for (const exercise of exerciseDatabase) {
    if (exercise.name.toLowerCase().includes(lowerQuery) || 
        lowerQuery.includes(exercise.name.toLowerCase())) {
      return exercise;
    }
    
    for (const alias of exercise.aliases) {
      if (alias.toLowerCase().includes(lowerQuery) || 
          lowerQuery.includes(alias.toLowerCase())) {
        return exercise;
      }
    }
  }
  
  return null;
}

export function formatExerciseResponse(exercise: Exercise): string {
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.youtubeSearchQuery)}`;
  
  let response = `**${exercise.name}**\n\n`;
  
  response += `**Target Muscles:** ${exercise.primaryMuscles.join(', ')}`;
  if (exercise.secondaryMuscles.length > 0) {
    response += ` (also works: ${exercise.secondaryMuscles.join(', ')})`;
  }
  response += `\n\n`;
  
  response += `**Equipment:** ${exercise.equipment.join(', ')}\n`;
  response += `**Difficulty:** ${exercise.difficulty.charAt(0).toUpperCase() + exercise.difficulty.slice(1)}\n\n`;
  
  response += `**Step-by-Step Instructions:**\n`;
  exercise.steps.forEach((step, index) => {
    response += `${index + 1}. ${step}\n`;
  });
  
  response += `\n**Pro Tips:**\n`;
  exercise.tips.forEach(tip => {
    response += `- ${tip}\n`;
  });
  
  response += `\n**Common Mistakes to Avoid:**\n`;
  exercise.commonMistakes.forEach(mistake => {
    response += `- ${mistake}\n`;
  });
  
  response += `\n**Watch Video Tutorial:** [YouTube](${youtubeUrl})`;
  
  return response;
}

export function detectExerciseQuestion(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  const analyticsKeywords = /(?:progress|trend|history|over\s+(?:the\s+)?(?:last|past)|improved|changed|progressed|stronger|weaker|compare|comparison|\d+\s+(?:week|month|day)|how\s+(?:has|have|is)\s+my|percentage|percent|%|undertraining|overtrain|volume\s+analysis|frequency\s+trend|consistency|adherence|surplus|deficit|analytics|when\s+do\s+i\s+(?:usually\s+)?(?:skip|miss)|how\s+(?:often|many\s+times))/i;
  if (analyticsKeywords.test(lowerMessage)) {
    return null;
  }

  const patterns = [
    /how (?:do i|to|can i|should i) (?:do|perform|execute) (?:a |an |the )?(.+?)(?:\?|$|properly|correctly|right)/i,
    /(?:proper|correct|right|best) (?:form|technique|way) (?:for|to do) (?:a |an |the )?(.+?)(?:\?|$)/i,
    /what(?:'s| is) the (?:proper|correct|right|best) way to (?:do|perform) (?:a |an |the )?(.+?)(?:\?|$)/i,
    /teach me (?:how to do |about )?(?:a |an |the )?(.+?)(?:\?|$)/i,
    /explain (?:how to do |)?(?:a |an |the )?(.+?)(?:\?|$)/i,
    /show me (?:how to do |)?(?:a |an |the )?(.+?)(?:\?|$)/i,
    /what are (.+?) and how/i,
    /tips for (.+?)(?:\?|$)/i,
    /(.+?) form(?:\?|$)/i,
    /(.+?) technique(?:\?|$)/i,
    /how (?:do i|to) (.+?)(?:\?|$)/i
  ];
  
  for (const pattern of patterns) {
    const match = lowerMessage.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  for (const exercise of exerciseDatabase) {
    if (lowerMessage.includes(exercise.name.toLowerCase())) {
      return exercise.name;
    }
    for (const alias of exercise.aliases) {
      if (lowerMessage.includes(alias.toLowerCase())) {
        return alias;
      }
    }
  }
  
  return null;
}
