import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, TrendingUp, Calendar, Users, ClipboardList, CreditCard, Building2, BarChart3, Target, ChevronLeft, ChevronRight, Check, Brain, Sparkles } from "lucide-react";
import { isNative, isIOS } from "@/lib/capacitor-init";

interface Slide {
  icon: typeof Dumbbell;
  title: string;
  description: string;
  color: string;
}

interface OnboardingCarouselProps {
  slides: Slide[];
  onComplete: () => void;
}

const colorClasses: Record<string, { bg: string; icon: string }> = {
  primary: { 
    bg: "from-primary/20 to-primary/5", 
    icon: "bg-primary/20 text-primary" 
  },
  green: { 
    bg: "from-emerald-500/20 to-emerald-500/5", 
    icon: "bg-emerald-500/20 text-emerald-500" 
  },
  purple: { 
    bg: "from-purple-500/20 to-purple-500/5", 
    icon: "bg-purple-500/20 text-purple-500" 
  },
  amber: { 
    bg: "from-amber-500/20 to-amber-500/5", 
    icon: "bg-amber-500/20 text-amber-500" 
  },
  blue: { 
    bg: "from-blue-500/20 to-blue-500/5", 
    icon: "bg-blue-500/20 text-blue-500" 
  },
};

function OnboardingCarousel({ slides, onComplete }: OnboardingCarouselProps) {
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
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    if (isRightSwipe && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const nextSlide = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentSlide = slides[currentIndex];
  const Icon = currentSlide.icon;
  const colors = colorClasses[currentSlide.color] || colorClasses.primary;
  const isLastSlide = currentIndex === slides.length - 1;

  return (
    <div 
      className="fixed inset-0 z-50 bg-background flex flex-col" 
      data-testid="onboarding-carousel"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div 
        className="flex-1 flex flex-col items-center justify-center p-6"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={`w-full max-w-sm mx-auto bg-gradient-to-b ${colors.bg} rounded-3xl p-8 text-center`}>
          <div className={`w-20 h-20 rounded-2xl ${colors.icon} mx-auto mb-6 flex items-center justify-center`}>
            <Icon className="w-10 h-10" />
          </div>
          
          <h2 className="text-2xl font-bold mb-3">{currentSlide.title}</h2>
          <p className="text-muted-foreground leading-relaxed">{currentSlide.description}</p>
        </div>

        <div className="flex items-center gap-2 mt-8">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex 
                  ? "w-6 bg-primary" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              data-testid={`dot-${index}`}
            />
          ))}
        </div>
      </div>

      <div 
        className="p-6 flex items-center justify-between gap-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={prevSlide}
          disabled={currentIndex === 0}
          className="w-12 h-12 rounded-full"
          data-testid="button-prev"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {isLastSlide ? (
          <Button 
            onClick={onComplete} 
            className="flex-1 h-12 text-base gap-2"
            data-testid="button-get-started"
          >
            <Check className="w-5 h-5" />
            Get Started
          </Button>
        ) : (
          <Button 
            onClick={nextSlide}
            variant="outline" 
            className="flex-1 h-12 text-base"
            data-testid="button-next"
          >
            Next
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={nextSlide}
          disabled={isLastSlide}
          className="w-12 h-12 rounded-full"
          data-testid="button-next-arrow"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <Button
        variant="ghost"
        onClick={onComplete}
        className="absolute right-4 text-muted-foreground"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
        data-testid="button-skip"
      >
        Skip
      </Button>
    </div>
  );
}

const memberSlides: Slide[] = [
  {
    icon: Dumbbell,
    title: "Your Workouts, Simplified",
    description: "Tap to log each exercise as you complete it. Track your sets, reps, and weights with just a few taps. Your trainer designs the plan, you crush the execution!",
    color: "primary"
  },
  {
    icon: TrendingUp,
    title: "Watch Yourself Grow",
    description: "See your workout streaks build day by day. Log your body measurements and watch the transformation happen. Celebrate every milestone along the way!",
    color: "green"
  },
  {
    icon: Brain,
    title: "Meet Dika, Your AI Buddy",
    description: "Got questions? Ask Dika! She knows your workouts, attendance, and progress. Just tap the floating button and ask anything about your fitness journey.",
    color: "purple"
  }
];

const personalModeSlides: Slide[] = [
  {
    icon: Sparkles,
    title: "Build Your Perfect Workout",
    description: "Use our smart wizard to create custom workout cycles, or paste your favorite routine from ChatGPT. We'll organize it beautifully for you!",
    color: "primary"
  },
  {
    icon: TrendingUp,
    title: "Track Your Transformation",
    description: "Log every workout session and body measurement. Watch your progress unfold with visual streaks and stats. Your fitness story, beautifully told!",
    color: "green"
  },
  {
    icon: Brain,
    title: "Meet Dika, Your AI Buddy",
    description: "Got questions about your workouts? Ask Dika! She's your personal AI assistant who knows everything about your fitness data. Just tap and chat!",
    color: "purple"
  }
];

const trainerSlides: Slide[] = [
  {
    icon: Users,
    title: "Your Members, One Dashboard",
    description: "See all your assigned members at a glance. Track who's showing up, who needs motivation, and who's crushing their goals. Stay connected with everyone!",
    color: "primary"
  },
  {
    icon: ClipboardList,
    title: "Design Custom Programs",
    description: "Create personalized workout cycles for each member. Mix exercises, set targets, and watch them progress. Your expertise, their results!",
    color: "green"
  },
  {
    icon: Target,
    title: "Celebrate Star Performers",
    description: "Identify your top members and give them the spotlight. Create custom diet plans for those going the extra mile. Build champions!",
    color: "amber"
  }
];

const ownerSlides: Slide[] = [
  {
    icon: Building2,
    title: "Your Gym, Your Way",
    description: "Invite trainers with a simple code, register members in seconds, and control everything from one place. Running a gym has never been this smooth!",
    color: "primary"
  },
  {
    icon: CreditCard,
    title: "Payments Made Easy",
    description: "Create subscription plans in any currency, track who's paid and who's due. No more spreadsheets or chasing payments - it's all automated!",
    color: "green"
  },
  {
    icon: BarChart3,
    title: "Insights That Matter",
    description: "See attendance patterns, revenue trends, and AI-powered alerts about at-risk members. Make data-driven decisions to grow your gym!",
    color: "purple"
  }
];

const ownerSlidesIOS: Slide[] = [
  {
    icon: Building2,
    title: "Your Gym, Your Way",
    description: "Invite trainers with a simple code, register members in seconds, and control everything from one place. Running a gym has never been this smooth!",
    color: "primary"
  },
  {
    icon: Users,
    title: "Manage Your Team",
    description: "Track attendance patterns, assign trainers to members, and keep everyone on the same page with announcements and updates.",
    color: "green"
  },
  {
    icon: Brain,
    title: "AI-Powered Assistant",
    description: "Meet Dika, your AI assistant that helps you manage members, track attendance, and stay on top of your gym operations effortlessly!",
    color: "purple"
  }
];

export function MemberOnboarding({ onComplete }: { onComplete: () => void }) {
  return <OnboardingCarousel slides={memberSlides} onComplete={onComplete} />;
}

export function PersonalModeOnboarding({ onComplete }: { onComplete: () => void }) {
  return <OnboardingCarousel slides={personalModeSlides} onComplete={onComplete} />;
}

export function TrainerOnboarding({ onComplete }: { onComplete: () => void }) {
  return <OnboardingCarousel slides={trainerSlides} onComplete={onComplete} />;
}

export function OwnerOnboarding({ onComplete }: { onComplete: () => void }) {
  const slides = (isNative() && isIOS()) ? ownerSlidesIOS : ownerSlides;
  return <OnboardingCarousel slides={slides} onComplete={onComplete} />;
}
