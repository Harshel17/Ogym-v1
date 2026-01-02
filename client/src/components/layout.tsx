import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  CalendarCheck, 
  CreditCard, 
  LogOut, 
  Dumbbell,
  TrendingUp,
  MessageSquare,
  Star,
  Utensils,
  UserCircle,
  ArrowRightLeft,
  Megaphone
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const isOwner = user.role === "owner";
  const isTrainer = user.role === "trainer";
  const isMember = user.role === "member";

  const navItems = [
    { 
      label: "Dashboard", 
      href: "/", 
      icon: LayoutDashboard,
      visible: true
    },
    { 
      label: "Profile", 
      href: "/profile", 
      icon: UserCircle,
      visible: true
    },
    { 
      label: "Trainers", 
      href: "/trainers", 
      icon: Users,
      visible: isOwner
    },
    { 
      label: "Members", 
      href: "/members", 
      icon: Users,
      visible: isOwner || isTrainer
    },
    { 
      label: "Attendance", 
      href: "/attendance", 
      icon: CalendarCheck,
      visible: true
    },
    { 
      label: "Payments", 
      href: "/payments", 
      icon: CreditCard,
      visible: isOwner || isMember
    },
    { 
      label: "Workouts", 
      href: "/workouts", 
      icon: Dumbbell,
      visible: isTrainer
    },
    { 
      label: "Star Members", 
      href: "/star-members", 
      icon: Star,
      visible: isTrainer
    },
    { 
      label: "Diet Plans", 
      href: "/diet-plans", 
      icon: Utensils,
      visible: isTrainer
    },
    { 
      label: "My Workout", 
      href: "/my-workout", 
      icon: Dumbbell,
      visible: isMember
    },
    { 
      label: "Progress", 
      href: "/progress", 
      icon: TrendingUp,
      visible: isMember
    },
    { 
      label: "My Diet Plan", 
      href: "/my-diet-plan", 
      icon: Utensils,
      visible: isMember
    },
    { 
      label: "Requests", 
      href: "/requests", 
      icon: MessageSquare,
      visible: isMember || isTrainer
    },
    { 
      label: "Transfers", 
      href: "/transfers", 
      icon: ArrowRightLeft,
      visible: isOwner
    },
    { 
      label: "Announcements", 
      href: "/owner/announcements", 
      icon: Megaphone,
      visible: isOwner
    },
    { 
      label: "Announcements", 
      href: "/announcements", 
      icon: Megaphone,
      visible: isTrainer || isMember
    },
  ];

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col sticky top-0 h-screen z-10">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Dumbbell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl leading-none">OGym</h1>
              <p className="text-xs text-muted-foreground mt-1">Management v1.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.filter(item => item.visible).map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div 
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                    ${isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/50">
          <div className="bg-secondary/50 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">My Profile</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            {user.gym && (
              <div className="mt-3 pt-3 border-t border-border/50">
                 <p className="text-xs text-muted-foreground">Gym Code:</p>
                 <p className="font-mono text-xs font-bold bg-background p-1 rounded border border-border mt-1 text-center select-all">
                   {user.gym.code}
                 </p>
              </div>
            )}
          </div>
          
          <Button 
            variant="outline" 
            className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <header className="md:hidden bg-card border-b border-border p-4 flex items-center justify-between sticky top-0 z-20">
           <div className="flex items-center gap-2">
            <Dumbbell className="w-6 h-6 text-primary" />
            <span className="font-bold font-display">OGym</span>
           </div>
           <Button variant="ghost" size="sm" onClick={() => logoutMutation.mutate()}>
             <LogOut className="w-5 h-5" />
           </Button>
        </header>
        
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.filter(item => item.visible).map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex flex-col items-center justify-center w-full h-full cursor-pointer ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  <item.icon className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
