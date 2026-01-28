import { Card, CardContent } from "@/components/ui/card";
import { Dumbbell, TrendingUp, Calendar, Users, ClipboardList, CreditCard, Building2, BarChart3, Target } from "lucide-react";

interface WelcomeCardProps {
  icon: typeof Dumbbell;
  title: string;
  description: string;
  color: string;
}

function WelcomeCard({ icon: Icon, title, description, color }: WelcomeCardProps) {
  const colorClasses: Record<string, string> = {
    primary: "from-primary/10 to-primary/5 text-primary",
    green: "from-emerald-500/10 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    purple: "from-purple-500/10 to-purple-500/5 text-purple-600 dark:text-purple-400",
    amber: "from-amber-500/10 to-amber-500/5 text-amber-600 dark:text-amber-400",
    blue: "from-blue-500/10 to-blue-500/5 text-blue-600 dark:text-blue-400",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} border-0`}>
      <CardContent className="pt-6 pb-4 text-center">
        <div className={`w-12 h-12 rounded-xl bg-background/80 mx-auto mb-3 flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function MemberWelcomeCards() {
  return (
    <div className="space-y-4" data-testid="welcome-cards-member">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-foreground">Welcome to OGym</h3>
        <p className="text-sm text-muted-foreground">Your personal fitness companion</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <WelcomeCard
          icon={Dumbbell}
          title="Track Workouts"
          description="Log your exercises, sets, and reps to stay on top of your training"
          color="primary"
        />
        <WelcomeCard
          icon={TrendingUp}
          title="Monitor Progress"
          description="See your streaks, body measurements, and workout history"
          color="green"
        />
        <WelcomeCard
          icon={Calendar}
          title="Stay Consistent"
          description="Follow your personalized workout schedule and build habits"
          color="purple"
        />
      </div>
    </div>
  );
}

export function TrainerWelcomeCards() {
  return (
    <div className="space-y-4" data-testid="welcome-cards-trainer">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-foreground">Welcome to OGym</h3>
        <p className="text-sm text-muted-foreground">Manage your members effectively</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <WelcomeCard
          icon={Users}
          title="Manage Members"
          description="View your assigned members and track their attendance"
          color="primary"
        />
        <WelcomeCard
          icon={ClipboardList}
          title="Create Workout Plans"
          description="Design personalized workout cycles for each member"
          color="green"
        />
        <WelcomeCard
          icon={Target}
          title="Track Progress"
          description="Monitor member performance and identify star performers"
          color="amber"
        />
      </div>
    </div>
  );
}

export function OwnerWelcomeCards() {
  return (
    <div className="space-y-4" data-testid="welcome-cards-owner">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-foreground">Welcome to OGym</h3>
        <p className="text-sm text-muted-foreground">Your complete gym management solution</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <WelcomeCard
          icon={Building2}
          title="Manage Your Gym"
          description="Invite trainers, register members, and control access"
          color="primary"
        />
        <WelcomeCard
          icon={CreditCard}
          title="Handle Payments"
          description="Track subscriptions, record payments, and manage plans"
          color="green"
        />
        <WelcomeCard
          icon={BarChart3}
          title="View Analytics"
          description="Monitor attendance, revenue, and member engagement"
          color="purple"
        />
      </div>
    </div>
  );
}

export function PersonalModeWelcomeCards() {
  return (
    <div className="space-y-4" data-testid="welcome-cards-personal">
      <div className="text-center mb-2">
        <h3 className="text-lg font-semibold text-foreground">Welcome to OGym Personal</h3>
        <p className="text-sm text-muted-foreground">Your free workout tracker - no gym required</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <WelcomeCard
          icon={Dumbbell}
          title="Create Your Cycle"
          description="Build custom workout cycles with our wizard or import from AI"
          color="primary"
        />
        <WelcomeCard
          icon={TrendingUp}
          title="Track Everything"
          description="Log workouts, body measurements, and see your progress over time"
          color="green"
        />
        <WelcomeCard
          icon={Calendar}
          title="100% Free Forever"
          description="Full workout tracking without any subscriptions or hidden fees"
          color="amber"
        />
      </div>
    </div>
  );
}
