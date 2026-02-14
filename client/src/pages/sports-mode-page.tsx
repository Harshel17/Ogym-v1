import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Trophy, Dumbbell, Target, Zap, ChevronRight, ChevronLeft, Loader2,
  ArrowLeft, Trash2, Activity, Medal, Brain, Waves, Swords, Crosshair,
  type LucideIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { SportProfile, SportProgram } from "@shared/schema";

const SPORT_ICONS: Record<string, LucideIcon> = {
  "Football (Soccer)": Trophy,
  "Basketball": Target,
  "Tennis": Crosshair,
  "Swimming": Waves,
  "Boxing": Swords,
  "MMA": Swords,
  "Cricket": Dumbbell,
  "Volleyball": Medal,
};

const SPORTS_DATA: Record<string, { roles: string[]; skills: Record<string, string[]> }> = {
  "Football (Soccer)": {
    roles: ["Striker", "Midfielder", "Defender", "Goalkeeper", "Winger", "Full-back"],
    skills: {
      "Ball Control": ["First Touch", "Dribbling", "Ball Juggling", "Close Control"],
      "Shooting": ["Power Shots", "Finesse Shots", "Volleys", "Free Kicks"],
      "Passing": ["Short Passing", "Long Passing", "Through Balls", "Crossing"],
      "Defense": ["Tackling", "Positioning", "Marking", "Interceptions"],
      "Physical": ["Speed & Agility", "Stamina", "Strength", "Jumping"],
    },
  },
  "Basketball": {
    roles: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"],
    skills: {
      "Shooting": ["Three-Point", "Mid-Range", "Free Throws", "Layups"],
      "Ball Handling": ["Crossovers", "Behind the Back", "Hesitation", "Speed Dribble"],
      "Defense": ["On-Ball Defense", "Help Defense", "Shot Blocking", "Steals"],
      "Playmaking": ["Court Vision", "Pick and Roll", "Fast Break", "Entry Passes"],
      "Physical": ["Vertical Jump", "Lateral Quickness", "Core Strength", "Conditioning"],
    },
  },
  "Tennis": {
    roles: ["Baseline Player", "Serve-and-Volley", "All-Court Player", "Counterpuncher"],
    skills: {
      "Groundstrokes": ["Forehand", "Backhand", "Topspin", "Slice"],
      "Serve": ["First Serve Power", "Second Serve Spin", "Placement", "Serve & Volley"],
      "Net Play": ["Volleys", "Overheads", "Drop Shots", "Approach Shots"],
      "Movement": ["Footwork", "Court Coverage", "Split Step", "Recovery"],
      "Mental": ["Match Strategy", "Pressure Points", "Consistency", "Shot Selection"],
    },
  },
  "Swimming": {
    roles: ["Sprinter", "Distance Swimmer", "Medley Swimmer", "Open Water"],
    skills: {
      "Freestyle": ["Stroke Technique", "Breathing Pattern", "Kick Efficiency", "Turns"],
      "Backstroke": ["Body Position", "Arm Pull", "Kick Technique", "Start & Turns"],
      "Breaststroke": ["Pull & Kick Timing", "Streamline", "Turns", "Pullouts"],
      "Butterfly": ["Undulation", "Arm Recovery", "Kick Rhythm", "Breathing"],
      "Endurance": ["Aerobic Base", "Threshold Training", "Race Pacing", "Recovery"],
    },
  },
  "Boxing": {
    roles: ["Outfighter", "Slugger", "Swarmer", "Boxer-Puncher"],
    skills: {
      "Punching": ["Jab", "Cross", "Hook", "Uppercut"],
      "Defense": ["Head Movement", "Footwork", "Blocking", "Parrying"],
      "Combinations": ["1-2 Combo", "Body Work", "Counter Punching", "Feints"],
      "Conditioning": ["Cardio Endurance", "Power Training", "Core Strength", "Speed Drills"],
      "Ring IQ": ["Distance Management", "Angles", "Pressure Fighting", "Round Strategy"],
    },
  },
  "MMA": {
    roles: ["Striker", "Grappler", "Wrestler", "Well-Rounded"],
    skills: {
      "Striking": ["Boxing", "Kickboxing", "Elbows & Knees", "Clinch Work"],
      "Wrestling": ["Takedowns", "Takedown Defense", "Cage Control", "Ground & Pound"],
      "Jiu-Jitsu": ["Submissions", "Guard Play", "Sweeps", "Escapes"],
      "Conditioning": ["Cardio", "Explosive Power", "Grip Strength", "Recovery"],
      "Strategy": ["Fight IQ", "Distance Management", "Transitions", "Game Planning"],
    },
  },
  "Cricket": {
    roles: ["Batsman", "Bowler", "All-Rounder", "Wicket-Keeper"],
    skills: {
      "Batting": ["Drive", "Pull Shot", "Cut Shot", "Sweep"],
      "Bowling": ["Pace", "Swing", "Spin", "Yorkers"],
      "Fielding": ["Catching", "Throwing", "Ground Fielding", "Diving"],
      "Fitness": ["Speed & Agility", "Stamina", "Flexibility", "Core Strength"],
      "Mental": ["Concentration", "Match Awareness", "Pressure Handling", "Shot Selection"],
    },
  },
  "Volleyball": {
    roles: ["Setter", "Outside Hitter", "Middle Blocker", "Libero", "Opposite"],
    skills: {
      "Attacking": ["Spike Technique", "Back Row Attack", "Tip/Roll Shot", "Approach"],
      "Setting": ["Hand Setting", "Jump Setting", "Back Setting", "Quick Sets"],
      "Blocking": ["Timing", "Read Blocking", "Commit Block", "Transition"],
      "Passing": ["Platform Pass", "Serve Receive", "Dig", "Pancake"],
      "Serving": ["Float Serve", "Jump Serve", "Topspin Serve", "Placement"],
    },
  },
};

const FITNESS_TEST_QUESTIONS = [
  { id: "training_frequency", question: "How many days per week do you currently train?", options: ["1-2 days", "3-4 days", "5-6 days", "Every day"], scores: [10, 20, 25, 20] },
  { id: "sport_experience", question: "How long have you played this sport?", options: ["Less than 1 year", "1-3 years", "3-5 years", "5+ years"], scores: [5, 10, 15, 20] },
  { id: "injury_history", question: "Any current injuries or limitations?", options: ["None", "Minor (doesn't affect training)", "Moderate (some limitations)", "Recovering from major injury"], scores: [15, 10, 5, 0] },
  { id: "endurance", question: "How long can you sustain intense activity?", options: ["Under 15 minutes", "15-30 minutes", "30-60 minutes", "Over 60 minutes"], scores: [5, 10, 15, 20] },
  { id: "goal_commitment", question: "How committed are you to improving?", options: ["Casual interest", "Moderate - want to improve", "Serious - dedicated training", "Competitive - aiming for excellence"], scores: [5, 10, 15, 20] },
];

function SportIcon({ sport, className = "w-6 h-6" }: { sport: string; className?: string }) {
  const Icon = SPORT_ICONS[sport] || Trophy;
  return <Icon className={className} />;
}

export default function SportsModePage() {
  const { toast } = useToast();
  const [step, setStep] = useState<"loading" | "select-sport" | "select-role" | "fitness-test" | "select-skill" | "generating" | "dashboard" | "view-program">("loading");
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [testAnswers, setTestAnswers] = useState<Record<string, number>>({});
  const [currentTestQ, setCurrentTestQ] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [viewingProgram, setViewingProgram] = useState<SportProgram | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<SportProfile | null>({
    queryKey: ["/api/sport/profile"],
  });

  const { data: programs, isLoading: programsLoading } = useQuery<SportProgram[]>({
    queryKey: ["/api/sport/programs"],
  });

  const createProfile = useMutation({
    mutationFn: async (data: { sport: string; role: string; fitnessScore?: number; testAnswers?: any }) => {
      const res = await apiRequest("POST", "/api/sport/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/profile"] });
    },
  });

  const generateProgram = useMutation({
    mutationFn: async (data: {
      sportProfileId: number;
      sport: string;
      role: string;
      skillCategory: string;
      skillName: string;
      fitnessScore?: number;
    }) => {
      const res = await apiRequest("POST", "/api/sport/generate-program", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      setStep("dashboard");
      toast({ title: "Program Created!", description: "Your AI-powered training program is ready." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate program. Please try again.", variant: "destructive" });
      setStep("select-skill");
    },
  });

  const deleteProgram = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/sport/programs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      setViewingProgram(null);
      setStep("dashboard");
      toast({ title: "Program removed" });
    },
  });

  if (profileLoading || programsLoading) {
    if (step === "loading") {
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4" data-testid="sports-mode-loading">
          <div className="space-y-4 max-w-lg mx-auto pt-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      );
    }
  }

  const currentStep = (() => {
    if (step !== "loading") return step;
    if (profile && programs && programs.length > 0) return "dashboard";
    if (profile) return "select-skill";
    return "select-sport";
  })();

  if (currentStep === "select-sport") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-select-sport">
        <div className="max-w-lg mx-auto pt-2">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 mb-3">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sports Mode</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">AI-powered sport-specific training programs</p>
          </div>

          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-3">Choose Your Sport</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(SPORTS_DATA).map(([sport]) => (
              <button
                key={sport}
                onClick={() => {
                  setSelectedSport(sport);
                  setStep("select-role");
                }}
                className="flex flex-col items-center p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all active:scale-95"
                data-testid={`sport-${sport.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-2">
                  <SportIcon sport={sport} className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 text-center">{sport}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "select-role") {
    const sportData = SPORTS_DATA[selectedSport];
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-select-role">
        <div className="max-w-lg mx-auto pt-2">
          <button
            onClick={() => setStep("select-sport")}
            className="flex items-center text-zinc-500 dark:text-zinc-400 mb-4 hover:text-zinc-700 dark:hover:text-zinc-300"
            data-testid="back-to-sports"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </button>

          <div className="text-center mb-6">
            <SportIcon sport={selectedSport} className="w-8 h-8 text-orange-500" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">{selectedSport}</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">What position do you play?</p>
          </div>

          <div className="space-y-3">
            {sportData?.roles.map((role) => (
              <button
                key={role}
                onClick={() => {
                  setSelectedRole(role);
                  setCurrentTestQ(0);
                  setTestAnswers({});
                  setStep("fitness-test");
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all"
                data-testid={`role-${role.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{role}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "fitness-test") {
    const question = FITNESS_TEST_QUESTIONS[currentTestQ];
    const totalScore = Object.values(testAnswers).reduce((sum, s) => sum + s, 0);
    const progress = ((currentTestQ) / FITNESS_TEST_QUESTIONS.length) * 100;

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-fitness-test">
        <div className="max-w-lg mx-auto pt-2">
          <button
            onClick={() => {
              if (currentTestQ > 0) setCurrentTestQ(currentTestQ - 1);
              else setStep("select-role");
            }}
            className="flex items-center text-zinc-500 dark:text-zinc-400 mb-4 hover:text-zinc-700 dark:hover:text-zinc-300"
            data-testid="back-from-test"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </button>

          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 mb-2">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Fitness Assessment</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Question {currentTestQ + 1} of {FITNESS_TEST_QUESTIONS.length}</p>
          </div>

          <Progress value={progress} className="mb-6 h-2" />

          <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 mb-4">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{question.question}</h2>
              <div className="space-y-3">
                {question.options.map((option, idx) => (
                  <button
                    key={option}
                    onClick={() => {
                      const newAnswers = { ...testAnswers, [question.id]: question.scores[idx] };
                      setTestAnswers(newAnswers);
                      if (currentTestQ < FITNESS_TEST_QUESTIONS.length - 1) {
                        setCurrentTestQ(currentTestQ + 1);
                      } else {
                        const finalScore = Object.values(newAnswers).reduce((sum, s) => sum + s, 0);
                        createProfile.mutate({
                          sport: selectedSport,
                          role: selectedRole,
                          fitnessScore: finalScore,
                          testAnswers: newAnswers,
                        });
                        setStep("select-skill");
                      }
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all active:scale-[0.98] ${
                      testAnswers[question.id] === question.scores[idx]
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:border-orange-300 dark:hover:border-orange-600"
                    }`}
                    data-testid={`test-option-${idx}`}
                  >
                    <span className="text-zinc-800 dark:text-zinc-200">{option}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              createProfile.mutate({
                sport: selectedSport,
                role: selectedRole,
              });
              setStep("select-skill");
            }}
            data-testid="skip-test"
          >
            Skip Assessment
          </Button>
        </div>
      </div>
    );
  }

  if (currentStep === "select-skill") {
    const sportData = SPORTS_DATA[selectedSport || profile?.sport || ""];
    const activeSport = selectedSport || profile?.sport || "";
    const activeRole = selectedRole || profile?.role || "";

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-select-skill">
        <div className="max-w-lg mx-auto pt-2">
          {(programs && programs.length > 0) && (
            <button
              onClick={() => setStep("dashboard")}
              className="flex items-center text-zinc-500 dark:text-zinc-400 mb-4 hover:text-zinc-700 dark:hover:text-zinc-300"
              data-testid="back-to-dashboard"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Dashboard
            </button>
          )}

          <div className="text-center mb-6">
            <SportIcon sport={activeSport} className="w-8 h-8 text-orange-500 mx-auto" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">Choose a Skill to Train</h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">{activeSport}</Badge>
              <Badge variant="secondary">{activeRole}</Badge>
              {profile?.fitnessScore && (
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  Score: {profile.fitnessScore}/100
                </Badge>
              )}
            </div>
          </div>

          {!selectedCategory ? (
            <div className="space-y-3">
              {Object.keys(sportData?.skills || {}).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all"
                  data-testid={`category-${category.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{category}</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{sportData?.skills[category]?.length} skills</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setSelectedCategory("")}
                className="flex items-center text-zinc-500 dark:text-zinc-400 mb-4 hover:text-zinc-700 dark:hover:text-zinc-300"
                data-testid="back-to-categories"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> {selectedCategory}
              </button>
              <div className="space-y-3">
                {sportData?.skills[selectedCategory]?.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => {
                      if (!profile) return;
                      setSelectedSkill(skill);
                      setStep("generating");
                      generateProgram.mutate({
                        sportProfileId: profile.id,
                        sport: activeSport,
                        role: activeRole,
                        skillCategory: selectedCategory,
                        skillName: skill,
                        fitnessScore: profile.fitnessScore ?? undefined,
                      });
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all"
                    data-testid={`skill-${skill.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-orange-500" />
                      </div>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">{skill}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-zinc-400" />
                      <span className="text-xs text-zinc-400">AI</span>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentStep === "generating") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-4" data-testid="sports-generating">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-500 mb-4 animate-pulse">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Creating Your Program</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            AI is analyzing your profile and generating a personalized {selectedSkill} training plan...
          </p>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500" />
        </div>
      </div>
    );
  }

  if (currentStep === "view-program" && viewingProgram) {
    const analysis = viewingProgram.aiAnalysis as any;
    const plan = viewingProgram.programPlan as any;

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-view-program">
        <div className="max-w-lg mx-auto pt-2">
          <button
            onClick={() => {
              setViewingProgram(null);
              setStep("dashboard");
            }}
            className="flex items-center text-zinc-500 dark:text-zinc-400 mb-4 hover:text-zinc-700 dark:hover:text-zinc-300"
            data-testid="back-to-dashboard-from-program"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </button>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <SportIcon sport={viewingProgram.sport} className="w-6 h-6 text-orange-500" />
              <div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{plan?.title || viewingProgram.skillName}</h1>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{viewingProgram.sport}</Badge>
                  <Badge variant="secondary" className="text-xs">{viewingProgram.role}</Badge>
                </div>
              </div>
            </div>
            {plan?.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{plan.description}</p>
            )}
          </div>

          {analysis && (
            <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-orange-500" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={
                      analysis.currentLevel === "beginner" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                      analysis.currentLevel === "intermediate" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                    }>
                      {analysis.currentLevel}
                    </Badge>
                  </div>
                  {analysis.recommendation && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{analysis.recommendation}</p>
                  )}
                  {analysis.keyStrengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Strengths</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.keyStrengths.map((s: string) => (
                          <Badge key={s} variant="outline" className="text-xs bg-green-50 dark:bg-green-900/10">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.areasToImprove?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Areas to Improve</p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.areasToImprove.map((a: string) => (
                          <Badge key={a} variant="outline" className="text-xs bg-orange-50 dark:bg-orange-900/10">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {plan?.phases?.map((phase: any, phaseIdx: number) => (
            <Card key={phaseIdx} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Week {phase.week}: {phase.focus}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {phase.sessions?.map((session: any, sessionIdx: number) => (
                    <div key={sessionIdx} className="border border-zinc-100 dark:border-zinc-700 rounded-lg p-3">
                      <h4 className="font-medium text-sm text-zinc-800 dark:text-zinc-200 mb-2">
                        Day {session.day}: {session.title}
                      </h4>

                      {session.warmup?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">Warmup</p>
                          <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                            {session.warmup.map((w: string, i: number) => (
                              <li key={i}>• {w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {session.drills?.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Drills</p>
                          <div className="space-y-2">
                            {session.drills.map((drill: any, i: number) => (
                              <div key={i} className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{drill.name}</span>
                                  <span className="text-xs text-zinc-500">
                                    {drill.sets}×{drill.reps} | Rest: {drill.rest}
                                  </span>
                                </div>
                                {drill.notes && (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{drill.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {session.cooldown?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Cooldown</p>
                          <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                            {session.cooldown.map((c: string, i: number) => (
                              <li key={i}>• {c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => deleteProgram.mutate(viewingProgram.id)}
            disabled={deleteProgram.isPending}
            data-testid="delete-program"
          >
            {deleteProgram.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Remove Program
          </Button>
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-dashboard">
      <div className="max-w-lg mx-auto pt-2">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-orange-500" /> Sports Mode
            </h1>
            {profile && (
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                  <SportIcon sport={profile.sport} className="w-3 h-3" /> {profile.sport}
                </Badge>
                <Badge variant="secondary">{profile.role}</Badge>
                {profile.fitnessScore && (
                  <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {profile.fitnessScore}/100
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={() => {
            setSelectedCategory("");
            setStep("select-skill");
          }}
          className="w-full mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
          data-testid="add-new-program"
        >
          <Zap className="w-4 h-4 mr-2" /> New Training Program
        </Button>

        {(!programs || programs.length === 0) ? (
          <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
            <CardContent className="pt-6 text-center">
              <Medal className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">No Programs Yet</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Create your first AI-powered sport training program to get started!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Active Programs</h2>
            {programs.map((program) => (
              <button
                key={program.id}
                onClick={() => {
                  setViewingProgram(program);
                  setStep("view-program");
                }}
                className="w-full text-left p-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all"
                data-testid={`program-card-${program.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                    <SportIcon sport={program.sport} className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                      {(program.programPlan as any)?.title || program.skillName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{program.skillCategory}</Badge>
                      <span className="text-xs text-zinc-400">{program.durationWeeks} weeks</span>
                    </div>
                    {(program.aiAnalysis as any)?.currentLevel && (
                      <Badge className={`mt-1 text-xs ${
                        (program.aiAnalysis as any).currentLevel === "beginner" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                        (program.aiAnalysis as any).currentLevel === "intermediate" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                      }`}>
                        {(program.aiAnalysis as any).currentLevel}
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Button
            variant="outline"
            className="w-full border-zinc-300 dark:border-zinc-600"
            onClick={() => {
              setSelectedSport("");
              setSelectedRole("");
              setStep("select-sport");
            }}
            data-testid="change-sport"
          >
            Change Sport / Role
          </Button>
        </div>
      </div>
    </div>
  );
}
