import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dumbbell, TrendingUp, Calendar, Users, ClipboardList, CreditCard, Building2, BarChart3, Target, ChevronLeft, ChevronRight, Check } from "lucide-react";

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
    <div className="fixed inset-0 z-50 bg-background flex flex-col" data-testid="onboarding-carousel">
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

      <div className="p-6 pb-8 flex items-center justify-between gap-4">
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
        className="absolute top-4 right-4 text-muted-foreground"
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
    title: "Track Your Workouts",
    description: "Log every exercise, set, and rep. Build a complete record of your fitness journey.",
    color: "primary"
  },
  {
    icon: TrendingUp,
    title: "See Your Progress",
    description: "Watch your streaks grow, track body measurements, and celebrate your achievements.",
    color: "green"
  },
  {
    icon: Calendar,
    title: "Stay Consistent",
    description: "Follow your personalized workout schedule. Never miss a session with smart reminders.",
    color: "purple"
  }
];

const personalModeSlides: Slide[] = [
  {
    icon: Dumbbell,
    title: "Create Your Workout",
    description: "Build custom workout cycles with our wizard or import from your favorite AI assistant.",
    color: "primary"
  },
  {
    icon: TrendingUp,
    title: "Track Everything",
    description: "Log workouts, body measurements, and watch your fitness progress over time.",
    color: "green"
  },
  {
    icon: Calendar,
    title: "100% Free Forever",
    description: "Full workout tracking without any subscriptions, ads, or hidden fees. Your data, your control.",
    color: "amber"
  }
];

const trainerSlides: Slide[] = [
  {
    icon: Users,
    title: "Manage Your Members",
    description: "View all assigned members, track their attendance, and monitor their progress.",
    color: "primary"
  },
  {
    icon: ClipboardList,
    title: "Create Workout Plans",
    description: "Design personalized workout cycles tailored to each member's goals and abilities.",
    color: "green"
  },
  {
    icon: Target,
    title: "Identify Star Performers",
    description: "Recognize top performers and create custom diet plans for dedicated members.",
    color: "amber"
  }
];

const ownerSlides: Slide[] = [
  {
    icon: Building2,
    title: "Manage Your Gym",
    description: "Invite trainers, register members, and control access to your facility with ease.",
    color: "primary"
  },
  {
    icon: CreditCard,
    title: "Handle Payments",
    description: "Create subscription plans, track payments, and manage member billing effortlessly.",
    color: "green"
  },
  {
    icon: BarChart3,
    title: "View Analytics",
    description: "Monitor attendance trends, revenue, and get AI-powered insights about your business.",
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
  return <OnboardingCarousel slides={ownerSlides} onComplete={onComplete} />;
}
