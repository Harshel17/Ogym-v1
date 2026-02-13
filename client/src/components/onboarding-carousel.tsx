import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  X, Dumbbell, Utensils, Brain, ChevronLeft, ChevronRight,
  ArrowRight, Sparkles, RefreshCw, Import, BarChart3,
  Apple, Droplets, MapPin, MessageSquare, Replace,
  Scale, Target, Users, CreditCard, Navigation,
  UserPlus, ClipboardList, Star
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
  iconGradient: string;
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

  return (
    <div 
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col" 
      data-testid="onboarding-carousel"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-6 h-2 bg-primary"
                  : "w-2 h-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
              }`}
              data-testid={`dot-${i}`}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onComplete}
          className="text-muted-foreground h-8 px-3 text-sm"
          data-testid="button-skip"
        >
          <X className="w-4 h-4 mr-1" />
          Close
        </Button>
      </div>

      <div 
        className="flex-1 overflow-y-auto px-5 pb-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={`rounded-2xl bg-gradient-to-br ${card.gradient} p-5 mb-4`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-12 h-12 rounded-xl ${card.iconGradient} flex items-center justify-center shrink-0`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold" data-testid="text-card-title">{card.title}</h2>
              <p className="text-sm text-muted-foreground">{card.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {card.bullets.map((bullet, i) => {
            const BulletIcon = bullet.icon;
            return (
              <div 
                key={i} 
                className="flex items-start gap-3 p-3.5 rounded-xl bg-card border border-border/50"
                data-testid={`bullet-${i}`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <BulletIcon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm leading-relaxed text-foreground/90 pt-1">{bullet.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div 
        className="px-5 py-4 flex items-center gap-3 border-t border-border/30"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <Button
          variant="outline"
          size="icon"
          onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="w-10 h-10 rounded-full shrink-0"
          data-testid="button-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {currentIndex === cards.length - 1 ? (
          <Button 
            onClick={onComplete} 
            className="flex-1 h-11 text-base gap-2"
            data-testid="button-get-started"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button 
            onClick={() => setCurrentIndex(currentIndex + 1)}
            className="flex-1 h-11 text-base gap-2"
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
          disabled={currentIndex === cards.length - 1}
          className="w-10 h-10 rounded-full shrink-0"
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
    title: "Workouts",
    subtitle: "Your training, organized",
    icon: Dumbbell,
    gradient: "from-blue-500/15 to-purple-500/10",
    iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
    bullets: [
      { icon: ClipboardList, text: "Your trainer creates workout cycles for you — just open your dashboard and start logging sets, reps, and weights" },
      { icon: Sparkles, text: "Or create your own workouts using our smart wizard — build custom cycles tailored to your goals" },
      { icon: Import, text: "Got a workout from ChatGPT? Paste it in and we'll automatically organize it into a proper program" },
      { icon: Replace, text: "Can't do an exercise? Swap it for an alternative right from your workout — or ask Dika for suggestions" },
      { icon: BarChart3, text: "Track your progress with workout streaks, completion rates, and week-by-week comparisons" },
    ]
  },
  {
    title: "Nutrition",
    subtitle: "Eat smart, track easily",
    icon: Utensils,
    gradient: "from-emerald-500/15 to-green-500/10",
    iconGradient: "bg-gradient-to-br from-emerald-500 to-green-500",
    bullets: [
      { icon: Apple, text: "Log your meals from a database of 450+ foods — search, tap, and it's logged with calories and macros" },
      { icon: RefreshCw, text: "Adjust cooking styles (grilled, fried, boiled) and the calories update automatically" },
      { icon: Droplets, text: "Track your daily water and protein intake with simple tap-to-add buttons" },
      { icon: MessageSquare, text: "Too lazy to search? Just tell Dika \"I had 2 eggs and toast\" and she'll log it for you" },
      { icon: MapPin, text: "Use Find My Food to discover healthy restaurant options near you with nutrition-friendly menus" },
    ]
  },
  {
    title: "Dika Assistant",
    subtitle: "Your AI fitness buddy",
    icon: Brain,
    gradient: "from-orange-500/15 to-amber-500/10",
    iconGradient: "bg-gradient-to-br from-orange-500 to-amber-500",
    bullets: [
      { icon: Replace, text: "\"What can I do instead of pull-ups?\" — Get instant exercise substitutions for any movement" },
      { icon: Scale, text: "\"Log my weight as 75kg\" — Track body measurements through simple chat" },
      { icon: Utensils, text: "\"Suggest a high protein lunch\" — Get personalized meal ideas based on your goals" },
      { icon: Target, text: "\"Set a goal to lose 5kg\" — Create and track fitness goals with Dika keeping you accountable" },
      { icon: BarChart3, text: "Get a weekly AI-generated report summarizing your workouts, nutrition, and progress" },
    ]
  }
];

const personalModeCards: OnboardingCard[] = [
  {
    title: "Workouts",
    subtitle: "Train on your own terms",
    icon: Dumbbell,
    gradient: "from-blue-500/15 to-purple-500/10",
    iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
    bullets: [
      { icon: Sparkles, text: "Create custom workout cycles using our smart wizard — pick exercises, set your reps and weights" },
      { icon: Import, text: "Paste a workout from ChatGPT or any AI assistant and we'll auto-organize it into a program" },
      { icon: Replace, text: "Swap exercises within your cycle anytime — replace movements that don't work for you" },
      { icon: RefreshCw, text: "Push workouts forward in your cycle if you need to skip a day — stay flexible" },
      { icon: BarChart3, text: "Track streaks, log every session, and watch your consistency grow over time" },
    ]
  },
  {
    title: "Nutrition",
    subtitle: "Eat smart, track easily",
    icon: Utensils,
    gradient: "from-emerald-500/15 to-green-500/10",
    iconGradient: "bg-gradient-to-br from-emerald-500 to-green-500",
    bullets: [
      { icon: Apple, text: "Log meals from 450+ foods with automatic calorie and macro calculation" },
      { icon: RefreshCw, text: "Choose cooking styles (grilled, fried, boiled) — calories adjust automatically" },
      { icon: Droplets, text: "Track water and protein intake with simple one-tap buttons" },
      { icon: MessageSquare, text: "Just tell Dika what you ate — \"I had chicken and rice\" — and she logs it for you" },
      { icon: MapPin, text: "Find My Food shows healthy restaurant options near you based on your location" },
    ]
  },
  {
    title: "Dika Assistant",
    subtitle: "Your AI fitness buddy",
    icon: Brain,
    gradient: "from-orange-500/15 to-amber-500/10",
    iconGradient: "bg-gradient-to-br from-orange-500 to-amber-500",
    bullets: [
      { icon: Replace, text: "\"What can I do instead of barbell squats?\" — Get exercise alternatives instantly" },
      { icon: Scale, text: "\"Log my weight as 80kg\" — Track body measurements through chat" },
      { icon: Utensils, text: "\"Suggest a post-workout meal\" — Get meal ideas tailored to your goals" },
      { icon: Target, text: "\"Set a goal to bench 100kg\" — Create goals and Dika tracks your progress" },
      { icon: BarChart3, text: "Weekly AI reports summarize your workouts, nutrition, and overall progress" },
    ]
  }
];

const trainerCards: OnboardingCard[] = [
  {
    title: "Workouts",
    subtitle: "Design programs for your members",
    icon: Dumbbell,
    gradient: "from-blue-500/15 to-purple-500/10",
    iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
    bullets: [
      { icon: ClipboardList, text: "Create workout cycles for each member — set exercises, sets, reps, and rest times" },
      { icon: Sparkles, text: "Save workout templates and assign them to multiple members quickly" },
      { icon: Users, text: "Choose Training Mode: Trainer-Led (you control the plan) or Self-Guided (members manage their own)" },
      { icon: BarChart3, text: "Monitor each member's workout completion and track who's showing up consistently" },
      { icon: Replace, text: "Members can swap exercises in their cycle — you'll see what they changed" },
    ]
  },
  {
    title: "Nutrition",
    subtitle: "Guide your members' diet",
    icon: Utensils,
    gradient: "from-emerald-500/15 to-green-500/10",
    iconGradient: "bg-gradient-to-br from-emerald-500 to-green-500",
    bullets: [
      { icon: Star, text: "Mark top performers as Star Members and create custom diet plans for them" },
      { icon: Apple, text: "Members track their meals with 450+ foods — you can see their nutrition logs" },
      { icon: Target, text: "Set calorie and protein targets for your members to work towards" },
      { icon: MessageSquare, text: "Members use Dika to log meals by chatting — \"I had 2 eggs and toast\"" },
    ]
  },
  {
    title: "Dika Assistant",
    subtitle: "Your AI training helper",
    icon: Brain,
    gradient: "from-orange-500/15 to-amber-500/10",
    iconGradient: "bg-gradient-to-br from-orange-500 to-amber-500",
    bullets: [
      { icon: Users, text: "\"How is John doing this week?\" — Get instant insights about any member's progress" },
      { icon: ClipboardList, text: "\"What's a good push/pull/legs split?\" — Get workout programming ideas" },
      { icon: Navigation, text: "\"Go to my assigned members\" — Navigate the app hands-free through chat" },
      { icon: BarChart3, text: "Weekly AI reports summarize your members' activity and highlight who needs attention" },
    ]
  }
];

const ownerCards: OnboardingCard[] = [
  {
    title: "Workouts",
    subtitle: "Manage your gym's training",
    icon: Dumbbell,
    gradient: "from-blue-500/15 to-purple-500/10",
    iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
    bullets: [
      { icon: Users, text: "Set your gym's Training Mode — Trainer-Led (trainers assign plans) or Self-Guided (members create their own)" },
      { icon: ClipboardList, text: "Trainers create workout cycles and templates for members from their dashboard" },
      { icon: BarChart3, text: "View workout activity and attendance patterns across your entire gym" },
      { icon: Replace, text: "Members can swap exercises and import workouts from AI assistants" },
    ]
  },
  {
    title: "Nutrition",
    subtitle: "Member wellness tracking",
    icon: Utensils,
    gradient: "from-emerald-500/15 to-green-500/10",
    iconGradient: "bg-gradient-to-br from-emerald-500 to-green-500",
    bullets: [
      { icon: Apple, text: "Members track meals with 450+ foods, water intake, and daily protein goals" },
      { icon: Star, text: "Trainers create diet plans for Star Members to complement their training" },
      { icon: MessageSquare, text: "Members use Dika to log meals by chatting — quick and easy nutrition tracking" },
      { icon: MapPin, text: "Find My Food helps members discover healthy restaurants near them" },
    ]
  },
  {
    title: "Dika Assistant",
    subtitle: "Your AI gym manager",
    icon: Brain,
    gradient: "from-orange-500/15 to-amber-500/10",
    iconGradient: "bg-gradient-to-br from-orange-500 to-amber-500",
    bullets: [
      { icon: UserPlus, text: "\"Add John Doe, phone 0551234567\" — Register new members through chat" },
      { icon: CreditCard, text: "\"Log payment for Sarah, 200 AED, cash\" — Record payments hands-free" },
      { icon: Users, text: "\"Assign trainer Mike to Sarah\" — Manage trainer assignments instantly" },
      { icon: Navigation, text: "\"Go to payments page\" — Navigate anywhere in the app through Dika" },
      { icon: BarChart3, text: "Weekly AI reports summarize gym activity, revenue trends, and member engagement" },
    ]
  }
];

const ownerCardsIOS: OnboardingCard[] = [
  {
    title: "Workouts",
    subtitle: "Manage your gym's training",
    icon: Dumbbell,
    gradient: "from-blue-500/15 to-purple-500/10",
    iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
    bullets: [
      { icon: Users, text: "Set Training Mode — Trainer-Led (trainers assign plans) or Self-Guided (members manage their own)" },
      { icon: ClipboardList, text: "Trainers create workout cycles and templates for your members" },
      { icon: BarChart3, text: "View workout activity and attendance patterns across your gym" },
    ]
  },
  {
    title: "Member Management",
    subtitle: "Keep your gym running smoothly",
    icon: Users,
    gradient: "from-emerald-500/15 to-green-500/10",
    iconGradient: "bg-gradient-to-br from-emerald-500 to-green-500",
    bullets: [
      { icon: UserPlus, text: "Register members quickly and share your gym code for self-joining" },
      { icon: Users, text: "Assign trainers to members and track attendance patterns" },
      { icon: Star, text: "Identify Star Members and give them special attention and diet plans" },
    ]
  },
  {
    title: "Dika Assistant",
    subtitle: "Your AI gym helper",
    icon: Brain,
    gradient: "from-orange-500/15 to-amber-500/10",
    iconGradient: "bg-gradient-to-br from-orange-500 to-amber-500",
    bullets: [
      { icon: Users, text: "\"How many active members do I have?\" — Get instant gym insights" },
      { icon: Navigation, text: "\"Go to members page\" — Navigate the app hands-free through chat" },
      { icon: BarChart3, text: "Weekly AI reports summarize gym activity and member engagement" },
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
