import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Dumbbell, TrendingUp, Calendar, Users, ClipboardList, CreditCard, 
  Building2, BarChart3, Target, ChevronDown, ChevronUp, Brain, 
  QrCode, Bell, UserPlus, Settings, HelpCircle, Sparkles, 
  CheckCircle2, Camera, Scale, Activity, Flame, Star, MessageCircle
} from "lucide-react";

interface FeatureSection {
  id: string;
  title: string;
  icon: typeof Dumbbell;
  color: string;
  description: string;
  features: {
    title: string;
    description: string;
    howTo?: string;
  }[];
}

const memberFeatures: FeatureSection[] = [
  {
    id: "workouts",
    title: "Workout Tracking",
    icon: Dumbbell,
    color: "text-primary",
    description: "Log and track your daily workouts with ease.",
    features: [
      {
        title: "Today's Workout",
        description: "View your scheduled exercises for today based on your trainer's plan.",
        howTo: "Go to Home or My Workout page. Tap each exercise to expand and log your sets, reps, and weights."
      },
      {
        title: "Complete Exercises",
        description: "Mark exercises as done with your actual performance data.",
        howTo: "Tap the circle next to an exercise for quick complete, or expand it to enter custom sets/reps/weight."
      },
      {
        title: "Workout History",
        description: "See all your past workouts and track your consistency.",
        howTo: "Go to Progress page to see your workout calendar and history."
      }
    ]
  },
  {
    id: "progress",
    title: "Progress Tracking",
    icon: TrendingUp,
    color: "text-emerald-500",
    description: "Monitor your fitness journey with visual stats.",
    features: [
      {
        title: "Workout Streaks",
        description: "See how many consecutive days you've worked out.",
        howTo: "Your streak is shown on the Home page and Progress page."
      },
      {
        title: "Body Measurements",
        description: "Track your weight, measurements, and body composition over time.",
        howTo: "Go to My Body page to log measurements and see your transformation."
      },
      {
        title: "Weekly Calendar",
        description: "Visual overview of your workout week with completion status.",
        howTo: "Check the Home page for your weekly progress bar."
      }
    ]
  },
  {
    id: "dika",
    title: "Dika AI Assistant",
    icon: Brain,
    color: "text-purple-500",
    description: "Your personal AI buddy for fitness questions.",
    features: [
      {
        title: "Ask Anything",
        description: "Get answers about your workouts, attendance, payments, and progress.",
        howTo: "Tap the floating Dika button (bottom-right) to open the chat."
      },
      {
        title: "Quick Questions",
        description: "Use suggestion chips for common questions like 'What's my streak?' or 'When is my payment due?'",
        howTo: "Tap a suggestion chip or type your own question."
      },
      {
        title: "Personalized Answers",
        description: "Dika knows your data and gives you personalized responses.",
        howTo: "Ask questions like 'How many workouts did I do this week?'"
      }
    ]
  },
  {
    id: "attendance",
    title: "Attendance",
    icon: QrCode,
    color: "text-blue-500",
    description: "Check-in to your gym easily.",
    features: [
      {
        title: "QR Check-in",
        description: "Scan the gym's QR code to mark your attendance.",
        howTo: "Ask your gym for the QR code and scan it when you arrive."
      },
      {
        title: "Auto Attendance",
        description: "Attendance is automatically marked when you complete a workout.",
        howTo: "Just complete your workout - attendance is tracked automatically!"
      },
      {
        title: "Attendance History",
        description: "View your gym visit history and patterns.",
        howTo: "Check your Home page calendar for attendance history."
      }
    ]
  }
];

const personalModeFeatures: FeatureSection[] = [
  {
    id: "create-workout",
    title: "Create Your Workout",
    icon: Sparkles,
    color: "text-primary",
    description: "Build custom workout cycles your way.",
    features: [
      {
        title: "Smart Wizard",
        description: "Answer a few questions and we'll create a personalized workout plan for you.",
        howTo: "Go to My Workout page and tap 'Help me build a cycle'. Answer questions about your goals and experience."
      },
      {
        title: "Import from AI",
        description: "Paste a workout routine from ChatGPT, Claude, or any AI and we'll organize it for you.",
        howTo: "Tap 'Import from AI/Chat', copy your AI-generated workout, paste it, and we'll parse it automatically."
      },
      {
        title: "Create from Scratch",
        description: "Build a completely custom workout cycle with your own exercises.",
        howTo: "Tap 'Create from scratch' and add your exercises day by day."
      }
    ]
  },
  {
    id: "tracking",
    title: "Track Everything",
    icon: TrendingUp,
    color: "text-emerald-500",
    description: "Log workouts and see your progress.",
    features: [
      {
        title: "Log Workouts",
        description: "Mark exercises as complete and track your sets, reps, and weights.",
        howTo: "Tap each exercise to expand and enter your actual performance."
      },
      {
        title: "Body Measurements",
        description: "Track weight, body measurements, and see your transformation over time.",
        howTo: "Go to My Body page to log and view your measurements."
      },
      {
        title: "Streaks & Stats",
        description: "Build workout streaks and see your weekly/monthly statistics.",
        howTo: "Check your Home page for stats and Progress page for detailed history."
      }
    ]
  },
  {
    id: "dika",
    title: "Dika AI Assistant",
    icon: Brain,
    color: "text-purple-500",
    description: "Your personal AI fitness buddy.",
    features: [
      {
        title: "Ask Questions",
        description: "Get answers about your workouts, progress, and fitness data.",
        howTo: "Tap the floating Dika button to open the chat and ask anything!"
      },
      {
        title: "Workout Insights",
        description: "Ask about your streak, workout count, muscle groups, and more.",
        howTo: "Try questions like 'How many workouts this month?' or 'What's my best streak?'"
      }
    ]
  }
];

const trainerFeatures: FeatureSection[] = [
  {
    id: "members",
    title: "Member Management",
    icon: Users,
    color: "text-primary",
    description: "Manage all your assigned members.",
    features: [
      {
        title: "View Members",
        description: "See all members assigned to you with their progress and status.",
        howTo: "Go to Members page to see your full member list."
      },
      {
        title: "Track Attendance",
        description: "Monitor which members are showing up and who needs motivation.",
        howTo: "Check member profiles or the Attendance page for patterns."
      },
      {
        title: "New Member Alerts",
        description: "Get notified when new members are assigned to you.",
        howTo: "Check your Home page for new members needing workout plans."
      }
    ]
  },
  {
    id: "workouts",
    title: "Workout Programs",
    icon: ClipboardList,
    color: "text-emerald-500",
    description: "Create and assign workout cycles.",
    features: [
      {
        title: "Create Cycles",
        description: "Build custom workout programs with exercises, sets, reps, and rest days.",
        howTo: "Go to Workouts page, create a new cycle, add days and exercises."
      },
      {
        title: "Assign to Members",
        description: "Assign workout cycles to your members based on their goals.",
        howTo: "Select a member and assign them an existing cycle."
      },
      {
        title: "Track Progress",
        description: "See how members are progressing through their programs.",
        howTo: "View member profiles to see workout completion rates."
      }
    ]
  },
  {
    id: "star-members",
    title: "Star Members",
    icon: Star,
    color: "text-amber-500",
    description: "Recognize and reward top performers.",
    features: [
      {
        title: "Mark as Star",
        description: "Identify your most dedicated and high-performing members.",
        howTo: "Go to member profile and toggle the Star Member status."
      },
      {
        title: "Diet Plans",
        description: "Create personalized diet plans for your star members.",
        howTo: "Open a star member's profile and add their custom diet plan."
      }
    ]
  }
];

const ownerFeatures: FeatureSection[] = [
  {
    id: "gym-management",
    title: "Gym Management",
    icon: Building2,
    color: "text-primary",
    description: "Control every aspect of your gym.",
    features: [
      {
        title: "Invite Trainers",
        description: "Add trainers to your gym using unique invite codes.",
        howTo: "Go to Trainers page and generate an invite code to share."
      },
      {
        title: "Register Members",
        description: "Add new members to your gym quickly and easily.",
        howTo: "Go to Members page and use 'Add Member' to register new members."
      },
      {
        title: "Assign Trainers",
        description: "Assign members to trainers for personalized coaching.",
        howTo: "In member profile, select their assigned trainer."
      }
    ]
  },
  {
    id: "payments",
    title: "Payments & Subscriptions",
    icon: CreditCard,
    color: "text-emerald-500",
    description: "Handle all billing and subscriptions.",
    features: [
      {
        title: "Subscription Plans",
        description: "Create monthly, quarterly, or yearly plans with custom pricing.",
        howTo: "Go to Plans page to create and manage subscription plans."
      },
      {
        title: "Record Payments",
        description: "Log payments when members pay their dues.",
        howTo: "Go to Payments page and record new payments."
      },
      {
        title: "Payment Reminders",
        description: "See which members have pending or overdue payments.",
        howTo: "Check the Payments page for payment status filters."
      }
    ]
  },
  {
    id: "analytics",
    title: "Analytics & Insights",
    icon: BarChart3,
    color: "text-purple-500",
    description: "Data-driven insights for your gym.",
    features: [
      {
        title: "Attendance Trends",
        description: "See daily, weekly, and monthly attendance patterns.",
        howTo: "Check your Home page and Attendance page for visual charts."
      },
      {
        title: "Revenue Tracking",
        description: "Monitor your gym's income and payment trends.",
        howTo: "Home page shows revenue summary, Payments page has details."
      },
      {
        title: "AI Insights",
        description: "Get alerts about at-risk members who might churn.",
        howTo: "Check the AI Insights section on your Home page."
      }
    ]
  },
  {
    id: "walkin",
    title: "Walk-in Visitors",
    icon: UserPlus,
    color: "text-blue-500",
    description: "Track day passes and trial visitors.",
    features: [
      {
        title: "Log Visitors",
        description: "Record walk-in visitors for day passes, trials, or inquiries.",
        howTo: "Go to Walk-ins page to log new visitors."
      },
      {
        title: "Self Check-in Kiosk",
        description: "Let visitors check themselves in using a tablet at your front desk.",
        howTo: "Use Kiosk Mode for a self-service check-in experience."
      },
      {
        title: "Convert to Members",
        description: "Convert trial visitors to full members when they sign up.",
        howTo: "Open visitor profile and use 'Convert to Member' option."
      }
    ]
  }
];

function FeatureCard({ section, isOpen, onToggle }: { section: FeatureSection; isOpen: boolean; onToggle: () => void }) {
  const Icon = section.icon;
  
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${section.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <CardDescription className="text-sm">{section.description}</CardDescription>
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {section.features.map((feature, index) => (
              <div key={index} className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                  <h4 className="font-medium">{feature.title}</h4>
                </div>
                <p className="text-sm text-muted-foreground pl-6">{feature.description}</p>
                {feature.howTo && (
                  <div className="pl-6 pt-2">
                    <Badge variant="secondary" className="text-xs font-normal">
                      How to: {feature.howTo}
                    </Badge>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function HelpPage() {
  const { user } = useAuth();
  const [openSections, setOpenSections] = useState<string[]>([]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setOpenSections(features.map(f => f.id));
  };

  const collapseAll = () => {
    setOpenSections([]);
  };

  const isPersonalMode = user?.role === 'member' && !user?.gymId;
  
  let features: FeatureSection[];
  let roleTitle: string;
  let roleDescription: string;

  if (user?.role === 'owner') {
    features = ownerFeatures;
    roleTitle = "Gym Owner Guide";
    roleDescription = "Everything you need to manage your gym effectively.";
  } else if (user?.role === 'trainer') {
    features = trainerFeatures;
    roleTitle = "Trainer Guide";
    roleDescription = "Tools to help you train members and track their progress.";
  } else if (isPersonalMode) {
    features = personalModeFeatures;
    roleTitle = "Personal Mode Guide";
    roleDescription = "Your complete guide to tracking workouts independently.";
  } else {
    features = memberFeatures;
    roleTitle = "Member Guide";
    roleDescription = "Get the most out of your gym membership.";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">{roleTitle}</h2>
          </div>
          <p className="text-muted-foreground">{roleDescription}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} data-testid="button-expand-all">
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
            Collapse All
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {features.map(section => (
          <FeatureCard 
            key={section.id}
            section={section}
            isOpen={openSections.includes(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/20 text-primary">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Still have questions?</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Ask Dika, your AI assistant! Tap the floating button on any page to get instant answers about your workouts, progress, and more.
              </p>
              <Badge variant="secondary">Tip: Try asking "What can you help me with?"</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
