import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useLocation } from "wouter";
import {
  Trophy, Dumbbell, Target, Zap, ChevronRight, ChevronLeft, Loader2,
  ArrowLeft, ArrowRight, Activity, Medal, Brain, Waves, Swords, Crosshair,
  Check, X, AlertTriangle,
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

type Step = "loading" | "select-sport" | "select-role" | "fitness-test" | "select-skill" | "previewing" | "preview-results" | "no-cycle" | "applying" | "dashboard";

export default function SportsModePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("loading");
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [testAnswers, setTestAnswers] = useState<Record<string, number>>({});
  const [currentTestQ, setCurrentTestQ] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedPriority, setSelectedPriority] = useState<number | null>(null);

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

  const previewMods = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sport/preview-modifications", data);
      return res.json();
    },
    onSuccess: (result) => {
      setPreviewData(result);
      if (result.noCycle) {
        setStep("no-cycle");
      } else {
        setStep("preview-results");
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate preview. Please try again.", variant: "destructive" });
      setStep("select-skill");
    },
  });

  const applyMods = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sport/apply-modifications", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/calendar/enhanced"] });
      toast({ title: "Workout Updated!", description: "Your cycle has been modified with sport-targeted exercises." });
      setStep("dashboard");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to apply changes. Please try again.", variant: "destructive" });
    },
  });

  const createFullCycle = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sport/create-full-cycle", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/calendar/enhanced"] });
      toast({ title: "Workout Cycle Created!", description: "Your sport-focused workout cycle is ready." });
      setStep("dashboard");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create cycle. Please try again.", variant: "destructive" });
    },
  });

  const deleteProgram = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/sport/programs/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sport/programs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts/today"] });
      toast({ title: "Sport modification removed" });
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

  const handleSkillSelect = (skill: string) => {
    if (!profile) return;
    setSelectedSkill(skill);
    setStep("previewing");
    const activeSport = selectedSport || profile.sport;
    const activeRole = selectedRole || profile.role;
    previewMods.mutate({
      sportProfileId: profile.id,
      sport: activeSport,
      role: activeRole,
      skillCategory: selectedCategory,
      skillName: skill,
      fitnessScore: profile.fitnessScore ?? undefined,
    });
  };

  const handleApply = () => {
    if (!profile || !previewData || selectedPriority === null) return;
    const preview = previewData.previews?.find((p: any) => p.priority === selectedPriority);
    if (!preview) return;

    setStep("applying");
    const activeSport = selectedSport || profile.sport;
    const activeRole = selectedRole || profile.role;
    applyMods.mutate({
      sportProfileId: profile.id,
      sport: activeSport,
      role: activeRole,
      skillCategory: selectedCategory,
      skillName: selectedSkill,
      priority: selectedPriority,
      changes: preview.changes,
      analysis: previewData.analysis,
    });
  };

  const handleCreateFullCycle = () => {
    if (!profile) return;
    setStep("applying");
    const activeSport = selectedSport || profile.sport;
    const activeRole = selectedRole || profile.role;
    createFullCycle.mutate({
      sportProfileId: profile.id,
      sport: activeSport,
      role: activeRole,
      skillCategory: selectedCategory,
      skillName: selectedSkill,
      fitnessScore: profile.fitnessScore ?? undefined,
    });
  };

  if (currentStep === "select-sport") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-select-sport">
        <div className="max-w-lg mx-auto pt-2">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 mb-3">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sports Mode</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-1">Modify your workouts to improve your sport skills</p>
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
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">Choose a Skill to Improve</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Your workout cycle will be modified to target this skill</p>
            <div className="flex items-center justify-center gap-2 mt-2">
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
                    onClick={() => handleSkillSelect(skill)}
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

  if (currentStep === "previewing" || currentStep === "applying") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-4" data-testid="sports-previewing">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-500 mb-4 animate-pulse">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            {currentStep === "previewing" ? "Analyzing Your Cycle" : "Applying Changes"}
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 mb-4">
            {currentStep === "previewing"
              ? `AI is checking your current workouts and planning ${selectedSkill} modifications...`
              : "Updating your workout cycle with sport-targeted exercises..."}
          </p>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500" />
        </div>
      </div>
    );
  }

  if (currentStep === "no-cycle") {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-no-cycle">
        <div className="max-w-lg mx-auto pt-2">
          <button
            onClick={() => { setStep("select-skill"); setSelectedCategory(""); }}
            className="flex items-center text-zinc-500 dark:text-zinc-400 mb-4 hover:text-zinc-700 dark:hover:text-zinc-300"
            data-testid="back-to-skills"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-3">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">No Workout Cycle Found</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2">
              You don't have a workout cycle assigned yet. To modify your workouts for <span className="font-semibold text-orange-500">{selectedSkill}</span>, you need an active cycle.
            </p>
          </div>

          <div className="space-y-4">
            <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">Create a workout cycle first</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      Set up your regular workout cycle, then come back here to add sport-specific modifications.
                    </p>
                    <Button
                      className="mt-3"
                      variant="outline"
                      onClick={() => navigate("/workouts")}
                      data-testid="go-to-workouts"
                    >
                      Go to Workouts <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-zinc-200 dark:border-zinc-700 flex-1" />
              <span className="px-3 text-sm text-zinc-400 bg-zinc-50 dark:bg-zinc-900">or</span>
              <div className="border-t border-zinc-200 dark:border-zinc-700 flex-1" />
            </div>

            <Card className="bg-white dark:bg-zinc-800 border-orange-200 dark:border-orange-800">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">Use this as your full workout</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      AI will create a complete workout cycle entirely focused on improving your <span className="font-medium text-orange-500">{selectedSkill}</span> in {selectedSport || profile?.sport}.
                    </p>
                    <Button
                      className="mt-3 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
                      onClick={handleCreateFullCycle}
                      disabled={createFullCycle.isPending}
                      data-testid="create-full-cycle"
                    >
                      {createFullCycle.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                      Generate Sport Workout Cycle
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (currentStep === "preview-results" && previewData) {
    const previews = previewData.previews || [];
    const cycleInfo = previewData.cycleInfo;
    const currentExercises = previewData.currentExercises || {};
    const analysis = previewData.analysis;

    const priorityLabels: Record<number, { label: string; color: string; bgColor: string; desc: string }> = {
      50: { label: "Light", color: "text-green-700 dark:text-green-300", bgColor: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800", desc: "Keep most of your workouts, add a few sport exercises" },
      80: { label: "Moderate", color: "text-blue-700 dark:text-blue-300", bgColor: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800", desc: "Replace most exercises with sport-targeted ones" },
      100: { label: "Full Focus", color: "text-orange-700 dark:text-orange-300", bgColor: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800", desc: "Fully rebuild your cycle around this sport goal" },
    };

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pb-24" data-testid="sports-preview-results">
        <div className="max-w-lg mx-auto pt-2">
          <button
            onClick={() => { setStep("select-skill"); setSelectedCategory(""); setSelectedPriority(null); }}
            className="flex items-center text-zinc-500 dark:text-zinc-400 mb-4 hover:text-zinc-700 dark:hover:text-zinc-300"
            data-testid="back-to-skills-from-preview"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </button>

          <div className="text-center mb-4">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">How much do you want to change?</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Your cycle <span className="font-medium text-zinc-700 dark:text-zinc-300">"{cycleInfo?.name}"</span> will be modified for <span className="font-medium text-orange-500">{selectedSkill}</span>
            </p>
          </div>

          {analysis?.targetMuscles?.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Target Muscles</p>
              <div className="flex flex-wrap gap-1">
                {analysis.targetMuscles.map((m: string) => (
                  <Badge key={m} variant="outline" className="text-xs bg-white/50 dark:bg-zinc-800/50">{m}</Badge>
                ))}
              </div>
              {analysis.whyTheseMuscles && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{analysis.whyTheseMuscles}</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            {previews.map((preview: any) => {
              const config = priorityLabels[preview.priority] || priorityLabels[50];
              const isSelected = selectedPriority === preview.priority;

              return (
                <button
                  key={preview.priority}
                  onClick={() => setSelectedPriority(preview.priority)}
                  className={`w-full text-left rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-orange-500 ring-2 ring-orange-200 dark:ring-orange-800"
                      : `${config.bgColor} hover:border-orange-300 dark:hover:border-orange-700`
                  }`}
                  data-testid={`priority-${preview.priority}`}
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${config.color}`}>{preview.priority}%</span>
                        <Badge className={`${config.color} bg-transparent border`}>{config.label}</Badge>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{preview.summary || config.desc}</p>

                    <div className="space-y-2">
                      {preview.changes?.map((change: any, idx: number) => {
                        const dayLabel = cycleInfo?.dayLabels?.[change.dayIndex] || `Day ${change.dayIndex + 1}`;
                        return (
                          <div key={idx} className="bg-white dark:bg-zinc-800 rounded-lg p-3 border border-zinc-100 dark:border-zinc-700">
                            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{dayLabel}</p>
                            {change.removals?.length > 0 && (
                              <div className="space-y-1 mb-2">
                                {change.removals.map((r: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <X className="w-3 h-3 text-red-500 flex-shrink-0" />
                                    <span className="text-zinc-500 dark:text-zinc-400 line-through">{r.exerciseName}</span>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">{r.muscleType}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                            {change.additions?.length > 0 && (
                              <div className="space-y-1">
                                {change.additions.map((a: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                                    <span className="text-zinc-800 dark:text-zinc-200 font-medium">{a.exerciseName}</span>
                                    <span className="text-zinc-400">{a.sets}x{a.reps}</span>
                                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 dark:bg-blue-900/20">{a.muscleType}</Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedPriority !== null && (
            <div className="mt-6 sticky bottom-20 bg-zinc-50 dark:bg-zinc-900 pt-2 pb-2">
              <Button
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 h-12 text-base"
                onClick={handleApply}
                disabled={applyMods.isPending}
                data-testid="apply-changes"
              >
                {applyMods.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                Apply {selectedPriority}% Changes to My Cycle
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

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
            setSelectedPriority(null);
            setStep("select-skill");
          }}
          className="w-full mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600"
          data-testid="add-sport-modification"
        >
          <Zap className="w-4 h-4 mr-2" /> Modify Workouts for a Skill
        </Button>

        {(!programs || programs.length === 0) ? (
          <Card className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
            <CardContent className="pt-6 text-center">
              <Medal className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">No Sport Modifications Yet</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Pick a sport skill above to modify your workout cycle with exercises that help you improve.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Active Modifications</h2>
            {programs.filter(p => p.isActive).map((program) => (
              <Card key={program.id} className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700" data-testid={`mod-card-${program.id}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0">
                      <SportIcon sport={program.sport} className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{program.skillName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{program.skillCategory}</Badge>
                        <Badge variant="outline" className="text-xs">{program.priority}% priority</Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => deleteProgram.mutate(program.id)}
                      disabled={deleteProgram.isPending}
                      data-testid={`remove-mod-${program.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
