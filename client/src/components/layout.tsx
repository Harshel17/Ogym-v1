import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationCounts } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
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
  Megaphone,
  Building2,
  UserPlus,
  Scale,
  FileText,
  Activity,
  Trophy,
  HelpCircle
} from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const { data: notificationCounts } = useNotificationCounts();

  if (!user) return null;

  const isOwner = user.role === "owner";
  const isTrainer = user.role === "trainer";
  const isMember = user.role === "member";
  const hasGym = !!user.gymId;
  const isOwnerWithoutGym = isOwner && !hasGym;

  const navItems = [
    { 
      label: "Dashboard", 
      href: "/", 
      icon: LayoutDashboard,
      visible: hasGym,
      badge: 0
    },
    { 
      label: "Register Gym", 
      href: "/gym-request", 
      icon: Building2,
      visible: isOwnerWithoutGym,
      badge: 0
    },
    { 
      label: "Profile", 
      href: "/profile", 
      icon: UserCircle,
      visible: hasGym,
      badge: 0
    },
    { 
      label: "Trainers", 
      href: "/trainers", 
      icon: Users,
      visible: isOwner && hasGym,
      badge: 0
    },
    { 
      label: "Members", 
      href: "/members", 
      icon: Users,
      visible: (isOwner && hasGym) || isTrainer,
      badge: 0
    },
    { 
      label: "Attendance", 
      href: "/attendance", 
      icon: CalendarCheck,
      visible: hasGym && !isTrainer,
      badge: 0
    },
    { 
      label: "Payments", 
      href: "/payments", 
      icon: CreditCard,
      visible: (isOwner && hasGym) || isMember,
      badge: 0
    },
    { 
      label: "Workouts", 
      href: "/workouts", 
      icon: Dumbbell,
      visible: isTrainer,
      badge: 0
    },
    { 
      label: "Star Members", 
      href: "/star-members", 
      icon: Star,
      visible: isTrainer,
      badge: 0
    },
    { 
      label: "Diet Plans", 
      href: "/diet-plans", 
      icon: Utensils,
      visible: isTrainer,
      badge: 0
    },
    { 
      label: "Templates", 
      href: "/templates", 
      icon: FileText,
      visible: isTrainer,
      badge: 0
    },
    { 
      label: "My Workout", 
      href: "/my-workout", 
      icon: Dumbbell,
      visible: isMember,
      badge: 0
    },
    { 
      label: "Progress", 
      href: "/progress", 
      icon: TrendingUp,
      visible: isMember,
      badge: 0
    },
    { 
      label: "My Diet Plan", 
      href: "/my-diet-plan", 
      icon: Utensils,
      visible: isMember,
      badge: 0
    },
    { 
      label: "My Body", 
      href: "/my-body", 
      icon: Scale,
      visible: isMember,
      badge: 0
    },
    { 
      label: "Requests", 
      href: "/requests", 
      icon: MessageSquare,
      visible: isMember || isTrainer,
      badge: notificationCounts?.pendingRequests || 0
    },
    { 
      label: "Transfers", 
      href: "/transfers", 
      icon: ArrowRightLeft,
      visible: isOwner && hasGym,
      badge: notificationCounts?.pendingTransfers || 0
    },
    { 
      label: "Announcements", 
      href: "/owner/announcements", 
      icon: Megaphone,
      visible: isOwner && hasGym,
      badge: 0  // Owners create announcements, they don't receive them
    },
    { 
      label: "Announcements", 
      href: "/announcements", 
      icon: Megaphone,
      visible: isTrainer || isMember,
      badge: notificationCounts?.unreadAnnouncements || 0
    },
    { 
      label: "Feed", 
      href: "/feed", 
      icon: Activity,
      visible: hasGym,
      badge: 0
    },
    { 
      label: "Tournaments", 
      href: "/tournaments", 
      icon: Trophy,
      visible: hasGym,
      badge: 0
    },
    { 
      label: "Join Requests", 
      href: "/owner/join-requests", 
      icon: UserPlus,
      visible: isOwner && !!user.gymId,
      badge: notificationCounts?.pendingJoinRequests || 0
    },
    { 
      label: "Support", 
      href: "/support", 
      icon: HelpCircle,
      visible: true,
      badge: 0
    },
  ];

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col sticky top-0 h-screen z-10">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="premium-gradient p-2 rounded-lg shadow-lg shadow-primary/25">
                <Dumbbell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg leading-none">OGym</h1>
                <p className="text-[10px] text-muted-foreground mt-0.5">Fitness Management</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.filter(item => item.visible).map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div 
                  className={`
                    flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                    ${isActive 
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    {item.label}
                  </div>
                  {item.badge > 0 && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs px-1.5 py-0.5 min-w-[20px] text-center ${isActive ? "bg-white/20 text-primary-foreground" : "bg-primary text-primary-foreground"}`}
                      data-testid={`badge-${item.label.toLowerCase().replace(/\s+/g, '-')}-count`}
                    >
                      {item.badge}
                    </Badge>
                  )}
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
            {user.gym && isOwner && (
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
        <header className="md:hidden bg-card border-b border-border p-3 flex items-center justify-between gap-2 sticky top-0 z-20">
           <div className="flex items-center gap-2">
            <div className="premium-gradient p-1.5 rounded-lg">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold font-display text-sm">OGym</span>
           </div>
           <div className="flex items-center gap-1">
             <ThemeToggle />
             <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()}>
               <LogOut className="w-4 h-4" />
             </Button>
           </div>
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
                <div className={`relative flex flex-col items-center justify-center w-full h-full cursor-pointer ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  <div className="relative">
                    <item.icon className="w-5 h-5 mb-1" />
                    {item.badge > 0 && (
                      <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
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
