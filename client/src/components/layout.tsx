import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useNotificationCounts } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dika } from "@/components/dika";
import { ThemeToggle } from "@/components/theme-toggle";
import ogymLogo from "@/assets/images/ogym-logo.png";
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
  HelpCircle,
  Menu,
  PersonStanding,
  QrCode,
  Brain,
  HeartPulse,
  PhoneCall,
  MailCheck,
  Sparkles,
  type LucideIcon
} from "lucide-react";

type MobileTabItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number;
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const { data: notificationCounts } = useNotificationCounts();

  if (!user) return null;

  const isOwner = user.role === "owner";
  const isTrainer = user.role === "trainer";
  const isMember = user.role === "member";
  const hasGym = !!user.gymId;
  const isOwnerWithoutGym = isOwner && !hasGym;

  const isPersonalMode = isMember && !hasGym;
  
  const navItems = [
    { 
      label: "Dashboard", 
      href: "/", 
      icon: LayoutDashboard,
      visible: hasGym || isPersonalMode,
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
      label: "My Workouts", 
      href: "/my-workouts", 
      icon: Dumbbell,
      visible: isPersonalMode,
      badge: 0
    },
    { 
      label: "Progress", 
      href: "/progress", 
      icon: TrendingUp,
      visible: isPersonalMode,
      badge: 0
    },
    { 
      label: "My Body", 
      href: "/my-body", 
      icon: HeartPulse,
      visible: isPersonalMode,
      badge: 0
    },
    { 
      label: "Join a Gym", 
      href: "/join-gym", 
      icon: Building2,
      visible: isPersonalMode,
      badge: 0
    },
    { 
      label: "Profile", 
      href: "/profile", 
      icon: UserCircle,
      visible: hasGym || isPersonalMode,
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
      label: "Walk-ins", 
      href: "/owner/walk-in-visitors", 
      icon: PersonStanding,
      visible: isOwner && hasGym,
      badge: 0
    },
    { 
      label: "Follow-ups", 
      href: "/owner/follow-ups", 
      icon: PhoneCall,
      visible: isOwner && hasGym,
      badge: 0
    },
    { 
      label: "AI Insights", 
      href: "/owner/ai-insights", 
      icon: Brain,
      visible: isOwner && hasGym,
      badge: 0
    },
    { 
      label: "Self Check-in", 
      href: "/owner/kiosk", 
      icon: QrCode,
      visible: isOwner && hasGym,
      badge: 0
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
      label: "Help", 
      href: "/help", 
      icon: HelpCircle,
      visible: true,
      badge: 0
    },
    { 
      label: "Support", 
      href: "/support", 
      icon: MessageSquare,
      visible: true,
      badge: 0
    },
  ];

  const getMobileNavigation = (): { primary: MobileTabItem[], secondary: MobileTabItem[] } => {
    if (isOwner && hasGym) {
      return {
        primary: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Members", href: "/members", icon: Users },
          { label: "Attendance", href: "/owner/attendance", icon: CalendarCheck },
          { label: "Payments", href: "/payments", icon: CreditCard },
        ],
        secondary: [
          { label: "Trainers", href: "/trainers", icon: Users },
          { label: "Transfers", href: "/transfers", icon: ArrowRightLeft, badge: notificationCounts?.pendingTransfers || 0 },
          { label: "Announcements", href: "/owner/announcements", icon: Megaphone },
          { label: "Walk-ins", href: "/owner/walk-in-visitors", icon: PersonStanding },
          { label: "Follow-ups", href: "/owner/follow-ups", icon: PhoneCall },
          { label: "Self Check-in", href: "/owner/kiosk", icon: QrCode },
          { label: "AI Insights", href: "/owner/ai-insights", icon: Brain },
          { label: "Auto Emails", href: "/owner/automated-emails", icon: MailCheck },
          { label: "Feed", href: "/feed", icon: Activity },
          { label: "Tournaments", href: "/tournaments", icon: Trophy },
          { label: "Join Requests", href: "/owner/join-requests", icon: UserPlus, badge: notificationCounts?.pendingJoinRequests || 0 },
          { label: "Profile", href: "/profile", icon: UserCircle },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isOwner && !hasGym) {
      return {
        primary: [
          { label: "Register", href: "/gym-request", icon: Building2 },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Profile", href: "/profile", icon: UserCircle },
        ],
        secondary: [
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isTrainer) {
      return {
        primary: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Workouts", href: "/workouts", icon: Dumbbell },
          { label: "Members", href: "/members", icon: Users },
          { label: "Requests", href: "/requests", icon: MessageSquare, badge: notificationCounts?.pendingRequests || 0 },
        ],
        secondary: [
          { label: "Star Members", href: "/star-members", icon: Star },
          { label: "Diet Plans", href: "/diet-plans", icon: Utensils },
          { label: "Templates", href: "/templates", icon: FileText },
          { label: "Announcements", href: "/announcements", icon: Megaphone, badge: notificationCounts?.unreadAnnouncements || 0 },
          { label: "Feed", href: "/feed", icon: Activity },
          { label: "Tournaments", href: "/tournaments", icon: Trophy },
          { label: "Profile", href: "/profile", icon: UserCircle },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isMember && hasGym) {
      return {
        primary: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Workout", href: "/my-workout", icon: Dumbbell },
          { label: "Attendance", href: "/attendance", icon: CalendarCheck },
          { label: "Progress", href: "/progress", icon: TrendingUp },
        ],
        secondary: [
          { label: "My Body", href: "/my-body", icon: Scale },
          { label: "My Diet", href: "/my-diet-plan", icon: Utensils },
          { label: "Payments", href: "/payments", icon: CreditCard },
          { label: "Requests", href: "/requests", icon: MessageSquare, badge: notificationCounts?.pendingRequests || 0 },
          { label: "Announcements", href: "/announcements", icon: Megaphone, badge: notificationCounts?.unreadAnnouncements || 0 },
          { label: "Feed", href: "/feed", icon: Activity },
          { label: "Tournaments", href: "/tournaments", icon: Trophy },
          { label: "Profile", href: "/profile", icon: UserCircle },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    if (isMember && !hasGym) {
      return {
        primary: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard },
          { label: "Workouts", href: "/my-workouts", icon: Dumbbell },
          { label: "Progress", href: "/progress", icon: TrendingUp },
          { label: "Profile", href: "/profile", icon: UserCircle },
        ],
        secondary: [
          { label: "My Body", href: "/my-body", icon: HeartPulse },
          { label: "Join Gym", href: "/join-gym", icon: Building2 },
          { label: "Help", href: "/help", icon: HelpCircle },
          { label: "Support", href: "/support", icon: MessageSquare },
        ]
      };
    }
    return {
      primary: [
        { label: "Dashboard", href: "/", icon: LayoutDashboard },
        { label: "Profile", href: "/profile", icon: UserCircle },
      ],
      secondary: []
    };
  };

  const { primary: primaryTabs, secondary: secondaryTabs } = getMobileNavigation();
  const hasMoreMenu = secondaryTabs.length > 0;
  const secondaryBadgeCount = secondaryTabs.reduce((sum, item) => sum + (item.badge || 0), 0);

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col sticky top-0 h-screen z-10">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl shadow-lg shadow-primary/25 overflow-hidden flex items-center justify-center">
                <img src={ogymLogo} alt="OGym" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-display font-bold text-lg leading-none magic-text">OGym</h1>
                  <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400 font-medium">
                    <Sparkles className="w-2.5 h-2.5" />
                    AI
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Fitness Management</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
        <header className="md:hidden bg-card/80 backdrop-blur-lg border-b border-border p-3 flex items-center justify-between gap-2 sticky top-0 z-20">
           <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg shadow-md shadow-primary/20 overflow-hidden flex items-center justify-center">
              <img src={ogymLogo} alt="OGym" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold font-display text-sm magic-text">OGym</span>
            <span className="flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400 font-medium">
              <Sparkles className="w-2 h-2" />
              AI
            </span>
           </div>
           <div className="flex items-center gap-1">
             <ThemeToggle />
             <Button variant="ghost" size="icon" onClick={() => logoutMutation.mutate()}>
               <LogOut className="w-4 h-4" />
             </Button>
           </div>
        </header>
        
        <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24 md:pb-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30 pb-safe">
        <div className="flex justify-around items-center h-16">
          {primaryTabs.map((item) => {
            const isActive = location === item.href || 
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div 
                  className={`relative flex flex-col items-center justify-center min-w-[56px] py-2 cursor-pointer transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  data-testid={`tab-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="relative">
                    <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                    {(item.badge ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                        {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] mt-1 ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                </div>
              </Link>
            );
          })}
          {hasMoreMenu && (
            <div 
              className={`relative flex flex-col items-center justify-center min-w-[56px] py-2 cursor-pointer transition-colors text-muted-foreground`}
              onClick={() => setMoreMenuOpen(true)}
              data-testid="tab-more"
            >
              <div className="relative">
                <Menu className="w-5 h-5" />
                {secondaryBadgeCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {secondaryBadgeCount > 99 ? '99+' : secondaryBadgeCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 font-medium">More</span>
            </div>
          )}
        </div>
      </nav>

      {/* More Menu Drawer */}
      <Drawer open={moreMenuOpen} onOpenChange={setMoreMenuOpen}>
        <DrawerContent className="pb-safe">
          <DrawerHeader>
            <DrawerTitle>More Options</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-1 max-h-[60vh] overflow-y-auto">
            {secondaryTabs.map((item) => {
              const isActive = location === item.href || 
                (item.href !== "/" && location.startsWith(item.href));
              return (
                <div 
                  key={item.href}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-foreground hover:bg-secondary"
                  }`}
                  onClick={() => {
                    navigate(item.href);
                    setMoreMenuOpen(false);
                  }}
                  data-testid={`more-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {(item.badge ?? 0) > 0 && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${isActive ? "bg-white/20 text-primary-foreground" : "bg-primary text-primary-foreground"}`}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
      
      <Dika />
    </div>
  );
}
