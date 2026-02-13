import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  X, Dumbbell, Utensils, Brain, ChevronLeft, ChevronRight,
  ArrowRight, Sparkles, RefreshCw, Import, BarChart3,
  Apple, Droplets, MapPin, MessageSquare, Replace,
  Scale, Target, Users, CreditCard, Navigation,
  UserPlus, ClipboardList, Star, Check
} from "lucide-react";
import { isNative, isIOS } from "@/lib/capacitor-init";

interface CardBullet {
  icon: typeof Dumbbell;
  text: string;
}

interface OnboardingCard {
  title: string;
  subtitle: string;
  icon: typeof Dumbbell;
  gradient: string;
  iconBg: string;
  bullets: CardBullet[];
}

interface OnboardingCarouselProps {
  cards: OnboardingCard[];
  onComplete: () => void;
}

function OnboardingCarousel({ cards, onComplete }: OnboardingCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance && currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    if (distance < -minSwipeDistance && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const card = cards[currentIndex];
  const Icon = card.icon;
  const isLast = currentIndex === cards.length - 1;

  return (
    <div 
      className="fixed inset-0 z-50 bg-background flex flex-col" 
      data-testid="onboarding-carousel"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          {cards.map((c, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-8 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/30"
              }`}
              data-testid={`dot-${i}`}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onComplete}
          className="text-muted-foreground h-8 px-3 text-xs gap-1"
          data-testid="button-skip"
        >
          <X className="w-3.5 h-3.5" />
          Skip
        </Button>
      </div>

      <div 
        className="flex-1 overflow-y-auto px-4 pb-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={`rounded-2xl bg-gradient-to-br ${card.gradient} p-4 mb-4`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center shrink-0`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight text-foreground" data-testid="text-card-title">{card.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{card.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {card.bullets.map((bullet, i) => {
            const BulletIcon = bullet.icon;
            return (
              <div 
                key={i} 
                className="flex items-start gap-3 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                data-testid={`bullet-${i}`}
              >
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <BulletIcon className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200 pt-0.5">{bullet.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div 
        className="px-4 py-3 border-t border-border/30 flex items-center gap-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="w-9 h-9 rounded-full shrink-0"
          data-testid="button-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {isLast ? (
          <Button 
            onClick={onComplete} 
            className="flex-1 h-10 text-sm gap-2"
            data-testid="button-get-started"
          >
            <Check className="w-4 h-4" />
            Get Started
          </Button>
        ) : (
          <Button 
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="flex-1 h-10 text-sm gap-1"
            data-testid="button-next"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={() => currentIndex < cards.length - 1 && setCurrentIndex(currentIndex + 1)}
          disabled={isLast}
          className="w-9 h-9 rounded-full shrink-0"
          data-testid="button-next-arrow"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const memberCards: OnboardingCard[] = [
  {
    title: "Your Workouts",
    subtitle: "Everything about your training",
    icon: Dumbbell,
    gradient: "from-blue-500/20 to-indigo-500/10",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    bullets: [
      { icon: ClipboardList, text: "Your trainer creates workout cycles for you — open your dashboard and start logging sets, reps, and weights" },
      { icon: Sparkles, text: "Or create your own workouts using the smart wizard — build custom cycles tailored to your goals" },
      { icon: Import, text: "Got a workout from ChatGPT? Paste it in and it gets auto-organized into a proper program" },
      { icon: Replace, text: "Can't do an exercise? Swap it for an alternative right from your workout" },
      { icon: BarChart3, text: "Track progress with workout streaks and week-by-week comparisons" },
    ]
  },
  {
    title: "Nutrition Tracking",
    subtitle: "Eat smart, track easily",
    icon: Utensils,
    gradient: "from-emerald-500/20 to-green-500/10",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    bullets: [
      { icon: Apple, text: "Log meals from 450+ foods — search, tap, and calories with macros are logged instantly" },
      { icon: RefreshCw, text: "Choose cooking styles (grilled, fried, boiled) and calories adjust automatically" },
      { icon: Droplets, text: "Track daily water and protein intake with simple one-tap buttons" },
      { icon: MessageSquare, text: "Just tell Dika \"I had 2 eggs and toast\" and she logs it for you" },
      { icon: MapPin, text: "Use Find My Food to discover healthy restaurants near you" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your personal fitness buddy",
    icon: Brain,
    gradient: "from-orange-500/20 to-amber-500/10",
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    bullets: [
      { icon: Replace, text: "\"What can I do instead of pull-ups?\" — Get instant exercise alternatives" },
      { icon: Scale, text: "\"Log my weight as 75kg\" — Track body measurements through chat" },
      { icon: Utensils, text: "\"Suggest a high protein lunch\" — Get personalized meal ideas" },
      { icon: Target, text: "\"Set a goal to lose 5kg\" — Create fitness goals Dika tracks for you" },
      { icon: BarChart3, text: "Get weekly AI reports summarizing your workouts and nutrition" },
    ]
  }
];

const personalModeCards: OnboardingCard[] = [
  {
    title: "Your Workouts",
    subtitle: "Train on your own terms",
    icon: Dumbbell,
    gradient: "from-blue-500/20 to-indigo-500/10",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    bullets: [
      { icon: Sparkles, text: "Create custom workout cycles using the smart wizard — pick exercises, set reps and weights" },
      { icon: Import, text: "Paste a workout from ChatGPT and it auto-organizes into a proper program" },
      { icon: Replace, text: "Swap exercises in your cycle anytime — replace what doesn't work for you" },
      { icon: RefreshCw, text: "Push workouts forward if you need to skip a day — stay flexible" },
      { icon: BarChart3, text: "Track streaks, log sessions, and watch your consistency grow" },
    ]
  },
  {
    title: "Nutrition Tracking",
    subtitle: "Eat smart, track easily",
    icon: Utensils,
    gradient: "from-emerald-500/20 to-green-500/10",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    bullets: [
      { icon: Apple, text: "Log meals from 450+ foods with automatic calorie and macro calculation" },
      { icon: RefreshCw, text: "Choose cooking styles (grilled, fried, boiled) — calories adjust automatically" },
      { icon: Droplets, text: "Track water and protein intake with simple one-tap buttons" },
      { icon: MessageSquare, text: "Tell Dika what you ate — \"I had chicken and rice\" — and she logs it" },
      { icon: MapPin, text: "Find My Food shows healthy restaurants near you" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your personal fitness buddy",
    icon: Brain,
    gradient: "from-orange-500/20 to-amber-500/10",
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    bullets: [
      { icon: Replace, text: "\"What can I do instead of barbell squats?\" — Get alternatives instantly" },
      { icon: Scale, text: "\"Log my weight as 80kg\" — Track body measurements through chat" },
      { icon: Utensils, text: "\"Suggest a post-workout meal\" — Get meal ideas for your goals" },
      { icon: Target, text: "\"Set a goal to bench 100kg\" — Create goals Dika tracks for you" },
      { icon: BarChart3, text: "Weekly AI reports summarize your workouts and progress" },
    ]
  }
];

const trainerCards: OnboardingCard[] = [
  {
    title: "Workout Management",
    subtitle: "Design programs for your members",
    icon: Dumbbell,
    gradient: "from-blue-500/20 to-indigo-500/10",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    bullets: [
      { icon: ClipboardList, text: "Create workout cycles for each member — set exercises, sets, reps, and rest times" },
      { icon: Sparkles, text: "Save workout templates and assign them to multiple members quickly" },
      { icon: Users, text: "Choose Training Mode: Trainer-Led (you control) or Self-Guided (members manage)" },
      { icon: BarChart3, text: "Monitor each member's workout completion and consistency" },
      { icon: Replace, text: "Members can swap exercises — you'll see what they changed" },
    ]
  },
  {
    title: "Nutrition & Diet",
    subtitle: "Guide your members' diet",
    icon: Utensils,
    gradient: "from-emerald-500/20 to-green-500/10",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    bullets: [
      { icon: Star, text: "Mark top performers as Star Members and create custom diet plans" },
      { icon: Apple, text: "Members track meals with 450+ foods — you can view their logs" },
      { icon: Target, text: "Set calorie and protein targets for your members" },
      { icon: MessageSquare, text: "Members use Dika to log meals by chatting naturally" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your AI training helper",
    icon: Brain,
    gradient: "from-orange-500/20 to-amber-500/10",
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    bullets: [
      { icon: Users, text: "\"How is John doing this week?\" — Get instant member insights" },
      { icon: ClipboardList, text: "\"What's a good push/pull/legs split?\" — Get programming ideas" },
      { icon: Navigation, text: "\"Go to my assigned members\" — Navigate the app through chat" },
      { icon: BarChart3, text: "Weekly AI reports highlight who needs your attention" },
    ]
  }
];

const ownerCards: OnboardingCard[] = [
  {
    title: "Gym Workouts",
    subtitle: "Manage your gym's training",
    icon: Dumbbell,
    gradient: "from-blue-500/20 to-indigo-500/10",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    bullets: [
      { icon: Users, text: "Set Training Mode — Trainer-Led (trainers assign) or Self-Guided (members create own)" },
      { icon: ClipboardList, text: "Trainers create workout cycles and templates for your members" },
      { icon: BarChart3, text: "View workout activity and attendance across your entire gym" },
      { icon: Replace, text: "Members can swap exercises and import workouts from AI assistants" },
    ]
  },
  {
    title: "Nutrition & Wellness",
    subtitle: "Member wellness tracking",
    icon: Utensils,
    gradient: "from-emerald-500/20 to-green-500/10",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    bullets: [
      { icon: Apple, text: "Members track meals with 450+ foods, water, and daily protein goals" },
      { icon: Star, text: "Trainers create diet plans for Star Members" },
      { icon: MessageSquare, text: "Members use Dika to log meals by chatting — quick and easy" },
      { icon: MapPin, text: "Find My Food helps members discover healthy restaurants" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your AI gym manager",
    icon: Brain,
    gradient: "from-orange-500/20 to-amber-500/10",
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    bullets: [
      { icon: UserPlus, text: "\"Add John, phone 0551234567\" — Register members through chat" },
      { icon: CreditCard, text: "\"Log payment for Sarah, 200 AED\" — Record payments hands-free" },
      { icon: Users, text: "\"Assign trainer Mike to Sarah\" — Manage assignments instantly" },
      { icon: Navigation, text: "\"Go to payments\" — Navigate anywhere through Dika" },
      { icon: BarChart3, text: "Weekly AI reports on gym activity and member engagement" },
    ]
  }
];

const ownerCardsIOS: OnboardingCard[] = [
  {
    title: "Gym Workouts",
    subtitle: "Manage your gym's training",
    icon: Dumbbell,
    gradient: "from-blue-500/20 to-indigo-500/10",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    bullets: [
      { icon: Users, text: "Set Training Mode — Trainer-Led or Self-Guided for your members" },
      { icon: ClipboardList, text: "Trainers create workout cycles and templates" },
      { icon: BarChart3, text: "View workout activity and attendance across your gym" },
    ]
  },
  {
    title: "Member Management",
    subtitle: "Keep your gym running smoothly",
    icon: Users,
    gradient: "from-emerald-500/20 to-green-500/10",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    bullets: [
      { icon: UserPlus, text: "Register members and share your gym code for self-joining" },
      { icon: Users, text: "Assign trainers and track attendance patterns" },
      { icon: Star, text: "Identify Star Members for special attention and diet plans" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your AI gym helper",
    icon: Brain,
    gradient: "from-orange-500/20 to-amber-500/10",
    iconBg: "bg-gradient-to-br from-orange-500 to-amber-600",
    bullets: [
      { icon: Users, text: "\"How many active members?\" — Get instant gym insights" },
      { icon: Navigation, text: "\"Go to members page\" — Navigate hands-free through chat" },
      { icon: BarChart3, text: "Weekly AI reports on gym activity and engagement" },
    ]
  }
];

export function MemberOnboarding({ onComplete }: { onComplete: () => void }) {
  return <OnboardingCarousel cards={memberCards} onComplete={onComplete} />;
}

export function PersonalModeOnboarding({ onComplete }: { onComplete: () => void }) {
  return <OnboardingCarousel cards={personalModeCards} onComplete={onComplete} />;
}

export function TrainerOnboarding({ onComplete }: { onComplete: () => void }) {
  return <OnboardingCarousel cards={trainerCards} onComplete={onComplete} />;
}

export function OwnerOnboarding({ onComplete }: { onComplete: () => void }) {
  const cards = (isNative() && isIOS()) ? ownerCardsIOS : ownerCards;
  return <OnboardingCarousel cards={cards} onComplete={onComplete} />;
}
