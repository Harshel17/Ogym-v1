import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { 
  X, Dumbbell, Utensils, Brain, ChevronLeft, ChevronRight,
  ArrowRight, Sparkles, RefreshCw, Import, BarChart3,
  Apple, Droplets, MapPin, MessageSquare, Replace,
  Scale, Target, Users, CreditCard, Navigation,
  UserPlus, ClipboardList, Star, Check, Zap
} from "lucide-react";
import { isNative, isIOS } from "@/lib/capacitor-init";

interface CardBullet {
  icon: typeof Dumbbell;
  text: string;
  color: string;
}

interface OnboardingCard {
  title: string;
  subtitle: string;
  icon: typeof Dumbbell;
  gradient: string;
  iconGradient: string;
  iconBg: string;
  accentColor: string;
  bullets: CardBullet[];
  proTipIndex?: number;
}

interface OnboardingCarouselProps {
  cards: OnboardingCard[];
  onComplete: () => void;
}

function OnboardingCarousel({ cards, onComplete }: OnboardingCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [isAnimating, setIsAnimating] = useState(false);
  const [visibleBullets, setVisibleBullets] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const minSwipeDistance = 50;
  const card = cards[currentIndex];
  const isLast = currentIndex === cards.length - 1;

  const resetAutoPlay = useCallback(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(() => {
      if (!isAnimating) {
        goTo((prev: number) => (prev + 1) % cards.length, "right");
      }
    }, 10000);
  }, [cards.length, isAnimating]);

  useEffect(() => {
    resetAutoPlay();
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [resetAutoPlay]);

  useEffect(() => {
    setVisibleBullets(0);
    const totalBullets = card.bullets.length;
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setVisibleBullets(count);
      if (count >= totalBullets) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [currentIndex, card.bullets.length]);

  const goTo = useCallback((indexOrFn: number | ((prev: number) => number), dir: "left" | "right") => {
    if (isAnimating) return;
    setDirection(dir);
    setIsAnimating(true);
    setTimeout(() => {
      if (typeof indexOrFn === "function") {
        setCurrentIndex(indexOrFn);
      } else {
        setCurrentIndex(indexOrFn);
      }
      setTimeout(() => setIsAnimating(false), 400);
    }, 50);
  }, [isAnimating]);

  const goNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      goTo(currentIndex + 1, "right");
    }
  }, [currentIndex, cards.length, goTo]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      goTo(currentIndex - 1, "left");
    }
  }, [currentIndex, goTo]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setDragOffset(0);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const current = e.targetTouches[0].clientX;
    setTouchEnd(current);
    if (touchStart !== null) {
      setDragOffset(current - touchStart);
    }
  };

  const onTouchEnd = () => {
    setDragOffset(0);
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) { goNext(); resetAutoPlay(); }
    else if (distance < -minSwipeDistance) { goPrev(); resetAutoPlay(); }
  };

  const Icon = card.icon;

  return (
    <div 
      className="fixed inset-0 z-50 bg-background overflow-hidden" 
      data-testid="onboarding-carousel"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 0px)',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
      }}
    >
      <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => { goTo(i, i > currentIndex ? "right" : "left"); resetAutoPlay(); }}
              className="relative rounded-full overflow-hidden transition-all duration-500"
              style={{ 
                width: i === currentIndex ? 32 : 8, 
                height: 8 
              }}
              data-testid={`dot-${i}`}
            >
              <div className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                i === currentIndex ? 'bg-primary' : i < currentIndex ? 'bg-primary/40' : 'bg-muted-foreground/20'
              }`} />
              {i === currentIndex && (
                <div 
                  className="absolute left-0 top-0 bottom-0 rounded-full bg-primary/30"
                  style={{
                    animation: 'progressFill 10s linear forwards',
                    width: '0%',
                  }}
                />
              )}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onComplete}
          className="text-muted-foreground text-xs gap-1"
          data-testid="button-skip"
        >
          <X className="w-3.5 h-3.5" />
          Skip
        </Button>
      </div>

      <div 
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div 
          className="transition-all duration-400 ease-out"
          style={{
            transform: `translateX(${dragOffset * 0.3}px)`,
            opacity: isAnimating ? 0 : 1,
            transition: isAnimating ? 'opacity 0.3s ease-out, transform 0.3s ease-out' : 'opacity 0.4s ease-in, transform 0.1s ease-out',
          }}
        >
          <div 
            className={`rounded-2xl bg-gradient-to-br ${card.gradient} p-5 mb-4 relative overflow-hidden`}
          >
            <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/5 dark:bg-white/3" />
            <div className="absolute -right-2 -bottom-8 w-32 h-32 rounded-full bg-white/3 dark:bg-white/2" />
            
            <div className="flex items-center gap-4 relative z-10">
              <div className={`w-14 h-14 rounded-2xl ${card.iconBg} flex items-center justify-center shrink-0 shadow-lg`}
                style={{ animation: 'iconFloat 3s ease-in-out infinite' }}
              >
                <Icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight text-foreground" data-testid="text-card-title">
                  {card.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">{card.subtitle}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {card.bullets.map((bullet, i) => {
              const BulletIcon = bullet.icon;
              const isProTip = card.proTipIndex === i;
              const isVisible = i < visibleBullets;
              
              return (
                <div 
                  key={`${currentIndex}-${i}`}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-300 ${
                    isProTip
                      ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 border-amber-200/60 dark:border-amber-500/20'
                      : 'bg-card border-border/60 hover:border-border'
                  }`}
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
                    transition: `opacity 0.35s ease-out ${i * 0.08}s, transform 0.35s ease-out ${i * 0.08}s`,
                  }}
                  data-testid={`bullet-${i}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${bullet.color}`}>
                    <BulletIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {isProTip && (
                      <div className="flex items-center gap-1 mb-1">
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pro Tip</span>
                      </div>
                    )}
                    <p className="text-[13px] leading-relaxed text-foreground/80">{bullet.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div 
        className="shrink-0 px-4 py-3 border-t border-border/30 flex items-center gap-2 bg-background/80 backdrop-blur-sm"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="rounded-full shrink-0"
          data-testid="button-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {isLast ? (
          <Button 
            onClick={onComplete} 
            className="flex-1 text-sm gap-2 font-semibold"
            data-testid="button-get-started"
          >
            <Check className="w-4 h-4" />
            Get Started
          </Button>
        ) : (
          <Button 
            onClick={goNext}
            className="flex-1 text-sm gap-1 font-semibold"
            data-testid="button-next"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={goNext}
          disabled={isLast}
          className="rounded-full shrink-0"
          data-testid="button-next-arrow"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <style>{`
        @keyframes iconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes progressFill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}

const memberCards: OnboardingCard[] = [
  {
    title: "Your Workouts",
    subtitle: "Everything about your training",
    icon: Dumbbell,
    gradient: "from-blue-500/20 via-indigo-500/15 to-violet-500/10",
    iconGradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    accentColor: "blue",
    proTipIndex: 2,
    bullets: [
      { icon: ClipboardList, text: "Your trainer creates workout cycles for you — open your dashboard and start logging sets, reps, and weights", color: "bg-blue-500/15 text-blue-500" },
      { icon: Sparkles, text: "Or create your own workouts using the smart wizard — build custom cycles tailored to your goals", color: "bg-violet-500/15 text-violet-500" },
      { icon: Import, text: "Got a workout from ChatGPT? Paste it in and it gets auto-organized into a proper program", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: Replace, text: "Can't do an exercise? Swap it for an alternative right from your workout", color: "bg-amber-500/15 text-amber-500" },
      { icon: BarChart3, text: "Track progress with workout streaks and week-by-week comparisons", color: "bg-rose-500/15 text-rose-500" },
    ]
  },
  {
    title: "Nutrition Tracking",
    subtitle: "Eat smart, track easily",
    icon: Utensils,
    gradient: "from-emerald-500/20 via-green-500/15 to-teal-500/10",
    iconGradient: "from-emerald-500 to-green-600",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    accentColor: "green",
    proTipIndex: 3,
    bullets: [
      { icon: Apple, text: "Log meals from 450+ foods — search, tap, and calories with macros are logged instantly", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: RefreshCw, text: "Choose cooking styles (grilled, fried, boiled) and calories adjust automatically", color: "bg-teal-500/15 text-teal-500" },
      { icon: Droplets, text: "Track daily water and protein intake with simple one-tap buttons", color: "bg-cyan-500/15 text-cyan-500" },
      { icon: MessageSquare, text: "Just tell Dika \"I had 2 eggs and toast\" and she logs it for you", color: "bg-purple-500/15 text-purple-500" },
      { icon: MapPin, text: "Use Find My Food to discover healthy restaurants near you", color: "bg-orange-500/15 text-orange-500" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your personal fitness buddy",
    icon: Brain,
    gradient: "from-purple-500/20 via-fuchsia-500/15 to-pink-500/10",
    iconGradient: "from-purple-500 to-fuchsia-600",
    iconBg: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
    accentColor: "purple",
    proTipIndex: 0,
    bullets: [
      { icon: Replace, text: "\"What can I do instead of pull-ups?\" — Get instant exercise alternatives", color: "bg-purple-500/15 text-purple-500" },
      { icon: Scale, text: "\"Log my weight as 75kg\" — Track body measurements through chat", color: "bg-blue-500/15 text-blue-500" },
      { icon: Utensils, text: "\"Suggest a high protein lunch\" — Get personalized meal ideas", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: Target, text: "\"Set a goal to lose 5kg\" — Create fitness goals Dika tracks for you", color: "bg-rose-500/15 text-rose-500" },
      { icon: BarChart3, text: "Get weekly AI reports summarizing your workouts and nutrition", color: "bg-amber-500/15 text-amber-500" },
    ]
  }
];

const personalModeCards: OnboardingCard[] = [
  {
    title: "Your Workouts",
    subtitle: "Train on your own terms",
    icon: Dumbbell,
    gradient: "from-blue-500/20 via-indigo-500/15 to-violet-500/10",
    iconGradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    accentColor: "blue",
    proTipIndex: 1,
    bullets: [
      { icon: Sparkles, text: "Create custom workout cycles using the smart wizard — pick exercises, set reps and weights", color: "bg-violet-500/15 text-violet-500" },
      { icon: Import, text: "Paste a workout from ChatGPT and it auto-organizes into a proper program", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: Replace, text: "Swap exercises in your cycle anytime — replace what doesn't work for you", color: "bg-amber-500/15 text-amber-500" },
      { icon: RefreshCw, text: "Push workouts forward if you need to skip a day — stay flexible", color: "bg-teal-500/15 text-teal-500" },
      { icon: BarChart3, text: "Track streaks, log sessions, and watch your consistency grow", color: "bg-rose-500/15 text-rose-500" },
    ]
  },
  {
    title: "Nutrition Tracking",
    subtitle: "Eat smart, track easily",
    icon: Utensils,
    gradient: "from-emerald-500/20 via-green-500/15 to-teal-500/10",
    iconGradient: "from-emerald-500 to-green-600",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    accentColor: "green",
    proTipIndex: 3,
    bullets: [
      { icon: Apple, text: "Log meals from 450+ foods with automatic calorie and macro calculation", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: RefreshCw, text: "Choose cooking styles (grilled, fried, boiled) — calories adjust automatically", color: "bg-teal-500/15 text-teal-500" },
      { icon: Droplets, text: "Track water and protein intake with simple one-tap buttons", color: "bg-cyan-500/15 text-cyan-500" },
      { icon: MessageSquare, text: "Tell Dika what you ate — \"I had chicken and rice\" — and she logs it", color: "bg-purple-500/15 text-purple-500" },
      { icon: MapPin, text: "Find My Food shows healthy restaurants near you", color: "bg-orange-500/15 text-orange-500" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your personal fitness buddy",
    icon: Brain,
    gradient: "from-purple-500/20 via-fuchsia-500/15 to-pink-500/10",
    iconGradient: "from-purple-500 to-fuchsia-600",
    iconBg: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
    accentColor: "purple",
    proTipIndex: 0,
    bullets: [
      { icon: Replace, text: "\"What can I do instead of barbell squats?\" — Get alternatives instantly", color: "bg-purple-500/15 text-purple-500" },
      { icon: Scale, text: "\"Log my weight as 80kg\" — Track body measurements through chat", color: "bg-blue-500/15 text-blue-500" },
      { icon: Utensils, text: "\"Suggest a post-workout meal\" — Get meal ideas for your goals", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: Target, text: "\"Set a goal to bench 100kg\" — Create goals Dika tracks for you", color: "bg-rose-500/15 text-rose-500" },
      { icon: BarChart3, text: "Weekly AI reports summarize your workouts and progress", color: "bg-amber-500/15 text-amber-500" },
    ]
  }
];

const trainerCards: OnboardingCard[] = [
  {
    title: "Workout Management",
    subtitle: "Design programs for your members",
    icon: Dumbbell,
    gradient: "from-blue-500/20 via-indigo-500/15 to-violet-500/10",
    iconGradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    accentColor: "blue",
    proTipIndex: 1,
    bullets: [
      { icon: ClipboardList, text: "Create workout cycles for each member — set exercises, sets, reps, and rest times", color: "bg-blue-500/15 text-blue-500" },
      { icon: Sparkles, text: "Save workout templates and assign them to multiple members quickly", color: "bg-violet-500/15 text-violet-500" },
      { icon: Users, text: "Choose Training Mode: Trainer-Led (you control) or Self-Guided (members manage)", color: "bg-teal-500/15 text-teal-500" },
      { icon: BarChart3, text: "Monitor each member's workout completion and consistency", color: "bg-rose-500/15 text-rose-500" },
      { icon: Replace, text: "Members can swap exercises — you'll see what they changed", color: "bg-amber-500/15 text-amber-500" },
    ]
  },
  {
    title: "Nutrition & Diet",
    subtitle: "Guide your members' diet",
    icon: Utensils,
    gradient: "from-emerald-500/20 via-green-500/15 to-teal-500/10",
    iconGradient: "from-emerald-500 to-green-600",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    accentColor: "green",
    proTipIndex: 0,
    bullets: [
      { icon: Star, text: "Mark top performers as Star Members and create custom diet plans", color: "bg-amber-500/15 text-amber-500" },
      { icon: Apple, text: "Members track meals with 450+ foods — you can view their logs", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: Target, text: "Set calorie and protein targets for your members", color: "bg-rose-500/15 text-rose-500" },
      { icon: MessageSquare, text: "Members use Dika to log meals by chatting naturally", color: "bg-purple-500/15 text-purple-500" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your AI training helper",
    icon: Brain,
    gradient: "from-purple-500/20 via-fuchsia-500/15 to-pink-500/10",
    iconGradient: "from-purple-500 to-fuchsia-600",
    iconBg: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
    accentColor: "purple",
    proTipIndex: 0,
    bullets: [
      { icon: Users, text: "\"How is John doing this week?\" — Get instant member insights", color: "bg-purple-500/15 text-purple-500" },
      { icon: ClipboardList, text: "\"What's a good push/pull/legs split?\" — Get programming ideas", color: "bg-blue-500/15 text-blue-500" },
      { icon: Navigation, text: "\"Go to my assigned members\" — Navigate the app through chat", color: "bg-teal-500/15 text-teal-500" },
      { icon: BarChart3, text: "Weekly AI reports highlight who needs your attention", color: "bg-amber-500/15 text-amber-500" },
    ]
  }
];

const ownerCards: OnboardingCard[] = [
  {
    title: "Gym Workouts",
    subtitle: "Manage your gym's training",
    icon: Dumbbell,
    gradient: "from-blue-500/20 via-indigo-500/15 to-violet-500/10",
    iconGradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    accentColor: "blue",
    proTipIndex: 0,
    bullets: [
      { icon: Users, text: "Set Training Mode — Trainer-Led (trainers assign) or Self-Guided (members create own)", color: "bg-teal-500/15 text-teal-500" },
      { icon: ClipboardList, text: "Trainers create workout cycles and templates for your members", color: "bg-blue-500/15 text-blue-500" },
      { icon: BarChart3, text: "View workout activity and attendance across your entire gym", color: "bg-rose-500/15 text-rose-500" },
      { icon: Replace, text: "Members can swap exercises and import workouts from AI assistants", color: "bg-amber-500/15 text-amber-500" },
    ]
  },
  {
    title: "Nutrition & Wellness",
    subtitle: "Member wellness tracking",
    icon: Utensils,
    gradient: "from-emerald-500/20 via-green-500/15 to-teal-500/10",
    iconGradient: "from-emerald-500 to-green-600",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    accentColor: "green",
    proTipIndex: 2,
    bullets: [
      { icon: Apple, text: "Members track meals with 450+ foods, water, and daily protein goals", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: Star, text: "Trainers create diet plans for Star Members", color: "bg-amber-500/15 text-amber-500" },
      { icon: MessageSquare, text: "Members use Dika to log meals by chatting — quick and easy", color: "bg-purple-500/15 text-purple-500" },
      { icon: MapPin, text: "Find My Food helps members discover healthy restaurants", color: "bg-orange-500/15 text-orange-500" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your AI gym manager",
    icon: Brain,
    gradient: "from-purple-500/20 via-fuchsia-500/15 to-pink-500/10",
    iconGradient: "from-purple-500 to-fuchsia-600",
    iconBg: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
    accentColor: "purple",
    proTipIndex: 0,
    bullets: [
      { icon: UserPlus, text: "\"Add John, phone 0551234567\" — Register members through chat", color: "bg-purple-500/15 text-purple-500" },
      { icon: CreditCard, text: "\"Log payment for Sarah, 200 AED\" — Record payments hands-free", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: Users, text: "\"Assign trainer Mike to Sarah\" — Manage assignments instantly", color: "bg-blue-500/15 text-blue-500" },
      { icon: Navigation, text: "\"Go to payments\" — Navigate anywhere through Dika", color: "bg-teal-500/15 text-teal-500" },
      { icon: BarChart3, text: "Weekly AI reports on gym activity and member engagement", color: "bg-amber-500/15 text-amber-500" },
    ]
  }
];

const ownerCardsIOS: OnboardingCard[] = [
  {
    title: "Gym Workouts",
    subtitle: "Manage your gym's training",
    icon: Dumbbell,
    gradient: "from-blue-500/20 via-indigo-500/15 to-violet-500/10",
    iconGradient: "from-blue-500 to-indigo-600",
    iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
    accentColor: "blue",
    proTipIndex: 0,
    bullets: [
      { icon: Users, text: "Set Training Mode — Trainer-Led or Self-Guided for your members", color: "bg-teal-500/15 text-teal-500" },
      { icon: ClipboardList, text: "Trainers create workout cycles and templates", color: "bg-blue-500/15 text-blue-500" },
      { icon: BarChart3, text: "View workout activity and attendance across your gym", color: "bg-rose-500/15 text-rose-500" },
    ]
  },
  {
    title: "Member Management",
    subtitle: "Keep your gym running smoothly",
    icon: Users,
    gradient: "from-emerald-500/20 via-green-500/15 to-teal-500/10",
    iconGradient: "from-emerald-500 to-green-600",
    iconBg: "bg-gradient-to-br from-emerald-500 to-green-600",
    accentColor: "green",
    proTipIndex: 2,
    bullets: [
      { icon: UserPlus, text: "Register members and share your gym code for self-joining", color: "bg-emerald-500/15 text-emerald-500" },
      { icon: Users, text: "Assign trainers and track attendance patterns", color: "bg-blue-500/15 text-blue-500" },
      { icon: Star, text: "Identify Star Members for special attention and diet plans", color: "bg-amber-500/15 text-amber-500" },
    ]
  },
  {
    title: "Dika AI Assistant",
    subtitle: "Your AI gym helper",
    icon: Brain,
    gradient: "from-purple-500/20 via-fuchsia-500/15 to-pink-500/10",
    iconGradient: "from-purple-500 to-fuchsia-600",
    iconBg: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
    accentColor: "purple",
    proTipIndex: 0,
    bullets: [
      { icon: Users, text: "\"How many active members?\" — Get instant gym insights", color: "bg-purple-500/15 text-purple-500" },
      { icon: Navigation, text: "\"Go to members page\" — Navigate hands-free through chat", color: "bg-teal-500/15 text-teal-500" },
      { icon: BarChart3, text: "Weekly AI reports on gym activity and engagement", color: "bg-amber-500/15 text-amber-500" },
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
