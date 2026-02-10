import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  X, ChevronLeft, ChevronRight, ArrowRight, 
  Brain, CreditCard, Users, CalendarCheck, Dumbbell, 
  TrendingUp, Star, Utensils, QrCode, Megaphone,
  PersonStanding, Scale, Activity, Trophy, Apple,
  Target, ClipboardList, UserPlus, PhoneCall, BarChart3,
  Sparkles, type LucideIcon
} from "lucide-react";
import { RoboDIcon } from "@/components/dika/dika-icons";

interface FeatureTip {
  id: string;
  icon: LucideIcon | typeof RoboDIcon;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  gradient: string;
  iconBg: string;
}

const ownerTips: FeatureTip[] = [
  {
    id: "owner-dika",
    icon: Brain,
    title: "Ask Dika Anything",
    description: "\"Who hasn't paid?\" \"Show expiring memberships\" - Dika handles it all with AI-powered insights.",
    href: "/dika",
    actionLabel: "Try Dika",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconBg: "bg-purple-500/15 text-purple-500"
  },
  {
    id: "owner-qr",
    icon: QrCode,
    title: "Self Check-in Kiosk",
    description: "Set up a tablet at your entrance. Members scan their QR code to check in automatically.",
    href: "/owner/kiosk",
    actionLabel: "Set Up Kiosk",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-500/15 text-blue-500"
  },
  {
    id: "owner-walkin",
    icon: PersonStanding,
    title: "Track Walk-in Visitors",
    description: "Log day passes, trial visitors, and inquiries. See conversion rates from visitors to members.",
    href: "/owner/walk-in-visitors",
    actionLabel: "View Walk-ins",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconBg: "bg-emerald-500/15 text-emerald-500"
  },
  {
    id: "owner-announcements",
    icon: Megaphone,
    title: "Send Announcements",
    description: "Notify all members about schedule changes, events, or updates with one tap.",
    href: "/owner/announcements",
    actionLabel: "Create Post",
    gradient: "from-amber-500/10 to-yellow-500/10",
    iconBg: "bg-amber-500/15 text-amber-500"
  },
  {
    id: "owner-ai-insights",
    icon: BarChart3,
    title: "AI-Powered Insights",
    description: "Get smart alerts about members at risk of leaving, follow-up reminders, and growth patterns.",
    href: "/owner/ai-insights",
    actionLabel: "View Insights",
    gradient: "from-rose-500/10 to-pink-500/10",
    iconBg: "bg-rose-500/15 text-rose-500"
  },
  {
    id: "owner-followups",
    icon: PhoneCall,
    title: "Follow-up Reminders",
    description: "Never miss a lead. Track who to call back about memberships, renewals, and inquiries.",
    href: "/owner/follow-ups",
    actionLabel: "View Follow-ups",
    gradient: "from-teal-500/10 to-emerald-500/10",
    iconBg: "bg-teal-500/15 text-teal-500"
  },
  {
    id: "owner-transfers",
    icon: Activity,
    title: "Gym Transfers",
    description: "Members can request transfers between gyms in your network. Manage incoming and outgoing transfer requests easily.",
    href: "/transfers",
    actionLabel: "View Transfers",
    gradient: "from-slate-500/10 to-gray-500/10",
    iconBg: "bg-slate-500/15 text-slate-500"
  },
  {
    id: "owner-tournaments",
    icon: Trophy,
    title: "Run Tournaments",
    description: "Create fitness challenges and tournaments to keep your members motivated and engaged.",
    href: "/tournaments",
    actionLabel: "View Tournaments",
    gradient: "from-orange-500/10 to-amber-500/10",
    iconBg: "bg-orange-500/15 text-orange-500"
  },
];

const trainerTips: FeatureTip[] = [
  {
    id: "trainer-dika",
    icon: Brain,
    title: "Dika Knows Your Members",
    description: "Ask Dika about any member's progress, attendance patterns, or workout history instantly.",
    href: "/dika",
    actionLabel: "Ask Dika",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconBg: "bg-purple-500/15 text-purple-500"
  },
  {
    id: "trainer-star",
    icon: Star,
    title: "Star Your Best Members",
    description: "Mark top performers as Star Members and create personalized diet plans for them.",
    href: "/star-members",
    actionLabel: "View Stars",
    gradient: "from-amber-500/10 to-yellow-500/10",
    iconBg: "bg-amber-500/15 text-amber-500"
  },
  {
    id: "trainer-templates",
    icon: ClipboardList,
    title: "Save Workout Templates",
    description: "Create reusable workout templates and assign them to multiple members quickly.",
    href: "/templates",
    actionLabel: "View Templates",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-500/15 text-blue-500"
  },
  {
    id: "trainer-diet",
    icon: Utensils,
    title: "Create Diet Plans",
    description: "Design nutrition plans for your Star Members to complement their workout programs.",
    href: "/diet-plans",
    actionLabel: "Create Plan",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconBg: "bg-emerald-500/15 text-emerald-500"
  },
  {
    id: "trainer-feed",
    icon: Activity,
    title: "Social Feed",
    description: "See what your members are sharing. Celebrate their achievements and stay connected.",
    href: "/feed",
    actionLabel: "View Feed",
    gradient: "from-rose-500/10 to-pink-500/10",
    iconBg: "bg-rose-500/15 text-rose-500"
  },
];

const memberTips: FeatureTip[] = [
  {
    id: "member-dika",
    icon: Brain,
    title: "Chat with Dika AI",
    description: "Ask about your workout schedule, track progress, or log meals just by chatting naturally.",
    href: "/dika",
    actionLabel: "Open Dika",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconBg: "bg-purple-500/15 text-purple-500"
  },
  {
    id: "member-nutrition",
    icon: Apple,
    title: "Track Your Nutrition",
    description: "Log meals, track calories and protein, and get AI-powered nutrition estimates for any food.",
    href: "/nutrition",
    actionLabel: "Start Tracking",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconBg: "bg-emerald-500/15 text-emerald-500"
  },
  {
    id: "member-body",
    icon: Scale,
    title: "Log Body Measurements",
    description: "Track your weight, body fat, and measurements over time. See your transformation visually.",
    href: "/my-body",
    actionLabel: "Log Measurement",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-500/15 text-blue-500"
  },
  {
    id: "member-progress",
    icon: TrendingUp,
    title: "View Your Progress",
    description: "See workout streaks, completion rates, and how you compare week by week.",
    href: "/progress",
    actionLabel: "View Stats",
    gradient: "from-amber-500/10 to-yellow-500/10",
    iconBg: "bg-amber-500/15 text-amber-500"
  },
  {
    id: "member-feed",
    icon: Activity,
    title: "Share Achievements",
    description: "Post your workout milestones to the gym feed and celebrate with fellow members.",
    href: "/feed",
    actionLabel: "View Feed",
    gradient: "from-rose-500/10 to-pink-500/10",
    iconBg: "bg-rose-500/15 text-rose-500"
  },
  {
    id: "member-tournaments",
    icon: Trophy,
    title: "Join Tournaments",
    description: "Compete in gym fitness challenges and earn points on the leaderboard.",
    href: "/tournaments",
    actionLabel: "View Tournaments",
    gradient: "from-orange-500/10 to-amber-500/10",
    iconBg: "bg-orange-500/15 text-orange-500"
  },
];

const personalModeTips: FeatureTip[] = [
  {
    id: "personal-dika",
    icon: Brain,
    title: "Your AI Fitness Buddy",
    description: "Ask Dika about your workouts, log meals by chatting, or get personalized fitness advice.",
    href: "/dika",
    actionLabel: "Chat with Dika",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconBg: "bg-purple-500/15 text-purple-500"
  },
  {
    id: "personal-workout",
    icon: Sparkles,
    title: "Import AI Workouts",
    description: "Paste a workout from ChatGPT or any AI assistant and we'll organize it into a program for you.",
    href: "/my-workouts",
    actionLabel: "Import Workout",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-500/15 text-blue-500"
  },
  {
    id: "personal-nutrition",
    icon: Apple,
    title: "Track Calories & Protein",
    description: "Log meals with AI-powered nutrition estimates. Just type what you ate and Dika figures out the rest.",
    href: "/nutrition",
    actionLabel: "Start Tracking",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconBg: "bg-emerald-500/15 text-emerald-500"
  },
  {
    id: "personal-body",
    icon: Scale,
    title: "Track Your Body",
    description: "Log weight, measurements, and body fat percentage. Watch your transformation unfold.",
    href: "/my-body",
    actionLabel: "Log Measurement",
    gradient: "from-amber-500/10 to-yellow-500/10",
    iconBg: "bg-amber-500/15 text-amber-500"
  },
  {
    id: "personal-join",
    icon: UserPlus,
    title: "Join a Gym",
    description: "Got a gym code? Join your local gym to get trainer-designed workouts and track attendance.",
    href: "/join-gym",
    actionLabel: "Join Gym",
    gradient: "from-rose-500/10 to-pink-500/10",
    iconBg: "bg-rose-500/15 text-rose-500"
  },
];

function getStorageKey(role: string) {
  return `ogym_tips_dismissed_${role}`;
}

function getDismissedTips(role: string): string[] {
  try {
    const stored = localStorage.getItem(getStorageKey(role));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function dismissTip(role: string, tipId: string) {
  const dismissed = getDismissedTips(role);
  if (!dismissed.includes(tipId)) {
    dismissed.push(tipId);
    localStorage.setItem(getStorageKey(role), JSON.stringify(dismissed));
  }
}

export function FeatureDiscoveryTips({ role, isPersonalMode }: { role: string; isPersonalMode?: boolean }) {
  const allTips = role === "owner" ? ownerTips 
    : role === "trainer" ? trainerTips 
    : isPersonalMode ? personalModeTips 
    : memberTips;

  const roleKey = isPersonalMode ? "personal" : role;
  const [dismissed, setDismissed] = useState<string[]>(() => getDismissedTips(roleKey));
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleTips = allTips.filter(t => !dismissed.includes(t.id));

  useEffect(() => {
    if (currentIndex >= visibleTips.length && visibleTips.length > 0) {
      setCurrentIndex(0);
    }
  }, [visibleTips.length, currentIndex]);

  useEffect(() => {
    if (visibleTips.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % visibleTips.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [visibleTips.length]);

  if (visibleTips.length === 0) return null;

  const tip = visibleTips[currentIndex % visibleTips.length];
  if (!tip) return null;

  const Icon = tip.icon;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dismissTip(roleKey, tip.id);
    setDismissed(prev => [...prev, tip.id]);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex(prev => (prev - 1 + visibleTips.length) % visibleTips.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex(prev => (prev + 1) % visibleTips.length);
  };

  return (
    <Card className={`border-0 bg-gradient-to-br ${tip.gradient} overflow-visible relative`} data-testid="feature-discovery-tips">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 right-1 h-7 w-7 text-muted-foreground/50 z-10"
        onClick={handleDismiss}
        data-testid="button-dismiss-tip"
      >
        <X className="w-3.5 h-3.5" />
      </Button>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${tip.iconBg} shrink-0 mt-0.5`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <p className="text-sm font-semibold mb-0.5" data-testid="text-tip-title">{tip.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2" data-testid="text-tip-description">{tip.description}</p>
            <Link href={tip.href}>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 -ml-2" data-testid="button-tip-action">
                {tip.actionLabel}
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
        {visibleTips.length > 1 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-foreground/5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePrev} data-testid="button-tip-prev">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="flex items-center gap-1">
              {visibleTips.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${
                    i === currentIndex % visibleTips.length
                      ? "w-4 h-1.5 bg-foreground/40"
                      : "w-1.5 h-1.5 bg-foreground/15"
                  }`}
                />
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNext} data-testid="button-tip-next">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
