import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  X, ChevronLeft, ChevronRight, ArrowRight, 
  Brain, Star, QrCode, ClipboardList, BarChart3,
  Trophy, Apple, Sparkles, type LucideIcon
} from "lucide-react";
import { RoboDIcon } from "@/components/dika/dika-icons";
import { isNative, isIOS } from "@/lib/capacitor-init";

const IOS_BLOCKED_OWNER_TIPS = ["owner-dika", "owner-ai-insights"];

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
    title: "Ask Dika — Your Gym Co-Pilot",
    description: "Try asking: \"Who hasn't paid this month?\" or \"Show members expiring next week.\" Dika pulls real data instantly — payments, attendance, churn risk — so you run your gym from one chat.",
    href: "/dika",
    actionLabel: "Try Dika Now",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconBg: "bg-purple-500/15 text-purple-500"
  },
  {
    id: "owner-ai-insights",
    icon: BarChart3,
    title: "5-Pillar AI Insights",
    description: "Dika watches your gym 24/7: churn risk alerts before members leave, daily insight of the day, weekly owner briefing, trainer performance scores, and re-engagement campaign ideas — all automated.",
    href: "/owner/ai-insights",
    actionLabel: "View Insights",
    gradient: "from-rose-500/10 to-pink-500/10",
    iconBg: "bg-rose-500/15 text-rose-500"
  },
  {
    id: "owner-qr",
    icon: QrCode,
    title: "QR Kiosk + Auto Check-in",
    description: "Put a tablet at your entrance — members scan their personal QR code to check in. You get real-time attendance logs, peak hour analytics, and streak tracking without lifting a finger.",
    href: "/owner/kiosk",
    actionLabel: "Set Up Kiosk",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-500/15 text-blue-500"
  },
];

const trainerTips: FeatureTip[] = [
  {
    id: "trainer-dika",
    icon: Brain,
    title: "Ask Dika About Any Member",
    description: "Try: \"How's Ahmed doing?\" or \"Who missed 3+ days?\" Dika gives you attendance trends, workout completion rates, and performance summaries for each member — no spreadsheets needed.",
    href: "/dika",
    actionLabel: "Ask Dika",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconBg: "bg-purple-500/15 text-purple-500"
  },
  {
    id: "trainer-star",
    icon: Star,
    title: "Star Members + Diet Plans",
    description: "Mark your top performers as Star Members. Then create personalized diet plans just for them — with custom meals, macros, and calorie targets tailored to their goals.",
    href: "/star-members",
    actionLabel: "View Stars",
    gradient: "from-amber-500/10 to-yellow-500/10",
    iconBg: "bg-amber-500/15 text-amber-500"
  },
  {
    id: "trainer-templates",
    icon: ClipboardList,
    title: "Workout Templates",
    description: "Build a workout once, assign it to 50 members. Create reusable templates with exercises, sets, reps, and rest days — then push them to members in one tap.",
    href: "/templates",
    actionLabel: "View Templates",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-500/15 text-blue-500"
  },
];

const memberTips: FeatureTip[] = [
  {
    id: "member-dika",
    icon: Brain,
    title: "Try Dika — Your AI Coach",
    description: "Say \"Log a chicken salad for lunch\" and it's done. Ask \"What should I work on today?\" and Dika checks your cycle. It tracks your goals, gives weekly reports, and even coaches your nutrition — all through chat or voice.",
    href: "/dika",
    actionLabel: "Try Dika Now",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconBg: "bg-purple-500/15 text-purple-500"
  },
  {
    id: "member-nutrition",
    icon: Apple,
    title: "Smart Nutrition Tracking",
    description: "Log from 71+ restaurant menus with verified calories (McDonald's, Chipotle, Subway & more), snap a photo of your plate for instant AI estimates, or just type what you ate. Track protein, carbs, fat & water — all in one place.",
    href: "/nutrition",
    actionLabel: "Start Tracking",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconBg: "bg-emerald-500/15 text-emerald-500"
  },
  {
    id: "member-sports",
    icon: Trophy,
    title: "Sports Mode + Tournaments",
    description: "Get AI-generated multi-week training programs for your sport, log match days with recovery suggestions, join gym tournaments, and compete on the leaderboard. Plus track your body measurements and see your transformation over time.",
    href: "/sports",
    actionLabel: "Explore",
    gradient: "from-orange-500/10 to-amber-500/10",
    iconBg: "bg-orange-500/15 text-orange-500"
  },
];

const personalModeTips: FeatureTip[] = [
  {
    id: "personal-dika",
    icon: Brain,
    title: "Meet Dika — Your AI Buddy",
    description: "Chat or use voice hands-free: \"Log 2 eggs and toast for breakfast\" — done. \"How many calories this week?\" — instant answer. Dika gives you weekly fitness reports, smart workout suggestions, and nutrition coaching based on your real data.",
    href: "/dika",
    actionLabel: "Try Dika Now",
    gradient: "from-purple-500/10 to-indigo-500/10",
    iconBg: "bg-purple-500/15 text-purple-500"
  },
  {
    id: "personal-nutrition",
    icon: Apple,
    title: "Full Nutrition Suite",
    description: "71+ restaurant menus with verified nutrition (McDonald's to Sweetgreen), photo-based food scanning, AI calorie estimation, protein & water tracking, weekly analytics, and a \"Find My Food\" feature to discover healthy restaurants near you.",
    href: "/nutrition",
    actionLabel: "Start Tracking",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconBg: "bg-emerald-500/15 text-emerald-500"
  },
  {
    id: "personal-workout",
    icon: Sparkles,
    title: "AI Workouts + Body Tracking",
    description: "Paste a workout from ChatGPT and we'll organize it into a full program with sets, reps, and rest days. Track weight, body fat, and measurements over time. Set fitness goals and watch Dika track your progress automatically.",
    href: "/my-workouts",
    actionLabel: "Get Started",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconBg: "bg-blue-500/15 text-blue-500"
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
  const isIOSNativeApp = isNative() && isIOS();
  const baseTips = role === "owner" ? ownerTips 
    : role === "trainer" ? trainerTips 
    : isPersonalMode ? personalModeTips 
    : memberTips;
  const allTips = (role === "owner" && isIOSNativeApp)
    ? baseTips.filter(t => !IOS_BLOCKED_OWNER_TIPS.includes(t.id))
    : baseTips;

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
