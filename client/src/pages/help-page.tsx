import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { isNative, isIOS } from "@/lib/capacitor-init";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Dumbbell, TrendingUp, Calendar, Users, ClipboardList, CreditCard, 
  Building2, BarChart3, Target, ChevronDown, ChevronUp, Brain, 
  QrCode, UserPlus, HelpCircle, Sparkles, Scale, Activity, 
  Flame, Star, MessageCircle, BookOpen, ArrowRight, Zap,
  CheckCircle2, RotateCcw, Clock, Award, History, Ruler,
  HeartPulse, Trophy, Megaphone, FileText, Utensils, PersonStanding
} from "lucide-react";

interface FeatureItem {
  title: string;
  description: string;
  steps?: string[];
  tip?: string;
}

interface FeatureSection {
  id: string;
  title: string;
  icon: typeof Dumbbell;
  color: string;
  bgColor: string;
  description: string;
  features: FeatureItem[];
}

const personalModeFeatures: FeatureSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Zap,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    description: "Everything you need to begin your fitness journey in Personal Mode.",
    features: [
      {
        title: "What is Personal Mode?",
        description: "Personal Mode lets you track your workouts independently without joining a gym. It's 100% free forever with full access to workout tracking, body measurements, and your AI assistant Dika.",
        tip: "You can always join a gym later while keeping your workout history!"
      },
      {
        title: "Your Dashboard",
        description: "Your home screen shows today's workout, your current streak, weekly stats, and quick access to all features.",
        steps: [
          "See your current workout day at a glance",
          "Track your day streak and monthly progress",
          "Access your workout cycle with one tap"
        ]
      }
    ]
  },
  {
    id: "create-workout",
    title: "Creating Workouts",
    icon: Sparkles,
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "Three easy ways to build your perfect workout routine.",
    features: [
      {
        title: "Smart Wizard (Recommended)",
        description: "Answer a few simple questions about your goals, experience, and available days. We'll generate a complete workout cycle tailored just for you.",
        steps: [
          "Go to 'My Workouts' from the bottom menu",
          "Tap 'Help me build a cycle'",
          "Answer questions about your fitness goals",
          "Choose how many days per week you can workout",
          "Get your personalized plan instantly!"
        ],
        tip: "The wizard creates science-backed routines for muscle building, fat loss, or general fitness."
      },
      {
        title: "Import from AI Assistant",
        description: "Already have a workout plan from ChatGPT, Claude, or another AI? Paste it directly and we'll organize it for you automatically.",
        steps: [
          "Go to 'My Workouts' page",
          "Tap 'Import from AI/Chat'",
          "Copy your AI-generated workout plan",
          "Paste it in the text box",
          "Review and edit if needed, then save"
        ],
        tip: "Works with most AI-generated formats. You can also upload a screenshot!"
      },
      {
        title: "Create from Scratch",
        description: "Full control to build exactly what you want. Add exercises, set rest days, and customize everything.",
        steps: [
          "Go to 'My Workouts' page",
          "Tap 'Create from scratch'",
          "Name your workout cycle",
          "Add days and exercises manually",
          "Set sets, reps, and rest times for each exercise"
        ]
      }
    ]
  },
  {
    id: "tracking",
    title: "Logging Workouts",
    icon: Dumbbell,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "How to track your daily workouts and mark exercises complete.",
    features: [
      {
        title: "Completing Exercises",
        description: "Each day shows your scheduled exercises. Mark them complete as you finish each one.",
        steps: [
          "Open your workout from Dashboard or 'My Workouts'",
          "Tap on any exercise to expand it",
          "Enter your actual sets, reps, and weight",
          "Tap the checkmark to mark it complete"
        ],
        tip: "Quick tip: Tap the circle icon for instant completion with default values!"
      },
      {
        title: "Rest Days",
        description: "Rest days are automatically included in your cycle. Just tap 'Mark Day as Done' to log it and keep your streak going.",
        steps: [
          "On rest days, you'll see a clear message",
          "Tap 'Mark Day as Done' to log the rest day",
          "Your streak continues without missing a beat!"
        ]
      },
      {
        title: "Workout Phases",
        description: "Your cycle repeats in phases. Each time you complete all days, a new phase begins with fresh tracking.",
        tip: "Compare your progress across phases to see improvement over time!"
      }
    ]
  },
  {
    id: "progress",
    title: "Progress & Stats",
    icon: TrendingUp,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    description: "Track your fitness journey with detailed statistics and visual progress.",
    features: [
      {
        title: "Workout Streaks",
        description: "Your streak shows consecutive days you've completed workouts (including rest days). Build consistency!",
        steps: [
          "View your current streak on the Dashboard",
          "Go to 'Progress' for detailed streak history",
          "See your longest streak ever achieved"
        ],
        tip: "Missing a day resets your streak to 0. Stay consistent!"
      },
      {
        title: "Weekly & Monthly Stats",
        description: "Visual charts show your workout frequency, completion rates, and trends over time.",
        steps: [
          "Go to 'Progress' from the bottom menu",
          "See workouts completed this week vs target",
          "View monthly calendar with workout days marked",
          "Track your total workouts and muscle groups hit"
        ]
      },
      {
        title: "Workout History",
        description: "Every workout you complete is saved. Review past sessions to see your weights, reps, and performance.",
        steps: [
          "Go to 'Progress' page",
          "Tap 'View History' or scroll down",
          "Filter by date range or exercise type",
          "See detailed logs of every session"
        ]
      },
      {
        title: "Muscle Group Distribution",
        description: "See which muscle groups you're training most frequently to ensure balanced development.",
        tip: "The dashboard shows a visual breakdown of your training focus."
      }
    ]
  },
  {
    id: "body",
    title: "Body Measurements",
    icon: HeartPulse,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    description: "Track your physical transformation with detailed body measurements.",
    features: [
      {
        title: "Logging Measurements",
        description: "Record your weight, body fat percentage, and detailed measurements regularly to track changes.",
        steps: [
          "Go to 'My Body' from the menu",
          "Tap 'Add Measurement' or the + button",
          "Enter your current weight",
          "Optionally add body fat %, chest, waist, arms, etc.",
          "Save to see it on your progress chart"
        ],
        tip: "Measure at the same time each day (morning is best) for accuracy."
      },
      {
        title: "Progress Charts",
        description: "Visual graphs show your weight and measurement changes over weeks and months.",
        steps: [
          "Go to 'My Body' page",
          "View the weight trend chart at the top",
          "Scroll down to see individual measurement trends",
          "Compare your starting point to now"
        ]
      },
      {
        title: "Measurement History",
        description: "All your logged measurements are saved with dates so you can review your journey anytime.",
        tip: "Log measurements weekly for best trend visibility!"
      }
    ]
  },
  {
    id: "dika",
    title: "Dika AI Assistant",
    icon: Brain,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Your personal AI buddy who knows everything about your fitness data.",
    features: [
      {
        title: "What Dika Can Do",
        description: "Dika answers questions about your workouts, progress, streaks, and more using your actual data.",
        steps: [
          "Tap the floating Dika icon (bottom-right corner)",
          "Type or speak your question",
          "Get instant, personalized answers"
        ]
      },
      {
        title: "Example Questions",
        description: "Try asking Dika things like:",
        steps: [
          "\"What's my current streak?\"",
          "\"How many workouts did I complete this month?\"",
          "\"What muscle groups did I train this week?\"",
          "\"When did I last do chest exercises?\"",
          "\"What's my weight trend?\""
        ],
        tip: "Dika uses your real data - answers are personalized to you!"
      },
      {
        title: "Quick Suggestions",
        description: "Tap the suggestion chips to ask common questions without typing.",
        tip: "You can hide Dika from your Profile settings if preferred."
      }
    ]
  },
  {
    id: "join-gym",
    title: "Joining a Gym",
    icon: Building2,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    description: "Ready to join a gym? Here's how to connect with one.",
    features: [
      {
        title: "How to Join",
        description: "If your gym uses OGym, you can join them and get trainer-assigned workouts while keeping your history.",
        steps: [
          "Go to 'Join a Gym' from the menu",
          "Enter the gym's unique code (ask them for it)",
          "Submit your join request",
          "Wait for the gym owner to approve you"
        ],
        tip: "Your Personal Mode history stays with you even after joining a gym!"
      }
    ]
  }
];

const memberFeatures: FeatureSection[] = [
  {
    id: "workouts",
    title: "Your Workouts",
    icon: Dumbbell,
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "How to view and complete your trainer-assigned workout program.",
    features: [
      {
        title: "Today's Workout",
        description: "Your dashboard shows today's exercises based on your trainer's plan. Each exercise includes sets, reps, and any notes from your trainer.",
        steps: [
          "Open the app to see your Dashboard",
          "View 'Today's Workout' section",
          "Tap 'My Workout' for the full list"
        ]
      },
      {
        title: "Completing Exercises",
        description: "Mark each exercise as done when you finish it. You can log your actual weights and reps.",
        steps: [
          "Tap on any exercise to expand it",
          "Enter your actual sets, reps, and weight used",
          "Tap the checkmark to mark complete",
          "Or tap the circle for quick completion"
        ],
        tip: "Your trainer can see your progress and adjust your plan accordingly!"
      },
      {
        title: "Training Mode",
        description: "You may be in 'Trainer-Led' or 'Self-Guided' mode. Trainer-Led means your trainer creates your workouts. Self-Guided means you create your own while still being part of the gym.",
        tip: "Ask your gym owner to switch your training mode if needed."
      }
    ]
  },
  {
    id: "progress",
    title: "Progress & Stats",
    icon: TrendingUp,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    description: "Track your fitness journey with detailed statistics.",
    features: [
      {
        title: "Workout Streaks",
        description: "See how many consecutive days you've worked out. Your streak appears on your Dashboard and Progress page.",
        tip: "Complete rest days too to maintain your streak!"
      },
      {
        title: "Weekly Progress",
        description: "View your workouts completed this week, compare to previous weeks, and see trends.",
        steps: [
          "Go to 'Progress' from bottom navigation",
          "See weekly completion stats",
          "View calendar with workout days highlighted"
        ]
      },
      {
        title: "Session History",
        description: "Review every workout session you've completed with dates, exercises, and performance data.",
        steps: [
          "Go to 'Progress' page",
          "Scroll to 'Workout History'",
          "Tap any session to see full details"
        ]
      },
      {
        title: "Phases & Cycles",
        description: "Your workout cycles repeat in phases. Track your improvement from phase to phase.",
        steps: [
          "Go to 'Progress' > 'Phases'",
          "See all completed phases",
          "Compare performance across phases"
        ]
      }
    ]
  },
  {
    id: "body",
    title: "Body Measurements",
    icon: Scale,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    description: "Track your physical transformation over time.",
    features: [
      {
        title: "Log Your Measurements",
        description: "Record weight, body fat, and detailed measurements (chest, waist, arms, etc.) regularly.",
        steps: [
          "Go to 'My Body' from the menu",
          "Tap 'Add Measurement'",
          "Enter your current stats",
          "Save to track over time"
        ],
        tip: "Measure weekly at the same time for best accuracy."
      },
      {
        title: "View Progress Charts",
        description: "See visual graphs of your weight and measurement changes over weeks and months.",
        tip: "Your trainer may also view your progress to help adjust your program."
      }
    ]
  },
  {
    id: "attendance",
    title: "Gym Attendance",
    icon: QrCode,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Track your gym visits with easy check-in options.",
    features: [
      {
        title: "QR Code Check-in",
        description: "Scan the gym's QR code when you arrive to mark your attendance instantly.",
        steps: [
          "Look for the QR code at your gym entrance",
          "Open your camera app",
          "Scan the code to check in"
        ]
      },
      {
        title: "Auto Attendance",
        description: "When you complete a workout, your attendance is automatically marked for that day.",
        tip: "No need to manually check-in if you complete your workout!"
      },
      {
        title: "Attendance History",
        description: "View your gym visit history on the Attendance page to see patterns and consistency.",
        steps: [
          "Go to 'Attendance' from bottom nav",
          "View calendar with visit days marked",
          "See your visit count this month"
        ]
      }
    ]
  },
  {
    id: "payments",
    title: "Payments & Subscription",
    icon: CreditCard,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    description: "View your membership status and payment history.",
    features: [
      {
        title: "Current Subscription",
        description: "See your active subscription plan, renewal date, and payment status.",
        steps: [
          "Go to 'Payments' from the menu",
          "View your current plan at the top",
          "See next payment due date"
        ]
      },
      {
        title: "Payment History",
        description: "View all past payments with dates and amounts.",
        tip: "Contact your gym for any payment issues or plan changes."
      }
    ]
  },
  {
    id: "diet",
    title: "Diet Plan",
    icon: Utensils,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    description: "View personalized diet plans from your trainer.",
    features: [
      {
        title: "Your Diet Plan",
        description: "If you're a Star Member, your trainer may create a custom diet plan for you.",
        steps: [
          "Go to 'My Diet Plan' from the menu",
          "View daily meal recommendations",
          "See macros and calorie targets"
        ],
        tip: "Star Members get special attention including custom diet plans!"
      }
    ]
  },
  {
    id: "dika",
    title: "Dika AI Assistant",
    icon: Brain,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Your AI buddy for quick answers about your fitness.",
    features: [
      {
        title: "Ask Dika Anything",
        description: "Dika knows your workouts, attendance, payments, and progress. Ask questions naturally!",
        steps: [
          "Tap the floating Dika icon",
          "Ask: 'What's my streak?'",
          "Ask: 'When is my payment due?'",
          "Ask: 'How many days did I attend this month?'"
        ],
        tip: "Dika gives personalized answers based on your actual data!"
      }
    ]
  },
  {
    id: "social",
    title: "Social & Community",
    icon: Activity,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    description: "Connect with your gym community.",
    features: [
      {
        title: "Activity Feed",
        description: "See workout completions and milestones from fellow gym members. React and comment!",
        steps: [
          "Go to 'Feed' from the menu",
          "View recent activity from gym members",
          "React with likes or comments"
        ]
      },
      {
        title: "Tournaments",
        description: "Compete in monthly gym challenges and see where you rank on the leaderboard.",
        steps: [
          "Go to 'Tournaments'",
          "View active challenges",
          "See your ranking and points"
        ]
      },
      {
        title: "Announcements",
        description: "Get important updates from your gym owner about schedule changes, events, and more.",
        steps: [
          "Go to 'Announcements'",
          "Read new messages from your gym",
          "Badge shows unread count"
        ]
      }
    ]
  }
];

const trainerFeatures: FeatureSection[] = [
  {
    id: "members",
    title: "Managing Members",
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "View and manage all members assigned to you.",
    features: [
      {
        title: "Your Member List",
        description: "See all members assigned to you with their current status, last activity, and workout progress.",
        steps: [
          "Go to 'Members' from bottom nav",
          "View all your assigned members",
          "Tap any member for details"
        ]
      },
      {
        title: "Member Profiles",
        description: "View detailed member information including attendance, workout completion, and measurements.",
        tip: "Keep track of members who might need extra motivation!"
      },
      {
        title: "New Member Alerts",
        description: "Your dashboard shows members who don't have a workout plan yet.",
        steps: [
          "Check Dashboard for 'Needs Workout' alerts",
          "Assign a cycle to get them started"
        ]
      }
    ]
  },
  {
    id: "workouts",
    title: "Workout Programs",
    icon: ClipboardList,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    description: "Create and assign workout cycles to your members.",
    features: [
      {
        title: "Creating Cycles",
        description: "Build complete workout programs with multiple days, exercises, sets, reps, and rest periods.",
        steps: [
          "Go to 'Workouts' page",
          "Tap 'Create New Cycle'",
          "Name your cycle and add days",
          "Add exercises to each day",
          "Save and assign to members"
        ]
      },
      {
        title: "Using Templates",
        description: "Save time by creating reusable templates for common workout programs.",
        steps: [
          "Go to 'Templates'",
          "Create a new template or copy from existing cycle",
          "Apply templates when creating member cycles"
        ],
        tip: "Templates are great for standard beginner, intermediate, or advanced programs!"
      },
      {
        title: "Assigning to Members",
        description: "Give each member their personalized workout program.",
        steps: [
          "Open a member's profile",
          "Tap 'Assign Workout'",
          "Choose an existing cycle or create new",
          "Member will see it immediately"
        ]
      }
    ]
  },
  {
    id: "star-members",
    title: "Star Members",
    icon: Star,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    description: "Recognize and reward your top performers.",
    features: [
      {
        title: "Marking Star Members",
        description: "Identify your most dedicated members who deserve special attention.",
        steps: [
          "Go to 'Star Members' page",
          "Tap 'Add Star Member'",
          "Select a member from your list"
        ],
        tip: "Star Members can receive custom diet plans!"
      },
      {
        title: "Creating Diet Plans",
        description: "Give your star members personalized nutrition guidance.",
        steps: [
          "Go to 'Diet Plans'",
          "Create a new diet plan",
          "Add meals, macros, and instructions",
          "Assign to a star member"
        ]
      }
    ]
  },
  {
    id: "dika",
    title: "Dika AI Assistant",
    icon: Brain,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Quick answers about your members and their progress.",
    features: [
      {
        title: "Trainer Questions",
        description: "Ask Dika about your members' progress, attendance, and workout completion.",
        steps: [
          "Tap the floating Dika icon",
          "Ask: 'Which members completed workouts today?'",
          "Ask: 'Who has the best streak?'",
          "Ask: 'Who missed workouts this week?'"
        ]
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
    bgColor: "bg-primary/10",
    description: "Control every aspect of your gym.",
    features: [
      {
        title: "Your Gym Code",
        description: "Share your unique gym code with members who want to join. They'll use it to request membership.",
        steps: [
          "Find your code in the sidebar under your profile",
          "Share with new members",
          "Approve their join requests"
        ]
      },
      {
        title: "Inviting Trainers",
        description: "Add trainers to help manage your members.",
        steps: [
          "Go to 'Trainers' page",
          "Generate an invite link",
          "Share with your trainer",
          "They'll create an account and join automatically"
        ]
      },
      {
        title: "Registering Members",
        description: "Add members directly or approve their join requests.",
        steps: [
          "Go to 'Members' page",
          "Tap 'Add Member' for direct registration",
          "Or check 'Join Requests' to approve pending members"
        ]
      },
      {
        title: "Assigning Trainers to Members",
        description: "Connect each member with a trainer for personalized coaching.",
        steps: [
          "Open a member's profile",
          "Select their assigned trainer",
          "Choose training mode: Trainer-Led or Self-Guided"
        ]
      }
    ]
  },
  {
    id: "payments",
    title: "Payments & Billing",
    icon: CreditCard,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    description: "Handle subscriptions and track revenue.",
    features: [
      {
        title: "Creating Plans",
        description: "Set up subscription plans with custom pricing, duration, and currency.",
        steps: [
          "Go to 'Payments' page",
          "Tap 'Create Plan'",
          "Set name, price, and duration",
          "Choose currency (INR or USD)"
        ]
      },
      {
        title: "Recording Payments",
        description: "Log payments when members pay their dues.",
        steps: [
          "Go to 'Payments' page",
          "Tap 'Record Payment'",
          "Select member and plan",
          "Confirm the payment"
        ]
      },
      {
        title: "Tracking Revenue",
        description: "View your gym's income and payment trends over time.",
        steps: [
          "Dashboard shows revenue summary",
          "Go to 'Revenue' for detailed charts",
          "Filter by month or date range"
        ]
      }
    ]
  },
  {
    id: "attendance",
    title: "Attendance Management",
    icon: QrCode,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    description: "Track and manage member attendance.",
    features: [
      {
        title: "Attendance Dashboard",
        description: "View daily, weekly, and monthly attendance patterns for your gym.",
        steps: [
          "Go to 'Attendance' from bottom nav",
          "See today's check-ins",
          "View attendance charts and trends"
        ]
      },
      {
        title: "Self Check-in Kiosk",
        description: "Set up a tablet at your entrance for members to check themselves in.",
        steps: [
          "Go to 'Self Check-in' page",
          "Enable kiosk mode",
          "Open the kiosk URL on a tablet",
          "Members enter email to check in"
        ]
      }
    ]
  },
  {
    id: "walkins",
    title: "Walk-in Visitors",
    icon: PersonStanding,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    description: "Track day passes, trials, and inquiries.",
    features: [
      {
        title: "Logging Walk-ins",
        description: "Record visitors for day passes, trial sessions, or general inquiries.",
        steps: [
          "Go to 'Walk-ins' page",
          "Tap 'Add Walk-in'",
          "Enter visitor details and purpose",
          "Track their visit"
        ]
      },
      {
        title: "Converting to Members",
        description: "Turn successful trials into full memberships.",
        steps: [
          "Open a walk-in visitor's record",
          "Tap 'Convert to Member'",
          "Complete their registration"
        ]
      }
    ]
  },
  {
    id: "analytics",
    title: "Analytics & Insights",
    icon: BarChart3,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    description: "Data-driven insights to grow your gym.",
    features: [
      {
        title: "Dashboard Overview",
        description: "See key metrics at a glance: active members, today's attendance, revenue, and trends.",
        tip: "Your dashboard is designed to show what matters most!"
      },
      {
        title: "AI Insights",
        description: "Get AI-powered alerts about at-risk members, attendance drops, and business health.",
        steps: [
          "Go to 'AI Insights' page",
          "View automated alerts",
          "See members who might churn",
          "Get recommendations"
        ]
      },
      {
        title: "Member Analytics",
        description: "Deep dive into member behavior, retention, and engagement patterns.",
        steps: [
          "Go to 'Member Analytics'",
          "View retention rates",
          "See most active members",
          "Identify inactive members"
        ]
      }
    ]
  },
  {
    id: "communication",
    title: "Communication",
    icon: Megaphone,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    description: "Keep your gym community informed.",
    features: [
      {
        title: "Announcements",
        description: "Send important updates to all your members and trainers.",
        steps: [
          "Go to 'Announcements'",
          "Tap 'Create Announcement'",
          "Write your message",
          "Choose audience (all, members only, trainers only)",
          "Post it"
        ]
      }
    ]
  }
];

function FeatureCard({ section, isOpen, onToggle }: { section: FeatureSection; isOpen: boolean; onToggle: () => void }) {
  const Icon = section.icon;
  
  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <Card className="overflow-hidden border-l-4" style={{ borderLeftColor: `hsl(var(--primary))` }}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${section.bgColor}`}>
                  <Icon className={`w-6 h-6 ${section.color}`} />
                </div>
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <CardDescription className="mt-1">{section.description}</CardDescription>
                </div>
              </div>
              <div className={`p-2 rounded-full transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            <div className="space-y-6">
              {section.features.map((feature, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-base">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                      
                      {feature.steps && feature.steps.length > 0 && (
                        <div className="mt-3 bg-muted/50 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">How to:</p>
                          <ol className="space-y-1.5">
                            {feature.steps.map((step, stepIndex) => (
                              <li key={stepIndex} className="flex items-start gap-2 text-sm">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                                  {stepIndex + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      
                      {feature.tip && (
                        <div className="mt-3 flex items-start gap-2 text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg p-3">
                          <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span><strong>Tip:</strong> {feature.tip}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {index < section.features.length - 1 && <Separator className="ml-8" />}
                </div>
              ))}
            </div>
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
  let roleIcon: typeof Dumbbell;

  const isIOSNativeApp = isNative() && isIOS();

  if (user?.role === 'owner') {
    if (isIOSNativeApp) {
      features = ownerFeatures.filter(f => !['payments', 'walkins', 'analytics'].includes(f.id));
      roleTitle = "Gym Guide";
      roleDescription = "Manage your gym's attendance and members.";
      roleIcon = Building2;
    } else {
      features = ownerFeatures;
      roleTitle = "Gym Owner Guide";
      roleDescription = "Everything you need to manage and grow your gym business.";
      roleIcon = Building2;
    }
  } else if (user?.role === 'trainer') {
    features = trainerFeatures;
    roleTitle = "Trainer Guide";
    roleDescription = "Tools and tips to help you train members effectively.";
    roleIcon = Users;
  } else if (isPersonalMode) {
    features = personalModeFeatures;
    roleTitle = "Personal Mode Guide";
    roleDescription = "Your complete guide to tracking workouts independently.";
    roleIcon = Dumbbell;
  } else {
    if (isIOSNativeApp) {
      features = memberFeatures.filter(f => f.id !== 'payments').map(f => {
        if (f.id === 'dika') {
          return {
            ...f,
            features: f.features.map(feat => ({
              ...feat,
              description: feat.description.replace(/, payments,/g, ',').replace(/payments, /g, ''),
              steps: feat.steps?.filter(s => !s.toLowerCase().includes('payment'))
            }))
          };
        }
        return f;
      });
    } else {
      features = memberFeatures;
    }
    roleTitle = "Gym Member Guide";
    roleDescription = "Everything you need to make the most of your membership.";
    roleIcon = Dumbbell;
  }

  const RoleIcon = roleIcon;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-purple-500/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-4 rounded-2xl bg-primary/20">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {roleTitle}
                </h1>
                <p className="text-muted-foreground mt-1">{roleDescription}</p>
                <Badge variant="secondary" className="mt-2">
                  <RoleIcon className="w-3 h-3 mr-1" />
                  {isPersonalMode ? "Personal Mode" : user?.role === 'owner' ? "Owner" : user?.role === 'trainer' ? "Trainer" : "Member"}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={expandAll} data-testid="button-expand-all">
                <ChevronDown className="w-4 h-4 mr-1" />
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
                <ChevronUp className="w-4 h-4 mr-1" />
                Collapse All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {features.map(section => (
          <FeatureCard 
            key={section.id}
            section={section}
            isOpen={openSections.includes(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
        ))}
      </div>

      <Card className="bg-gradient-to-r from-purple-500/10 to-primary/10 border-purple-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-4 rounded-2xl bg-purple-500/20">
              <Brain className="w-8 h-8 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">Still have questions? Ask Dika!</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Dika is your AI assistant who knows all about your workouts, progress, and gym data. 
                Just tap the floating button on any page to chat!
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  "What's my current streak?"
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  <MessageCircle className="w-3 h-3 mr-1" />
                  "How many workouts this month?"
                </Badge>
                {!isIOSNativeApp && (
                  <Badge variant="secondary" className="text-xs">
                    <MessageCircle className="w-3 h-3 mr-1" />
                    "When is my payment due?"
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
